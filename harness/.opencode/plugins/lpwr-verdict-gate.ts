import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import {
  SPEC_ID,
  block,
  commandName,
  escapeRegExp,
  firstArgument,
  frontmatterBlock,
  frontmatterValue,
  looksLikeGitCommit,
  normalizeEol,
} from "./shared.js";

// Mechanical verdict floor (implementation-rules 5/7): /lpwr-commit, /lpwr-release, and a
// raw `git commit` on a spec-shaped branch cannot run without a recorded "ship" whose
// acceptance table is complete — unless incomplete rows are explicitly waived or deferred
// in the review frontmatter. A prompt sentence ("no ship, no commit") is a request an agent
// can miss under pressure; this plugin is the gate that holds whether or not the agent
// cooperates. Checked before the first tool call, not after. lpwr-amend additionally
// refuses post-ship edits (state Done or a matching commit subject) — amend is pre-commit
// only (implementation-rules 38). Commit also requires an upstream non-retain handoff
// in log.ndjson (the "Gate: upstream traceable work" rule on lpwr-commit).
const execFileAsync = promisify(execFile);

const readFileAt = async (root: string, relative: string): Promise<string> =>
  normalizeEol(await readFile(path.join(root, relative), "utf-8"));

// Strip a trailing YAML ` # …` comment (whitespace before `#` is required for
// it to be a comment in a plain scalar). Values keep their format-hint comments
// from the template; those must not become waived IDs or deferred entries.
const stripYamlComment = (value: string): string =>
  value.replace(/\s+#.*$/u, "").trim();

// Line-based frontmatter list reader: handles `key: value`, `key: [a, b]`,
// and `- item` lists. Stops at the next key, a blank-line boundary, or `---`.
// Inline comments on the value are stripped before the value is collected.
const sectionEntries = (fmBlock: string, key: string): string[] => {
  const entries: string[] = [];
  let inside = false;
  for (const line of fmBlock.split("\n")) {
    if (!inside) {
      const header = line.match(new RegExp(`^${key}:\\s*(?<rest>.*)$`, "iu"));
      const rest = stripYamlComment(header?.groups?.rest ?? "");
      if (header?.groups) {
        inside = true;
        if (rest && rest !== "[]" && rest !== "null" && rest !== "~") {
          entries.push(rest);
        }
      }
      continue;
    }
    const item = line.match(/^\s*-\s*(?<entry>.+)$/u);
    if (item?.groups) {
      const entry = stripYamlComment(item.groups.entry);
      if (entry) {
        entries.push(entry);
      }
      continue;
    }
    if (/^\s*$/u.test(line)) {
      continue;
    }
    break;
  }
  return entries;
};

const stripBrackets = (entry: string): string =>
  entry.replace(/^\[/u, "").replace(/\]$/u, "");

const isEmptyMarker = (token: string): boolean =>
  /^(?:none|null|~|-|\[\])$/iu.test(token);

const parseWaived = (fmBlock: string): Set<string> => {
  const ids = new Set<string>();
  for (const entry of sectionEntries(fmBlock, "waived")) {
    for (const id of stripBrackets(entry).split(/[\s,]+/u)) {
      if (id && !isEmptyMarker(id)) {
        ids.add(id);
      }
    }
  }
  return ids;
};

interface Deferred {
  targets: Map<string, string>;
  error?: string;
}

const parseDeferred = (fmBlock: string): Deferred => {
  const targets = new Map<string, string>();
  for (const entry of sectionEntries(fmBlock, "deferred")) {
    for (const chunk of stripBrackets(entry).split(/,/u)) {
      const trimmed = chunk.trim();
      if (!trimmed || isEmptyMarker(trimmed)) {
        continue;
      }
      const move = trimmed.match(/^(?<id>\S+)\s*->\s*(?<target>\S+)$/u);
      if (!move?.groups?.id || !move.groups.target) {
        return {
          error: `deferred entry "${trimmed}" must be "<criterion-id> -> <follow-up>"`,
          targets,
        };
      }
      targets.set(move.groups.id, move.groups.target);
    }
  }
  return { targets };
};

const rowCells = (row: string): string[] => {
  const parts = row.split("|").map((cell) => cell.trim());
  return parts.filter((_cell, index) => index > 0 && index < parts.length - 1);
};

const isPlaceholderRef = (ref: string): boolean =>
  /^\s*<.*>\s*$/u.test(ref) || /^\s*\(pending\)\s*$/iu.test(ref);

// Template scaffolding left unfilled (`<...>`) reads as real content to both
// humans and agents — a skeleton review must never gate anything. Inline
// comments (YAML ` # …`) and code spans document the field format with the
// same angle-bracket metavars as real slots; strip both first so only
// genuine unfilled placeholders count. Returns the first offender, capped,
// or null when the file is fully filled in.
const templateLeftovers = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const cleaned = line
      .replace(/\s+#\s.*$/u, "")
      .replaceAll(/`[^`\n]*`/gu, "");
    const match = cleaned.match(/<[A-Za-z][^<>\n]*>/u);
    if (match) {
      return match[0].slice(0, 80);
    }
  }
  return null;
};

const tableComplete = (review: string): { ok: boolean; reason?: string } => {
  const fmBlock = frontmatterBlock(review);
  const waived = fmBlock ? parseWaived(fmBlock) : new Set<string>();
  const deferred = fmBlock
    ? parseDeferred(fmBlock)
    : { targets: new Map<string, string>() };
  if (deferred.error) {
    return { ok: false, reason: deferred.error };
  }
  const rows = review.split("\n").filter((line) => line.trim().startsWith("|"));
  // Skip the header row.
  const data = rows.filter((line) => !/---/u.test(line)).slice(1);
  if (data.length === 0) {
    return { ok: false, reason: "specs axis table has no criterion rows" };
  }
  const seen = new Set<string>();
  for (const row of data) {
    const [criterion, testRef, pass] = rowCells(row);
    if (!criterion) {
      return {
        ok: false,
        reason: `table row without a criterion id: ${row.trim()}`,
      };
    }
    seen.add(criterion);
    if (testRef && isPlaceholderRef(testRef)) {
      return {
        ok: false,
        reason: `criterion ${criterion} cites a placeholder test reference: ${testRef.trim()}`,
      };
    }
    if (pass && /^yes$/iu.test(pass) && testRef) {
      continue;
    }
    if (waived.has(criterion) || deferred.targets.has(criterion)) {
      continue;
    }
    if (pass && /^(?<state>deferred|waived)$/iu.test(pass)) {
      return {
        ok: false,
        reason:
          `criterion ${criterion} is marked "${pass}" in the table but not listed ` +
          `under ${pass.toLowerCase()}: in the review frontmatter`,
      };
    }
    if (!testRef) {
      return {
        ok: false,
        reason: `criterion row lacks a test reference: ${row.trim()}`,
      };
    }
    return {
      ok: false,
      reason:
        `criterion not passing: ${row.trim()} — add a passing test reference ` +
        `or waive/defer it in the review frontmatter`,
    };
  }
  for (const id of [...waived, ...deferred.targets.keys()]) {
    if (!seen.has(id)) {
      return {
        ok: false,
        reason: `waiver lists unknown criterion ${id} — no such row in the specs table`,
      };
    }
  }
  return { ok: true };
};

// Checked boxes in a document's "## Verdict" section, in order of appearance.
// Templates put all options on one line (`- [ ] Ship  [ ] Block  [ ] Redirect`),
// so every box in the section is scanned — prose outside the section never counts.
const verdictChecked = (
  document: string,
  labels: readonly string[]
): { present: boolean; checked: string[] } => {
  const labelPattern = labels.join("|");
  const boxPattern = new RegExp(
    `\\[(?<mark>[ xX])\\]\\s*(?<label>${labelPattern})\\b`,
    "gu"
  );
  const lines = document.split("\n");
  let inside = false;
  const checked: string[] = [];
  for (const line of lines) {
    if (/^##\s+verdict/iu.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (!inside) {
      continue;
    }
    for (const match of line.matchAll(boxPattern)) {
      const { groups } = match;
      if (groups?.mark && groups.mark !== " " && groups.label) {
        checked.push(groups.label.toLowerCase());
      }
    }
  }
  return { checked, present: inside };
};

const verdictCheck = (review: string): { ok: boolean; reason?: string } => {
  const { present, checked } = verdictChecked(review, [
    "Ship",
    "Block",
    "Redirect",
  ]);
  if (!present) {
    return { ok: false, reason: "review.md has no Verdict section" };
  }
  if (checked.length === 0) {
    return {
      ok: false,
      reason: "no verdict recorded — tick exactly one of Ship/Block/Redirect",
    };
  }
  if (checked.length > 1) {
    return {
      ok: false,
      reason: `multiple verdicts ticked (${checked.join(", ")}) — exactly one allowed`,
    };
  }
  const [recorded] = checked;
  if (recorded !== "ship") {
    return {
      ok: false,
      reason: `no recorded "ship" verdict (recorded: ${recorded})`,
    };
  }
  return { ok: true };
};

// The Security axis must be fully checked — no unchecked boxes allowed.
// Reviews written before the axis existed fail here: re-render them with the
// current template rather than carrying an unchecked security posture forward.
const securityAxisComplete = (review: string): boolean => {
  const lines = review.split("\n");
  let inside = false;
  let checked = 0;
  for (const line of lines) {
    if (/^##\s+security axis/iu.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (!inside) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]")) {
      return false;
    }
    if (/^- \[[xX]\]/u.test(trimmed)) {
      checked += 1;
    }
  }
  return inside && checked > 0;
};

// Threat review must not merely exist — its own verdict has to accept proceeding
// (same content-aware standard as the ADR `status: accepted` design gate).
const threatAccepted = (threatReview: string): boolean => {
  const { present, checked } = verdictChecked(threatReview, [
    "Acceptable to proceed",
    "Needs changes before proceeding",
  ]);
  return (
    present && checked.length === 1 && checked[0] === "acceptable to proceed"
  );
};

// state.md section membership for a spec id (Blocked escalations, Done closures).
const stateHasEntry = async (
  root: string,
  section: string,
  specId: string
): Promise<boolean> => {
  let state: string;
  try {
    state = await readFileAt(root, "docs/state.md");
  } catch {
    return false;
  }
  const lines = state.split("\n");
  let inside = false;
  for (const line of lines) {
    if (new RegExp(`^##\\s+${section}\\b`, "iu").test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (
      inside &&
      new RegExp(`^- ${escapeRegExp(specId)}(?=[:\\s]|$)`, "u").test(
        line.trim()
      )
    ) {
      return true;
    }
  }
  return false;
};

// Post-ship detection for lpwr-amend: state Done (written by lpwr-commit) or a
// recent commit subject carrying the spec id (id boundary-aware — auth-014 never
// matches auth-0144).
const shippedInGit = async (root: string, specId: string): Promise<boolean> => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", root, "log", "--format=%s", "-n", "200"],
      { timeout: 5000 }
    );
    const boundary = new RegExp(
      `(^|[^a-z0-9-])${escapeRegExp(specId)}([^a-z0-9-]|$)`,
      "u"
    );
    return stdout.split("\n").some((subject) => boundary.test(subject));
  } catch {
    return false;
  }
};

const currentBranch = async (root: string): Promise<string | null> => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", root, "branch", "--show-current"],
      { timeout: 5000 }
    );
    const branch = stdout.trim();
    return SPEC_ID.test(branch) ? branch : null;
  } catch {
    return null;
  }
};

// Upstream-traceable-work gate (lpwr-commit step 2): the log must carry at
// least one non-retain handoff for this spec — a change with no upstream
// frame/specify/execute/verify/govern line is out-of-process work.
const hasNonRetainHandoff = async (
  root: string,
  specId: string
): Promise<boolean> => {
  let log: string;
  try {
    log = await readFileAt(root, `docs/specs/${specId}/log.ndjson`);
  } catch {
    return false;
  }
  for (const line of log.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as { intent?: string };
      if (entry.intent && entry.intent !== "retain") {
        return true;
      }
    } catch {
      // Skip malformed lines.
    }
  }
  return false;
};

// One enforcement path shared by /lpwr-commit, /lpwr-release, and a raw
// `git commit` on a spec-shaped branch — same checks, same messages.
const enforceVerdictGate = async (
  plugin: PluginInput,
  root: string,
  label: string,
  specId: string,
  options: { release: boolean }
): Promise<void> => {
  const review = await readFileAt(root, `docs/specs/${specId}/review.md`).catch(
    () => null
  );
  if (review === null) {
    block(
      plugin,
      `Blocked: no review.md for ${specId} — run lpwr-review first; no ship, no ${label}.`
    );
  }
  const leftover = templateLeftovers(review);
  if (leftover) {
    block(
      plugin,
      `Blocked: review.md for ${specId} still contains template placeholders (${leftover}) — fill every field first.`
    );
  }
  const verdict = verdictCheck(review);
  if (!verdict.ok) {
    block(plugin, `Blocked: ${specId} / ${label}: ${verdict.reason}.`);
  }
  const check = tableComplete(review);
  if (!check.ok) {
    block(plugin, `Blocked: ship claimed for ${specId} but ${check.reason}.`);
  }
  if (!securityAxisComplete(review)) {
    block(
      plugin,
      `Blocked: ship claimed for ${specId} but the Security axis is incomplete ` +
        `(missing section or unchecked box) — re-render review.md with the current template.`
    );
  }
  if (await stateHasEntry(root, "blocked", specId)) {
    block(
      plugin,
      `Blocked: spec ${specId} sits in docs/state.md's Blocked section — ` +
        `resolve the escalation before ${label}.`
    );
  }
  if (options.release && frontmatterValue(review, "risk_tier") === "high") {
    const threat = await readFileAt(
      root,
      `docs/specs/${specId}/threat-review.md`
    ).catch(() => null);
    if (threat === null) {
      block(
        plugin,
        `Blocked: ${specId} is high risk with no threat-review.md — ` +
          `run lpwr-threat-review before releasing.`
      );
    }
    if (!threatAccepted(threat)) {
      block(
        plugin,
        `Blocked: ${specId}'s threat-review.md has no single "Acceptable to proceed" ` +
          `verdict — resolve its findings before releasing.`
      );
    }
    const threatLeftover = templateLeftovers(threat);
    if (threatLeftover) {
      block(
        plugin,
        `Blocked: threat-review.md for ${specId} still contains template placeholders (${threatLeftover}) — fill every field first.`
      );
    }
  }
  // Gate: upstream traceable work (commit and raw git commit only — release
  // ships after commit, so the log is already populated by then).
  if (!options.release && !(await hasNonRetainHandoff(root, specId))) {
    block(
      plugin,
      `Blocked: ${specId}'s log.ndjson has no non-retain handoff — run the ` +
        `upstream domain command first (out-of-process work has no audit trail).`
    );
  }
};

const verdictGate = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      const name = commandName(input.command);
      if (name === "lpwr-amend") {
        const specId = firstArgument(input.arguments);
        if (!specId) {
          return;
        }
        if (!SPEC_ID.test(specId)) {
          block(
            plugin,
            `Blocked: "${specId}" is not a traceability ID ` +
              `(expected <domain>-<sequence>, lowercase, e.g. auth-014).`
          );
        }
        const done = await stateHasEntry(root, "done", specId);
        const committed = done ? true : await shippedInGit(root, specId);
        if (committed) {
          block(
            plugin,
            `Blocked: ${specId} already shipped — amend is pre-commit only. ` +
              `Route post-ship changes to a new spec naming ${specId} in supersedes:.`
          );
        }
        return;
      }
      if (name !== "lpwr-commit" && name !== "lpwr-release") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        block(plugin, `Blocked: /${name} requires a spec id.`);
      }
      if (!SPEC_ID.test(specId)) {
        block(
          plugin,
          `Blocked: "${specId}" is not a traceability ID ` +
            `(expected <domain>-<sequence>, lowercase, e.g. auth-014).`
        );
      }
      await enforceVerdictGate(plugin, root, name, specId, {
        release: name === "lpwr-release",
      });
    },
    "tool.execute.before": async (input, output) => {
      // Raw `git commit` through bash is the same Retain action as /lpwr-commit
      // — gated when (and only when) the branch names a spec. Off-spec branches
      // (bootstrap, harness development) stay ungated, mirroring lpwr-scope-guard's
      // active-spec model; the human's bash-ask checkpoint remains everywhere.
      if (input.tool !== "bash") {
        return;
      }
      const command: unknown = output.args.command;
      if (typeof command !== "string" || !looksLikeGitCommit(command)) {
        return;
      }
      const branch = await currentBranch(root);
      if (!branch) {
        return;
      }
      await enforceVerdictGate(plugin, root, "git commit", branch, {
        release: false,
      });
    },
  });
};

export default verdictGate;

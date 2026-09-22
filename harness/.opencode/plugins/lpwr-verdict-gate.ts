import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Mechanical verdict floor (implementation-rules 5/7): /lpwr-commit, /lpwr-release, and a
// raw `git commit` on a spec-shaped branch cannot run without a recorded "ship" whose
// acceptance table is complete — unless incomplete rows are explicitly waived or deferred
// in the review frontmatter. A prompt sentence ("no ship, no commit") is a request an agent
// can miss under pressure; this plugin is the gate that holds whether or not the agent
// cooperates. Checked before the first tool call, not after. lpwr-amend additionally
// refuses post-ship edits (state Done or a matching commit subject) — amend is pre-commit
// only (implementation-rules 38).
const execFileAsync = promisify(execFile);

const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/u;

const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

const normalizeEol = (raw: string): string => raw.replaceAll("\r\n", "\n");

const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&");

const readFileAt = async (root: string, relative: string): Promise<string> =>
  normalizeEol(await readFile(path.join(root, relative), "utf-8"));

// Line-based frontmatter list reader: handles `key: value`, `key: [a, b]`,
// and `- item` lists. Stops at the next key, a blank-line boundary, or `---`.
const sectionEntries = (block: string, key: string): string[] => {
  const entries: string[] = [];
  let inside = false;
  for (const line of block.split("\n")) {
    if (!inside) {
      const header = line.match(new RegExp(`^${key}:\\s*(?<rest>.*)$`, "iu"));
      const rest = header?.groups?.rest.trim() ?? "";
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
      entries.push(item.groups.entry.trim());
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

const parseWaived = (block: string): Set<string> => {
  const ids = new Set<string>();
  for (const entry of sectionEntries(block, "waived")) {
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

const parseDeferred = (block: string): Deferred => {
  const targets = new Map<string, string>();
  for (const entry of sectionEntries(block, "deferred")) {
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
// humans and agents — a skeleton review must never gate anything. Returns the
// first offending line, capped, or null when the file is fully filled in.
const templateLeftovers = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const match = line.match(/<[A-Za-z][^<>\n]*>/u);
    if (match) {
      return match[0].slice(0, 80);
    }
  }
  return null;
};

const frontmatterBlock = (review: string): string | null => {
  const match = review.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  return match?.groups?.frontmatter ?? null;
};

const tableComplete = (review: string): { ok: boolean; reason?: string } => {
  const block = frontmatterBlock(review);
  const waived = block ? parseWaived(block) : new Set<string>();
  const deferred = block
    ? parseDeferred(block)
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
    return { ok: false, reason: `criterion not passing: ${row.trim()}` };
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

const frontmatterValue = (review: string, key: string): string | null => {
  const block = frontmatterBlock(review);
  if (!block) {
    return null;
  }
  const line = block
    .split("\n")
    .find((candidate) => candidate.trim().toLowerCase().startsWith(`${key}:`));
  if (!line) {
    return null;
  }
  return (
    line.split(":").slice(1).join(":").split("#")[0].trim().toLowerCase() ||
    null
  );
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

// Any command segment that is a `git … commit` (cd/g -C prefixes, pipes, && chains).
// `commit-msg` and prose mentioning "commit" do not match.
const looksLikeGitCommit = (command: string): boolean => {
  const pattern = /^git(?:\s+\S+)*\s+commit(?:\s|$)/u;
  return command
    .split(/&&|\|\||;|\|/u)
    .some((segment) => pattern.test(segment.trim()));
};

// Every blockage raises a TUI toast with the same actionable message as the
// thrown error, then throws. The toast never breaks the gate: with no attached
// TUI (headless runs) the call is a harmless no-op, and any delivery failure is
// swallowed — the error below remains the record.
const toastBlocked = async (
  plugin: PluginInput,
  message: string
): Promise<void> => {
  try {
    await plugin.client.tui.showToast({
      body: { message, title: "Loopwright gate", variant: "error" },
      query: { directory: plugin.directory },
    });
  } catch {
    // Toast delivery is best-effort only.
  }
};

// Every blockage raises a TUI toast with the same actionable message as the
// thrown error, then throws. Typed as an explicit const (not an annotated
// arrow) so TypeScript's control-flow analysis treats every call as
// terminating — narrowing otherwise fails. The toast fires best-effort: with
// no attached TUI (headless runs) it is a harmless no-op, and any delivery
// failure is swallowed — the thrown error remains the record.
const block: (plugin: PluginInput, message: string) => never = (
  plugin,
  message
) => {
  void toastBlocked(plugin, message);
  throw new Error(message);
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
      `Blocked: no review.md for ${specId} — no ship, no ${label}.`
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
};

const verdictGate = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name === "lpwr-amend") {
        const specId = firstArgument(input.arguments);
        if (!specId) {
          return;
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

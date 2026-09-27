import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import {
  acceptanceTablesDiverge,
  constitutionCommands,
  securityAxisComplete,
  stateSectionHasEntry,
  tableComplete,
  templateLeftovers,
  threatAccepted,
  verdictCheck,
} from "../lib/gates.ts";
import {
  SPEC_ID,
  block,
  commandName,
  escapeRegExp,
  frontmatterBlock,
  frontmatterValue,
  looksLikeGitCommit,
  normalizeEol,
  runsDeclared,
  specIdArgument,
  toastWarning,
} from "../lib/shared.ts";

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

// Deploy gate (implementation-rules 8): the constitution's `Deploy command:`
// line declares what a deploy *is*; this window says when it may run — only
// inside an lpwr-release whose verdict gate has already passed. Tool hooks
// carry no agent identity, so the gate keys on the command's own window
// rather than on who is holding the shell. The window opens when the release
// gate passes, closes when any command finishes or the next command starts,
// and expires on its own so a crashed release cannot leave it open.
const RELEASE_WINDOW_MS = 10 * 60 * 1000;
let releaseWindowUntil = 0;

const readDeployCommand = async (root: string): Promise<string | null> => {
  try {
    const constitution = await readFileAt(root, "docs/constitution.md");
    return constitutionCommands(constitution, "deploy command")[0] ?? null;
  } catch {
    return null;
  }
};

// state.md section membership for a spec id (Blocked escalations, Done
// closures) — the file read, parsed by the shared gates parser.
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
  return stateSectionHasEntry(state, section, specId);
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

// Risk-tier carry-over (implementation-rules 39 + Round 2 A1): the review
// re-confirms the spec's tier, so both files must name the same tier — a
// mismatch (or a missing/unknown value on either side) means the review was
// rendered against the wrong spec version or the tier was edited in prose.
// Changing the tier travels through lpwr-amend (AGENTS rule 9), never the review
// frontmatter; strict equality keeps spec.md the single source of truth.
const TIER_VALUES = new Set(["low", "medium", "high"]);

const riskTierMismatch = (specRaw: string, review: string): string | null => {
  const specTier = frontmatterValue(specRaw, "risk_tier");
  const reviewTier = frontmatterValue(review, "risk_tier");
  const valid = (tier: string | null): tier is string =>
    tier !== null && TIER_VALUES.has(tier);
  if (valid(specTier) && valid(reviewTier) && specTier === reviewTier) {
    return null;
  }
  return `spec.md says "${specTier ?? "absent"}", review.md says "${reviewTier ?? "absent"}"`;
};

// One rev resolves iff `git rev-parse` names an existing commit — same
// timeout-bounded, failure-tolerant pattern as shippedInGit.
const resolvesRev = async (root: string, rev: string): Promise<boolean> => {
  if (rev.startsWith("-")) {
    return false;
  }
  try {
    await execFileAsync(
      "git",
      ["-C", root, "rev-parse", "--verify", "--quiet", `${rev}^{commit}`],
      { timeout: 5000 }
    );
    return true;
  } catch {
    return false;
  }
};

// diff_ref form check (Round 2 A2): the review must declare the diff it was
// rendered against. Commit runs pre-commit against the working tree, so the
// only accepted value is `HEAD (uncommitted)`; release additionally accepts a
// committed `<from>..<to>` / `<from>..` range whose endpoints resolve. The
// field is human-edited prose — this checks the form, not the bytes (diff
// hashing is explicitly out of scope).
// Case-preserving read: git refs are case-sensitive (`head~1` is not
// `HEAD~1`), so unlike frontmatterValue's lowercased view, diff_ref keeps its
// original casing on the way to `git rev-parse`.
const diffRefValue = (raw: string): string | null => {
  const fm = frontmatterBlock(raw);
  const line = fm
    ?.split("\n")
    .find((candidate) =>
      candidate.trim().toLowerCase().startsWith("diff_ref:")
    );
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim() || null;
};

const diffRefProblem = async (
  root: string,
  review: string,
  release: boolean
): Promise<string | null> => {
  const value = diffRefValue(review);
  if (!value) {
    return "review.md diff_ref is missing — re-run lpwr-review with the current template";
  }
  if (value.toLowerCase() === "head (uncommitted)") {
    return null;
  }
  if (!release) {
    return (
      `review.md diff_ref is "${value}" but must be "HEAD (uncommitted)" ` +
      `at commit — re-run lpwr-review against the change being committed`
    );
  }
  const range = value.match(/^(?<from>\S+)\.\.(?<to>\S*)$/u);
  const from = range?.groups?.from;
  if (!from) {
    return (
      `review.md diff_ref "${value}" is neither "HEAD (uncommitted)" ` +
      `nor a <from>..<to> commit range`
    );
  }
  const to = range?.groups?.to ?? "";
  const revs = to ? [from, to] : [from];
  const results = await Promise.all(revs.map((rev) => resolvesRev(root, rev)));
  const bad = results.findIndex((ok) => !ok);
  if (bad !== -1) {
    return (
      `review.md diff_ref "${value}" names an unresolvable revision ` +
      `"${revs[bad]}" — use HEAD (uncommitted) or the shipped range`
    );
  }
  return null;
};

// Low-confidence advisory (Round 2 A4): `confidence` carries a written rubric
// ("high only with a passing check behind the claim") on every handoff line;
// surface low-confidence work once at the commit gate so the human can
// confirm before ship. Advisory only — never blocks; commit path only, since
// release runs after commit and would double-toast.
const lowConfidenceAdvisory = async (
  plugin: PluginInput,
  root: string,
  specId: string
): Promise<void> => {
  let log: string;
  try {
    log = await readFileAt(root, `docs/specs/${specId}/log.ndjson`);
  } catch {
    return;
  }
  const low: string[] = [];
  for (const line of log.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const entry = JSON.parse(line) as {
        intent?: string;
        confidence?: string;
        ts?: string;
      };
      if (entry.confidence === "low") {
        low.push(`${entry.intent ?? "?"}@${entry.ts ?? "?"}`);
      }
    } catch {
      // Skip malformed lines.
    }
  }
  if (low.length === 0) {
    return;
  }
  const shown = low.slice(0, 5).join(", ");
  const more = low.length > 5 ? `, +${low.length - 5} more` : "";
  await toastWarning(
    plugin,
    `${low.length} low-confidence handoff(s) in ${specId}: ${shown}${more} — ` +
      `confirm before ship.`
  );
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
  // Round 2 cross-file checks (A1 tier carry-over, A2 diff basis): both run
  // before the high-tier threat gate so a mismatch can't be dodged by editing
  // review.md first; after equality holds, the threat check reading review.md
  // is safe unchanged.
  const specRaw = await readFileAt(root, `docs/specs/${specId}/spec.md`).catch(
    () => null
  );
  if (specRaw === null) {
    block(
      plugin,
      `Blocked: no spec.md for ${specId} — cannot verify review.md's ` +
        `risk_tier against it (check the ID or run lpwr-specs).`
    );
  }
  const tier = riskTierMismatch(specRaw, review);
  if (tier) {
    block(
      plugin,
      `Blocked: risk_tier mismatch for ${specId} — ${tier} — carry the tier ` +
        `over, or change it via lpwr-amend (AGENTS rule 9), then re-review.`
    );
  }
  // The tables are the review's only binding to the spec it reviewed — no
  // hash or timestamp ties the two files. A mismatch means spec.md moved
  // after the review was rendered: re-review, or amend first if the spec
  // itself is what changed.
  const divergence = acceptanceTablesDiverge(specRaw, review);
  if (divergence) {
    block(
      plugin,
      `Blocked: spec.md and review.md disagree for ${specId} — ${divergence}. ` +
        `Re-run lpwr-review against the current spec (or lpwr-amend if the ` +
        `spec itself changed, then re-review).`
    );
  }
  const diffProblem = await diffRefProblem(root, review, options.release);
  if (diffProblem) {
    block(plugin, `Blocked: ${specId} / ${label}: ${diffProblem}.`);
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
  if (!options.release) {
    await lowConfidenceAdvisory(plugin, root, specId);
  }
};

const verdictGate = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      const name = commandName(input.command);
      // Every new command closes any release window still open — a crashed or
      // never-completed lpwr-release must not leave deploy unguarded.
      if (name !== "lpwr-release") {
        releaseWindowUntil = 0;
      }
      if (name === "lpwr-amend") {
        const specId = specIdArgument(input.arguments);
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
      const specId = specIdArgument(input.arguments);
      if (!specId) {
        // specIdArgument only returns SPEC_ID-shaped tokens, so a malformed id
        // lands here too — one message names the expected shape.
        block(
          plugin,
          `Blocked: /${name} requires a traceability ID ` +
            `(<domain>-<sequence>, lowercase, e.g. auth-014).`
        );
      }
      await enforceVerdictGate(plugin, root, name, specId, {
        release: name === "lpwr-release",
      });
      if (name === "lpwr-release") {
        // The deploy steps run inside this command, delegated to workers whose
        // bash stays ask-gated — the bash hook below keys on this window.
        releaseWindowUntil = Date.now() + RELEASE_WINDOW_MS;
      }
    },
    event: (input) => {
      if (input.event.type === "command.executed") {
        releaseWindowUntil = 0;
      }
      return Promise.resolve();
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") {
        return;
      }
      const command: unknown = output.args.command;
      if (typeof command !== "string") {
        return;
      }
      // Deploy gate (implementation-rules 8): the constitution declares what
      // a deploy is, the release window says when it may run. No declared
      // command means nothing to gate — the human's bash-ask stays the floor.
      const deploy = await readDeployCommand(root);
      if (deploy !== null && runsDeclared(command, deploy)) {
        if (Date.now() >= releaseWindowUntil) {
          block(
            plugin,
            `Blocked: deploy command \`${deploy}\` may only run inside ` +
              `lpwr-release (implementation-rules 8) — run /lpwr-release <id> ` +
              `on a recorded ship verdict. If that shell line was not a ` +
              `deploy, change the \`Deploy command:\` line in ` +
              `docs/constitution.md.`
          );
        }
        return;
      }
      // Raw `git commit` through bash is the same Retain action as /lpwr-commit
      // — gated when (and only when) the branch names a spec. Branches with no
      // spec ID (bootstrap, harness development) stay ungated, mirroring lpwr-scope-guard's
      // active-spec model; the human's bash-ask checkpoint remains everywhere.
      if (!looksLikeGitCommit(command)) {
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

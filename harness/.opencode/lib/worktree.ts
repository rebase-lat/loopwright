// Per-spec worktree lifecycle service (implementation-rules 2/29/49/50/51/52).
// Everything the harness does to a spec worktree lives here — minting
// (branch + worktree + foundation provisioning + spec-folder move), status,
// the cap, pruning (shipped or pending-cleanup, force behind a human
// confirmation), and the pending-cleanup manifest `lpwr-commit` writes.
// `plugins/lpwr-worktree-guard.ts` is the thin adapter: command gates, the
// three tools trunk commands call, and the `lpwr-commit` completion event.
//
// The shared import below uses an explicit `.ts` specifier on purpose:
// `node --test` loads this module directly for the worktree fixtures, and
// plain Node cannot resolve the plugins' `./shared.js` NodeNext specifiers
// to `.ts` (Bun, which runs opencode, resolves both spellings).

import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { PluginInput } from "@opencode-ai/plugin";

import type { WorktreeInfo } from "./shared.ts";
import {
  SPEC_ID,
  escapeRegExp,
  logError,
  logInfo,
  logWarn,
  parseWorktreeList,
  toastWarning,
  trunkBranch,
  worktreeList,
} from "./shared.ts";

// Re-exported so service consumers (and the test fixtures) import the worktree
// vocabulary from one module.
export type { WorktreeInfo } from "./shared.ts";

const execFileAsync = promisify(execFile);

// Structured-log service name — one name for the adapter and the service so
// `client.app.log` consumers see a single worktree stream.
export const SERVICE = "lpwr-worktree-guard";

// Rule 29's default. Raised per project via LPWR_MAX_WORKTREES (fast override)
// or `"lpwr": { "max_worktrees": N }` in opencode.json — never by editing code.
export const DEFAULT_CAP = 2;

// Pending-cleanup manifest, trunk-owned and gitignored (harness/.gitignore):
// lpwr-commit records its worktree here on completion so pruning never waits
// for a future lpwr-propose (implementation-rules 52).
const MANIFEST_DIR = ".loop-worktrees";
const manifestPath = (mainHarness: string): string =>
  path.join(mainHarness, MANIFEST_DIR, "manifest.json");

export interface Orientation {
  sessionRoot: string;
  mainRoot: string;
  mainHarness: string;
  harnessRel: string;
  isTrunk: boolean;
}

export interface OpenWorktree {
  id: string;
  path: string;
  branch: string | null;
  shipped: boolean;
  dirty: boolean;
  pending: boolean;
  own: boolean;
}

export interface CapStatus {
  open: number;
  cap: number;
  atCap: boolean;
  entries: OpenWorktree[];
}

export interface PruneOptions {
  force?: boolean;
  // Called before every force removal — the adapter raises the human
  // permission confirmation here (implementation-rules 52).
  confirm?: (entry: OpenWorktree) => Promise<boolean>;
}

export interface PruneDecision {
  action: "remove" | "skip";
  reason: string;
  needsForce?: boolean;
}

const execGit = async (cwd: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 15_000,
  });
  return stdout.trim();
};

// Exposed for the adapter's squash-merge preflight — one git runner, one
// timeout policy (the guard previously kept its own copy).
export const git = execGit;

const exists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
};

// --- Orientation -----------------------------------------------------------

export const orientation = async (root: string): Promise<Orientation> => {
  const sessionRoot = path.resolve(
    await git(root, ["rev-parse", "--show-toplevel"])
  );
  // The main worktree always owns .git as a directory; --git-common-dir
  // points at it from any linked worktree (relative to cwd or absolute).
  const commonDir = await git(root, ["rev-parse", "--git-common-dir"]);
  const mainRoot = path.dirname(path.resolve(root, commonDir));
  const harnessRel = path.relative(sessionRoot, root).replaceAll("\\", "/");
  return {
    harnessRel,
    isTrunk: sessionRoot === mainRoot,
    mainHarness: path.join(mainRoot, harnessRel),
    mainRoot,
    sessionRoot,
  };
};

// --- Pure predicates (unit-tested against fixtures) ------------------------

export const specIdOfWorktree = (wt: WorktreeInfo): string | null => {
  if (wt.branch && SPEC_ID.test(wt.branch)) {
    return wt.branch;
  }
  const base = path.basename(wt.path);
  return SPEC_ID.test(base) ? base : null;
};

export const findWorktree = (
  worktrees: WorktreeInfo[],
  specId: string
): WorktreeInfo | null =>
  worktrees.find((wt) => specIdOfWorktree(wt) === specId) ?? null;

// state.md section membership (Done closures) — same shape as
// lpwr-verdict-gate's check; section is matched case-insensitively.
export const stateHasEntry = async (
  harnessDir: string,
  section: string,
  specId: string
): Promise<boolean> => {
  let state: string;
  try {
    state = await readFile(path.join(harnessDir, "docs/state.md"), "utf-8");
  } catch {
    return false;
  }
  let inside = false;
  for (const line of state.split("\n")) {
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

// Cap (rule 29): env wins (fast override, headless-safe), then the harness's
// opencode.json, then the default. Unreadable config falls back silently —
// the cap must never be the reason a session fails to start. Resolved on
// every cap check, so editing either source mid-session takes effect from the
// next command, no restart.
// Minimal JSONC tolerance: comments and trailing commas, both string-aware so
// `"https://…"` and `"a,b"` pass through untouched.
const stripJsoncComments = (raw: string): string => {
  let out = "";
  let inString = false;
  let escaped = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw.charAt(i);
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "/" && raw.charAt(i + 1) === "/") {
      while (i < raw.length && raw.charAt(i) !== "\n") {
        i += 1;
      }
      continue;
    }
    if (ch === "/" && raw.charAt(i + 1) === "*") {
      i += 2;
      while (
        i < raw.length &&
        !(raw.charAt(i) === "*" && raw.charAt(i + 1) === "/")
      ) {
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
};

const stripTrailingCommas = (raw: string): string => {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw.charAt(i);
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < raw.length && /\s/u.test(raw.charAt(j))) {
        j += 1;
      }
      if (raw.charAt(j) === "}" || raw.charAt(j) === "]") {
        continue;
      }
    }
    out += ch;
  }
  return out;
};

const stripJsonc = (raw: string): string =>
  stripTrailingCommas(stripJsoncComments(raw));

export const resolveCap = async (root: string): Promise<number> => {
  const fromEnv = Math.trunc(Number(process.env.LPWR_MAX_WORKTREES ?? ""));
  if (Number.isInteger(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  try {
    const raw = await readFile(path.join(root, "opencode.json"), "utf-8");
    const cfg = JSON.parse(stripJsonc(raw)) as {
      lpwr?: { max_worktrees?: unknown };
    };
    const configured = cfg.lpwr?.max_worktrees;
    if (
      typeof configured === "number" &&
      Number.isInteger(configured) &&
      configured > 0
    ) {
      return configured;
    }
  } catch {
    // Unreadable or unparsable config — default applies.
  }
  return DEFAULT_CAP;
};

// --- Pending-cleanup manifest ----------------------------------------------

export const readManifest = async (
  mainHarness: string
): Promise<Record<string, string>> => {
  try {
    const raw = await readFile(manifestPath(mainHarness), "utf-8");
    const parsed = JSON.parse(raw) as { pending?: unknown };
    if (!parsed.pending || typeof parsed.pending !== "object") {
      return {};
    }
    return { ...(parsed.pending as Record<string, string>) };
  } catch {
    return {};
  }
};

// Called from the adapter's `command.executed` event for lpwr-commit. Marked
// only when state.md already records Done — that is the commit's own
// single-writer step (implementation-rules 19), so a commit that failed
// before reconciliation never marks its worktree closable.
export const markPendingCleanup = async (
  mainHarness: string,
  specId: string
): Promise<boolean> => {
  if (!SPEC_ID.test(specId)) {
    return false;
  }
  if (!(await stateHasEntry(mainHarness, "done", specId))) {
    return false;
  }
  const pending = await readManifest(mainHarness);
  if (pending[specId]) {
    return false;
  }
  pending[specId] = new Date().toISOString();
  const target = manifestPath(mainHarness);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify({ pending, version: 1 }, null, 2)}\n`,
    "utf-8"
  );
  return true;
};

const clearPending = async (
  mainHarness: string,
  specId: string
): Promise<void> => {
  const pending = await readManifest(mainHarness);
  if (!pending[specId]) {
    return;
  }
  const next = Object.fromEntries(
    Object.entries(pending).filter(([key]) => key !== specId)
  );
  const target = manifestPath(mainHarness);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    `${JSON.stringify({ pending: next, version: 1 }, null, 2)}\n`,
    "utf-8"
  );
};

// Hygiene for `lpwr-worktree-prune`: drop pending marks whose worktree no
// longer exists (removed outside the service, or an interrupted earlier run).
// The enumeration is strict on purpose — when git cannot list worktrees the
// sweep skips entirely instead of misreading every key as stale. Only the
// mutating prune path sweeps: lpwr-guide stays read-only by construction
// (rule 34). Designed never to throw.
const sweepStaleMarks = async (
  plugin: PluginInput,
  mainHarness: string,
  mainRoot: string
): Promise<void> => {
  const pending = await readManifest(mainHarness);
  const keys = Object.keys(pending);
  if (keys.length === 0) {
    return;
  }
  let live: Set<string>;
  try {
    const parsed = parseWorktreeList(
      await git(mainRoot, ["worktree", "list", "--porcelain"])
    );
    live = new Set(
      parsed.map(specIdOfWorktree).filter((id): id is string => id !== null)
    );
  } catch {
    return;
  }
  const stale = keys.filter((id) => !live.has(id));
  if (stale.length === 0) {
    return;
  }
  const next = Object.fromEntries(
    Object.entries(pending).filter(([id]) => live.has(id))
  );
  try {
    const target = manifestPath(mainHarness);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      target,
      `${JSON.stringify({ pending: next, version: 1 }, null, 2)}\n`,
      "utf-8"
    );
    logInfo(
      plugin,
      SERVICE,
      `cleared stale pending-cleanup mark(s): ${stale.join(", ")} (worktree no longer registered)`
    );
  } catch (error) {
    logWarn(
      plugin,
      SERVICE,
      `could not sweep stale pending-cleanup marks: ${String(error)}`
    );
  }
};

// --- Prune contract ---------------------------------------------------------

const prunable = (entry: OpenWorktree): boolean =>
  !entry.own && (entry.shipped || entry.pending) && !entry.dirty;

// Pure decision (implementation-rules 52): force is the human-confirmed
// escape that overrides both eligibility and dirt; without it only shipped
// (state Done) or pending-cleanup worktrees that are clean close themselves,
// and never the worktree the caller's own session runs from.
export const pruneDecision = (
  entry: OpenWorktree,
  options: { force?: boolean } = {}
): PruneDecision => {
  if (entry.own) {
    return {
      action: "skip",
      reason: "this session runs from it — quit this session first",
    };
  }
  if (options.force) {
    return { action: "remove", reason: "force (human-confirmed)" };
  }
  if (!entry.shipped && !entry.pending) {
    return {
      action: "skip",
      reason:
        "neither shipped (Done in docs/state.md) nor pending cleanup — force after confirmation to drop it",
    };
  }
  if (entry.dirty) {
    return {
      action: "skip",
      needsForce: true,
      reason:
        "local changes — review, then force-remove after confirmation (lpwr-worktree-prune)",
    };
  }
  let reason = "pending cleanup";
  if (entry.shipped) {
    reason = entry.pending ? "shipped + pending cleanup" : "shipped";
  }
  return { action: "remove", reason };
};

// Cap block (rule 29). Error messages name every in-band way out — the prune
// command is the self-service path; the manual `git worktree remove` escape
// stays documented in implementation-rules 29, not shouted in-band.
export const capBlocked = (open: number, cap: number): string =>
  `Blocked: ${open} worktrees already open (cap ${cap}, rule 29). Resume an ` +
  `open spec's session, run lpwr-worktree-prune to close shipped or ` +
  `pending-cleanup worktrees, or mark a shipped spec Done in docs/state.md ` +
  `so the next lpwr-propose prunes it, then retry.`;

export const statusReport = (status: CapStatus): string => {
  const lines = status.entries.map(
    (entry) =>
      `${entry.id} — ${entry.shipped ? "shipped" : "in flight"}, ` +
      `${entry.dirty ? "dirty" : "clean"}` +
      `${entry.pending ? ", pending cleanup" : ""}` +
      `${prunable(entry) ? ", prunable" : ""}` +
      `${entry.own ? ", this session" : ""}`
  );
  let capNote = "";
  if (status.atCap) {
    const anyPrunable = status.entries.some(prunable);
    capNote = anyPrunable
      ? ` Worktree cap reached (max: ${status.cap}): run ` +
        `lpwr-worktree-prune to close the prunable worktree(s) before ` +
        `minting another.`
      : ` Worktree cap reached (max: ${status.cap}): none are prunable — ` +
        `resume an open worktree's session, force-prune a dirty one after ` +
        `confirmation, or mark a shipped spec Done in docs/state.md.`;
  }
  const listing = lines.length > 0 ? ` — ${lines.join("; ")}` : "";
  return `Worktree status: ${status.open}/${status.cap} open${listing}.${capNote}`;
};

// --- Merge preflight (rule 51) ---------------------------------------------

// Trunk-dirty files allowed to sit uncommitted at the squash-merge, declared
// as data: the lpwr-commit contract (step 6) stages exactly these tails into
// the squash so trunk goes clean. Everything else either blocks the merge
// forever (unstaged/untracked changes git tolerates, so nothing else ever
// clears them) or silently rides an unrelated file into an ID-tagged commit
// (staged). Untracked copies under docs/specs/ — stale phantom journals —
// block by design (Round 6 S6-07). Add an entry here when a command gains a
// new file that must survive trunk-dirty until its own squash; the contract
// itself is written down in implementation-rules 51.
export interface TailAllowance {
  pattern: RegExp;
  note: string;
}

export const TAIL_ALLOWED: TailAllowance[] = [
  {
    note: "journal tails appended by lpwr-release / lpwr-teach after their own commits",
    pattern: /^docs\/specs\/[^/]+\/log\.ndjson$/u,
  },
];

// `status --porcelain` reports repo-root-relative paths; the harness may sit
// in a subdirectory (nested dev layout), so strip the harness prefix before
// matching tails — the same anchor lpwr-scope-guard matches from (Round 5
// S5-01 class). Display keeps the raw paths.
export const mergeBlockingFiles = (
  status: string,
  harnessRel: string,
  allowed: TailAllowance[] = TAIL_ALLOWED
): string[] => {
  const allows = (relative: string): boolean =>
    allowed.some(({ pattern }) => pattern.test(relative));
  const blocking: string[] = [];
  for (const line of status.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const state = line.slice(0, 2);
    const file = line.slice(3);
    const relative =
      harnessRel !== "" && file.startsWith(`${harnessRel}/`)
        ? file.slice(harnessRel.length + 1)
        : file;
    if (state[1] !== " ") {
      if (state === " M" && allows(relative)) {
        continue;
      }
      blocking.push(`${state} ${file}`);
      continue;
    }
    if (state !== "??" && allows(relative)) {
      continue;
    }
    blocking.push(`${state} ${file}`);
  }
  return blocking;
};

// --- Harness dirs across worktrees (rule 50) --------------------------------

// Every harness dir this project has: trunk's first, then each open
// worktree's copy at the same subpath (harness/ sits one level in on a
// nested layout, at the root otherwise).
export const harnessDirs = async (root: string): Promise<string[]> => {
  const o = await orientation(root);
  const all = await worktreeList(o.mainRoot);
  return [
    o.mainHarness,
    ...all
      .filter((wt) => path.resolve(wt.path) !== o.mainRoot)
      .map((wt) => path.join(wt.path, o.harnessRel)),
  ];
};

// --- Provisioning -----------------------------------------------------------

// Which command fixes a missing link target, so every gap warning names the
// next action instead of the plumbing.
const gapHint = (target: string): string =>
  target.includes("node_modules") ||
  target.endsWith("package.json") ||
  target.endsWith("package-lock.json")
    ? "run lpwr-setup"
    : "run lpwr-install";

const linkIfMissing = async (
  plugin: PluginInput,
  target: string,
  linkPath: string
): Promise<string | null> => {
  if (await exists(linkPath)) {
    return null;
  }
  if (!(await exists(target))) {
    const message =
      `missing link target ${target} (${gapHint(target)}) — ` +
      `${linkPath} not created`;
    logWarn(plugin, SERVICE, message);
    return message;
  }
  await mkdir(path.dirname(linkPath), { recursive: true });
  try {
    await symlink(target, linkPath);
    return null;
  } catch (error) {
    const message = `symlink failed: ${linkPath} -> ${target}: ${String(error)}`;
    logWarn(plugin, SERVICE, message);
    return message;
  }
};

const copyDir = async (src: string, dst: string): Promise<void> => {
  await mkdir(dst, { recursive: true });
  // oxlint-disable-next-line no-await-in-loop -- recursive copy descends depth-first by design
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      // oxlint-disable-next-line no-await-in-loop -- subtree copies in order, one directory at a time
      await copyDir(from, to);
    } else if (entry.isFile()) {
      // oxlint-disable-next-line no-await-in-loop -- writes are bounded by the spec folder size
      await copyFile(from, to);
    }
  }
};

// Gitignored trunk files shared into every worktree — one physical copy each
// so state.md's single-writer rule (lpwr-commit) survives parallel specs.
// docs/memos (no extension) joins the same way: trunk-owned, one physical
// copy, never part of a branch diff (rule 49 pattern). lpwr-install creates
// every target — a missing target is a foundation gap (EXPECTED, surfaced by
// lpwr-check-setup and the TUI sidebar), warned here, never silently patched.
const FOUNDATION = ["state", "context", "constitution", "audit"];

const provision = async (
  plugin: PluginInput,
  options: {
    mainRoot: string;
    mainHarness: string;
    worktreeHarness: string;
    worktreeRoot: string;
    specId: string;
  }
): Promise<void> => {
  const { mainRoot, mainHarness, worktreeHarness, worktreeRoot, specId } =
    options;
  // .opencode/.gitignore carries the node_modules/package.json ignore rules
  // and may be untracked — without it the provisioning links below would
  // show up as untracked files in the spec's diff grouping.
  const gitignoreFrom = path.join(mainHarness, ".opencode/.gitignore");
  const gitignoreTo = path.join(worktreeHarness, ".opencode/.gitignore");
  try {
    await mkdir(path.dirname(gitignoreTo), { recursive: true });
    await copyFile(gitignoreFrom, gitignoreTo);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logInfo(
        plugin,
        SERVICE,
        `no ${gitignoreFrom} to copy — trunk carries no local .opencode/.gitignore`
      );
    } else {
      logError(
        plugin,
        SERVICE,
        `could not copy ${gitignoreFrom} to ${gitignoreTo}: ${String(error)}`
      );
    }
  }
  const links: [string, string][] = [
    [
      path.join(mainHarness, ".opencode/node_modules"),
      path.join(worktreeHarness, ".opencode/node_modules"),
    ],
    [
      path.join(mainHarness, ".opencode/package.json"),
      path.join(worktreeHarness, ".opencode/package.json"),
    ],
    [
      path.join(mainHarness, ".opencode/package-lock.json"),
      path.join(worktreeHarness, ".opencode/package-lock.json"),
    ],
    [
      path.join(mainHarness, "docs/memos"),
      path.join(worktreeHarness, "docs/memos"),
    ],
    [
      path.join(mainRoot, "node_modules"),
      path.join(worktreeRoot, "node_modules"),
    ],
    ...FOUNDATION.map(
      (name) =>
        [
          path.join(mainHarness, `docs/${name}.md`),
          path.join(worktreeHarness, `docs/${name}.md`),
        ] as [string, string]
    ),
  ];
  const results = await Promise.all(
    links.map(([target, linkPath]) => linkIfMissing(plugin, target, linkPath))
  );
  const gaps = results.filter((gap): gap is string => gap !== null);
  if (gaps.length > 0) {
    void toastWarning(
      plugin,
      `Worktree ${specId}: ${gaps.length} foundation link(s) not created — ${gaps.join("; ")}`
    );
  }
  const envPath = path.join(worktreeHarness, ".env");
  if (!(await exists(envPath))) {
    try {
      await writeFile(envPath, `OPENCODE_SPEC_ID=${specId}\n`);
    } catch (error) {
      // W5: the fallback is real (branch-derived ID), but the failure must be
      // visible — toast for the session, structured log for the record.
      const message = `could not write ${envPath}: ${String(error)} — branch-derived spec ID still applies`;
      logWarn(plugin, SERVICE, message);
      void toastWarning(plugin, `Worktree ${specId}: ${message}`);
    }
  }
};

// Proposal/spec files were written in trunk before the handoff — move the
// folder into the new worktree so trunk never carries a diverging copy.
const moveSpecFolder = async (
  plugin: PluginInput,
  from: string,
  to: string
): Promise<void> => {
  if (!(await exists(from)) || (await exists(to))) {
    return;
  }
  await copyDir(from, to);
  const copied = await readdir(to);
  if (copied.length === 0) {
    logWarn(plugin, SERVICE, `copy of ${from} came up empty — left in place`);
    return;
  }
  await rm(from, { force: true, recursive: true });
};

// --- Service ----------------------------------------------------------------

export interface WorktreeService {
  // Creates branch + worktree beside the project, provisions foundation
  // links, moves docs/specs/<id>/ in; returns the worktree's harness dir
  // (where opencode restarts) or "" when the worktree already exists.
  // Throws on cap, non-trunk session, or detached HEAD.
  mint: (specId: string) => Promise<string>;
  // One worktree, or every eligible one when specId is omitted. Force
  // removals call `confirm` first (the adapter's permission gate).
  // Returns a per-worktree report.
  prune: (specId?: string, options?: PruneOptions) => Promise<string>;
  listOpen: () => Promise<OpenWorktree[]>;
  capStatus: () => Promise<CapStatus>;
}

export const createWorktreeService = (
  plugin: PluginInput,
  root: string = plugin.directory
): WorktreeService => {
  const isClean = async (worktree: string): Promise<boolean> => {
    try {
      return (await git(worktree, ["status", "--porcelain"])) === "";
    } catch {
      // Unreadable status is never "clean" — conservative for removals.
      return false;
    }
  };

  const listOpen = async (): Promise<OpenWorktree[]> => {
    const o = await orientation(root);
    const all = await worktreeList(o.mainRoot);
    const pending = await readManifest(o.mainHarness);
    const open = all.filter((wt) => path.resolve(wt.path) !== o.mainRoot);
    return Promise.all(
      open.map(async (wt) => {
        const id = specIdOfWorktree(wt) ?? path.basename(wt.path);
        return {
          branch: wt.branch,
          dirty: !(await isClean(wt.path)),
          id,
          own: path.resolve(wt.path) === o.sessionRoot,
          path: wt.path,
          pending: Boolean(pending[id]),
          shipped: await stateHasEntry(o.mainHarness, "done", id),
        };
      })
    );
  };

  const capStatus = async (): Promise<CapStatus> => {
    const [entries, cap] = await Promise.all([listOpen(), resolveCap(root)]);
    return {
      atCap: entries.length >= cap,
      cap,
      entries,
      open: entries.length,
    };
  };

  const mint = async (specId: string): Promise<string> => {
    if (!SPEC_ID.test(specId)) {
      throw new Error(
        `Refused: "${specId}" is not a traceability ID (expected ` +
          `<domain>-<sequence>, lowercase, e.g. auth-014).`
      );
    }
    const o = await orientation(root);
    const existing = findWorktree(await worktreeList(o.mainRoot), specId);
    if (existing) {
      return "";
    }
    if (!o.isTrunk) {
      throw new Error(
        `Refused: minting runs from the trunk session — this session sits ` +
          `in ${o.sessionRoot}.`
      );
    }
    const { open, cap } = await capStatus();
    if (open >= cap) {
      throw new Error(capBlocked(open, cap));
    }
    const branch = await trunkBranch(root);
    if (!branch) {
      throw new Error(
        "Refused: trunk is on a detached HEAD — check out a branch in the " +
          "main worktree before minting a spec."
      );
    }
    const worktreeRoot = path.join(path.dirname(o.mainRoot), specId);
    await git(o.mainRoot, [
      "worktree",
      "add",
      "-b",
      specId,
      worktreeRoot,
      branch,
    ]);
    const worktreeHarness = path.join(worktreeRoot, o.harnessRel);
    await provision(plugin, {
      mainHarness: o.mainHarness,
      mainRoot: o.mainRoot,
      specId,
      worktreeHarness,
      worktreeRoot,
    });
    await moveSpecFolder(
      plugin,
      path.join(o.mainHarness, "docs/specs", specId),
      path.join(worktreeHarness, "docs/specs", specId)
    );
    logInfo(
      plugin,
      SERVICE,
      `minted ${specId}: branch + worktree at ${worktreeRoot}`
    );
    // Report the harness directory, not the worktree root: that is where
    // opencode must be restarted (harness/ contents sit one level in when the
    // repo carries them in a subdirectory; at the root they coincide).
    return worktreeHarness;
  };

  const removeWorktree = async (
    o: Orientation,
    entry: OpenWorktree,
    gitForce: boolean
  ): Promise<string> => {
    try {
      await git(o.mainRoot, [
        "worktree",
        "remove",
        ...(gitForce ? ["--force"] : []),
        entry.path,
      ]);
    } catch (error) {
      const message = `could not remove ${entry.path}: ${String(error)}`;
      logWarn(plugin, SERVICE, message);
      return `failed ${entry.id}: ${message}`;
    }
    // The worktree is gone — the mark is fulfilled regardless of what the
    // branch does next, so the manifest never keeps a key for a removed tree.
    await clearPending(o.mainHarness, entry.id);
    if (entry.branch && SPEC_ID.test(entry.branch)) {
      try {
        await git(o.mainRoot, ["branch", "-D", entry.branch]);
      } catch (error) {
        logWarn(
          plugin,
          SERVICE,
          `worktree ${entry.id} removed but branch deletion failed: ${String(error)}`
        );
        return `${entry.id} worktree removed; branch deletion failed: ${String(error)}`;
      }
    }
    return entry.id;
  };

  const prune = async (
    specId?: string,
    options: PruneOptions = {}
  ): Promise<string> => {
    const o = await orientation(root);
    const entries = await listOpen();
    // Housekeeping first, on every path (including the early returns below):
    // marks for worktrees that no longer exist are dropped here, since only
    // this mutating command may write the manifest.
    await sweepStaleMarks(plugin, o.mainHarness, o.mainRoot);
    const targets =
      specId === undefined
        ? entries
        : entries.filter((entry) => entry.id === specId);
    if (specId !== undefined && targets.length === 0) {
      return `No open worktree for ${specId}.`;
    }
    if (targets.length === 0) {
      return "No open worktrees.";
    }
    const lines: string[] = [];
    // oxlint-disable-next-line no-await-in-loop -- prunes one worktree at a time so a failure never races the next removal
    for (const entry of targets) {
      const decision = pruneDecision(entry, options);
      if (decision.action === "skip") {
        lines.push(`skipped ${entry.id}: ${decision.reason}`);
        if (entry.shipped && entry.dirty && !options.force) {
          void toastWarning(
            plugin,
            `${entry.id} is shipped but its worktree has local changes (${entry.path}) — review, then prune it with lpwr-worktree-prune (force).`
          );
        }
        continue;
      }
      if (options.force) {
        let confirmed = false;
        if (options.confirm) {
          try {
            // oxlint-disable-next-line no-await-in-loop -- the confirmation gates this removal before the next entry is considered
            confirmed = await options.confirm(entry);
          } catch {
            confirmed = false;
          }
        }
        if (!confirmed) {
          lines.push(`skipped ${entry.id}: force-removal not confirmed`);
          continue;
        }
      }
      // oxlint-disable-next-line no-await-in-loop -- removal completes before the next entry is considered
      const removed = await removeWorktree(
        o,
        entry,
        Boolean(options.force) && entry.dirty
      );
      if (removed === entry.id) {
        logInfo(
          plugin,
          SERVICE,
          `pruned ${entry.id} (${decision.reason}) — ${entry.path}`
        );
        lines.push(`pruned ${entry.id} (${decision.reason})`);
      } else {
        lines.push(removed);
      }
    }
    return lines.join("\n");
  };

  return { capStatus, listOpen, mint, prune };
};

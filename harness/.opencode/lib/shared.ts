import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { PluginInput } from "@opencode-ai/plugin";

import { SPEC_ID, frontmatterBlock } from "./gates.ts";

// Shared helpers for the lpwr-* plugins and the TUI. This module lives in
// lib/, not plugins/, on purpose: opencode loads every file in plugins/ as a
// plugin and requires each of its exports to be a function, so the RegExps and
// arrays exported here made discovery throw "Plugin export is not a function"
// on every startup. Plugin entry modules default-export one factory and import
// everything else from here (Round 6, S6-01).
//
// The pure primitives (spec-ID regexes, frontmatter/EOL helpers,
// escapeRegExp) live in gates.ts — the single definition — and are
// re-exported here so every existing `from shared` call site keeps working;
// SPEC_ID and frontmatterBlock are also bound locally for this module's own
// helpers (specIdArgument, frontmatterValue).

export {
  SPEC_ID,
  SPEC_REF,
  escapeRegExp,
  frontmatterBlock,
  normalizeEol,
} from "./gates.ts";

const execFileAsync = promisify(execFile);

// Foundation files every harness workspace must have — checked at startup by
// lpwr-check-setup and displayed as gaps by the TUI sidebar (one source for
// both surfaces).
export const EXPECTED: [string, string][] = [
  ["AGENTS.md", "protocol file"],
  ["docs/constitution.md", "run lpwr-install then lpwr-onboard"],
  ["docs/context.md", "run lpwr-install then lpwr-onboard"],
  ["docs/state.md", "run lpwr-install"],
  ["docs/audit.md", "run lpwr-install"],
  ["docs/memos", "run lpwr-install"],
  ["docs/glossary.md", "run lpwr-domain"],
  [".gitignore", "generated foundation and secrets stay untracked"],
  ["opencode.json", "permission matrix"],
  ["tui.json", "TUI sidebar config"],
  ["templates/spec.md", "record shapes"],
];

// Harness bookkeeping every spec's branch owns regardless of its declared
// surface: the audit trail and the lesson/state/memo reconcile targets written
// during Retain (lpwr-commit) and occasionally Execute (lpwr-diagnose). Kept
// out of the Tasks section so the declared surface stays product-only
// (implementation-rules 46, 49; lpwr-scope-guard).
export const RETAIN_PATHS: string[] = [
  "docs/lessons/**",
  "docs/state.md",
  "docs/audit.md",
  "docs/memos/**",
];

// Trunk is the branch checked out in the main worktree (the one owning the
// shared `.git` common dir) — never hardcoded. A linked spec worktree reports
// its own branch, so resolve through git-common-dir first. Returns null on a
// detached HEAD or when git is unavailable, so callers can refuse with a named
// reason instead of guessing.
export const trunkBranch = async (root: string): Promise<string | null> => {
  try {
    const { stdout: common } = await execFileAsync(
      "git",
      ["-C", root, "rev-parse", "--git-common-dir"],
      { timeout: 5000 }
    );
    const mainRoot = path.dirname(path.resolve(root, common.trim()));
    const { stdout } = await execFileAsync(
      "git",
      ["-C", mainRoot, "branch", "--show-current"],
      { timeout: 5000 }
    );
    const branch = stdout.trim();
    return branch === "" ? null : branch;
  } catch {
    return null;
  }
};

export const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

// First argument that IS a traceability ID: skips flags (`lpwr-commit --amend
// auth-014` must key on `auth-014`, not `--amend` — a flag-token firstArgument
// would silently skip gates that test the ID). Tokens starting with `-` are
// never spec IDs; the first token that matches SPEC_ID wins.
export const specIdArgument = (args: string): string | undefined =>
  args
    .trim()
    .split(/\s+/u)
    .find((token) => SPEC_ID.test(token));

// Registered git worktrees (main + linked), parsed from `worktree list
// --porcelain`. Returns [] when git is unavailable or the path is not a repo,
// so callers decide whether that is an empty result or an error.
export interface WorktreeInfo {
  path: string;
  branch: string | null;
}

// Pure parser for `git worktree list --porcelain` output, kept separate from
// the git call so fixtures can exercise it directly (test/worktree.test.ts).
export const parseWorktreeList = (raw: string): WorktreeInfo[] => {
  const out: WorktreeInfo[] = [];
  for (const chunk of raw.split(/\n{2,}/u)) {
    const lines = chunk.split("\n");
    const wtLine = lines.find((line) => line.startsWith("worktree "));
    if (!wtLine || lines.some((line) => line.startsWith("bare"))) {
      continue;
    }
    const branchLine = lines.find((line) => line.startsWith("branch "));
    out.push({
      branch: branchLine
        ? branchLine.slice("branch ".length).replace(/^refs\/heads\//u, "")
        : null,
      path: wtLine.slice("worktree ".length),
    });
  }
  return out;
};

export const worktreeList = async (cwd: string): Promise<WorktreeInfo[]> => {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "worktree", "list", "--porcelain"],
      { timeout: 15_000 }
    );
    return parseWorktreeList(stdout);
  } catch {
    return [];
  }
};

// Directories that may hold docs/specs/<id>/ for this session: the session's
// own harness root first, then every registered worktree's harness dir at the
// same subpath (harness/ sits one level in on a nested layout, at the root
// otherwise). Journaling resolves through this list so a keyed command run
// from trunk appends into the spec's worktree log instead of minting a
// divergent copy on trunk (Round 6, S6-02). Git failure degrades to [root].
export const specWorktreeBases = async (root: string): Promise<string[]> => {
  const bases = [root];
  try {
    const [{ stdout: common }, { stdout: top }] = await Promise.all([
      execFileAsync("git", ["-C", root, "rev-parse", "--git-common-dir"], {
        timeout: 5000,
      }),
      execFileAsync("git", ["-C", root, "rev-parse", "--show-toplevel"], {
        timeout: 5000,
      }),
    ]);
    const mainRoot = path.dirname(path.resolve(root, common.trim()));
    const rel = path.relative(path.resolve(top.trim()), root);
    for (const wt of await worktreeList(mainRoot)) {
      const base = rel === "" ? wt.path : path.join(wt.path, rel);
      if (!bases.includes(base)) {
        bases.push(base);
      }
    }
  } catch {
    // Not a git repo (or git unavailable) — the session root is all we have.
  }
  return bases;
};

export const commandName = (command: string): string =>
  command.split(/[/:]/u).pop() ?? "";

// Any command segment that is a `git … commit` (cd/g -C prefixes, pipes, && chains).
// `commit-msg` and prose mentioning "commit" do not match.
export const looksLikeGitCommit = (command: string): boolean => {
  const pattern = /^git(?:\s+\S+)*\s+commit(?:\s|$)/u;
  return command
    .split(/&&|\|\||;|\|/u)
    .some((segment) => pattern.test(segment.trim()));
};

// Any command segment that is a `git … merge --squash` — the squash-merge is
// the Retain commit's last clean stop, so lpwr-worktree-guard preflights trunk
// dirt there (implementation-rules 5: prose advises, plugins enforce).
export const looksLikeGitMergeSquash = (command: string): boolean => {
  const pattern = /^git(?:\s+\S+)*\s+merge\s+(?:\S+\s+)*--squash(?:\s|$)/u;
  return command
    .split(/&&|\|\||;|\|/u)
    .some((segment) => pattern.test(segment.trim()));
};

// The directory a git command targets: its first `-C <path>` flag (the commit
// flow runs `git -C <main> merge --squash`, against the trunk worktree, not
// the session root), else the nearest leading `cd <dir>` segment — bash cwd
// persists across `&&`, and a relative dir resolves against the same
// process/session cwd both spellings share. `fallback` when neither appears
// (e.g. `git commit` straight from the session cwd).
export const gitCommandDir = (command: string, fallback: string): string => {
  let cdDir: string | null = null;
  for (const segment of command.split(/&&|\|\||;|\|/u)) {
    const trimmed = segment.trim();
    const cd = trimmed.match(/^cd\s+(?<dir>\S+)\s*$/u);
    if (cd?.groups?.dir) {
      cdDir = cd.groups.dir;
      continue;
    }
    if (!/^git\s/u.test(trimmed)) {
      continue;
    }
    const match = trimmed.match(/(?:^|\s)-C\s+(?<dir>\S+)/u);
    if (match?.groups?.dir) {
      return match.groups.dir;
    }
    if (cdDir) {
      return cdDir;
    }
  }
  return fallback;
};

// Every blockage raises a TUI toast with the same actionable message as the
// thrown error, then throws. The toast never breaks the gate: with no attached
// TUI (headless runs) the call is a harmless no-op, and any delivery failure is
// swallowed — the error below remains the record.
export const toastBlocked = async (
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

// One-shot user-facing advisory (warning variant). Best-effort like toastBlocked.
export const toastWarning = async (
  plugin: PluginInput,
  message: string
): Promise<void> => {
  try {
    await plugin.client.tui.showToast({
      body: { message, title: "Loopwright", variant: "warning" },
      query: { directory: plugin.directory },
    });
  } catch {
    // Toast delivery is best-effort only.
  }
};

// Structured advisory log — the opencode-native replacement for console.warn.
// Fire-and-forget: never throws, never blocks. Levels carry the weight the
// message deserves (`info` for expected absences, `warn` for degraded state,
// `error` for failed operations); repeating/machine-readable lines go here,
// one-shot human alerts also raise toastWarning.
export const logAt = (
  plugin: PluginInput,
  service: string,
  level: "debug" | "error" | "info" | "warn",
  message: string
): void => {
  void (async () => {
    try {
      await plugin.client.app.log({
        body: { level, message, service },
      });
    } catch {
      // Log delivery is best-effort only.
    }
  })();
};

export const logInfo = (
  plugin: PluginInput,
  service: string,
  message: string
): void => logAt(plugin, service, "info", message);

export const logWarn = (
  plugin: PluginInput,
  service: string,
  message: string
): void => logAt(plugin, service, "warn", message);

export const logError = (
  plugin: PluginInput,
  service: string,
  message: string
): void => logAt(plugin, service, "error", message);

// Typed as an explicit const so TypeScript's control-flow analysis treats every
// call as terminating — narrowing otherwise fails.
export const block: (plugin: PluginInput, message: string) => never = (
  plugin,
  message
) => {
  void toastBlocked(plugin, message);
  throw new Error(message);
};

// Returns the lowercased value of `key:` in frontmatter, `#` comments stripped.
export const frontmatterValue = (raw: string, key: string): string | null => {
  const fm = frontmatterBlock(raw);
  if (!fm) {
    return null;
  }
  const line = fm
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

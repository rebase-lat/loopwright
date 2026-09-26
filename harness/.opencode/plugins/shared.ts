import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { Plugin, PluginInput } from "@opencode-ai/plugin";

// Shared helpers for lpwr-* plugins. Named exports carry the logic; the default
// export is a no-op Plugin so auto-discovery in plugins/ loads this file safely.

const execFileAsync = promisify(execFile);

const noopPlugin = (): Promise<Record<string, never>> => Promise.resolve({});

export default noopPlugin satisfies Plugin;

// Branch/command-arg spec ID: single sequence suffix (auth-014).
export const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/u;
// Journal/tool spec ref: also accepts criterion IDs (auth-014-1).
export const SPEC_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u;

// Foundation files every harness workspace must have — checked at startup by
// lpwr-check-setup and displayed as gaps by the TUI sidebar (one source for
// both surfaces).
export const EXPECTED: [string, string][] = [
  ["AGENTS.md", "protocol file"],
  ["docs/constitution.md", "run lpwr-install then lpwr-onboard"],
  ["docs/context.md", "run lpwr-install then lpwr-onboard"],
  ["docs/state.md", "run lpwr-install"],
  ["docs/audit.md", "run lpwr-install"],
  ["docs/glossary.md", "run lpwr-domain"],
  [".gitignore", "generated foundation and secrets stay untracked"],
  ["opencode.json", "permission matrix"],
  ["tui.json", "TUI sidebar config"],
  ["templates/spec.md", "record shapes"],
];

// Harness bookkeeping every spec branch owns regardless of its declared
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

export const commandName = (command: string): string =>
  command.split(/[/:]/u).pop() ?? "";

export const normalizeEol = (raw: string): string =>
  raw.replaceAll("\r\n", "\n");

export const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&");

// Any command segment that is a `git … commit` (cd/g -C prefixes, pipes, && chains).
// `commit-msg` and prose mentioning "commit" do not match.
export const looksLikeGitCommit = (command: string): boolean => {
  const pattern = /^git(?:\s+\S+)*\s+commit(?:\s|$)/u;
  return command
    .split(/&&|\|\||;|\|/u)
    .some((segment) => pattern.test(segment.trim()));
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
// Fire-and-forget: never throws, never blocks. Repeating/machine-readable
// lines go here; one-shot human alerts also raise toastWarning.
export const logWarn = (
  plugin: PluginInput,
  service: string,
  message: string
): void => {
  void (async () => {
    try {
      await plugin.client.app.log({
        body: { level: "warn", message, service },
      });
    } catch {
      // Log delivery is best-effort only.
    }
  })();
};

// Typed as an explicit const so TypeScript's control-flow analysis treats every
// call as terminating — narrowing otherwise fails.
export const block: (plugin: PluginInput, message: string) => never = (
  plugin,
  message
) => {
  void toastBlocked(plugin, message);
  throw new Error(message);
};

export const frontmatterBlock = (raw: string): string | null => {
  const match = normalizeEol(raw).match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  return match?.groups?.frontmatter ?? null;
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

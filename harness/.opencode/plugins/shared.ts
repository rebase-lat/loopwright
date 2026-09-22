import type { PluginInput } from "@opencode-ai/plugin";

// Shared helpers for lpwr-* plugins. Named exports only — not a plugin entry
// (no default export), so the auto-discoverer skips this file.

// Branch/command-arg spec ID: single sequence suffix (auth-014).
export const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/u;
// Journal/tool spec ref: also accepts criterion IDs (auth-014-1).
export const SPEC_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u;

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

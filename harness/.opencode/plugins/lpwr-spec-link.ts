import { readFile } from "node:fs/promises";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Refuses /lpwr-implement without an approved spec id.
// The spec id is the first token of the command arguments string.
// Frontmatter is parsed for a `status: approved` line (inline `#`
// comments stripped) instead of prefix-matching, so field order
// in spec.md never matters.
const frontmatterStatus = (raw: string): string | null => {
  const match = raw.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  const frontmatter = match?.groups?.frontmatter;
  if (!frontmatter) {
    return null;
  }
  const line = frontmatter
    .split("\n")
    .find((candidate) => candidate.trim().toLowerCase().startsWith("status:"));
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim();
};

const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

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

const specLink = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-implement") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        const message = "Blocked: /lpwr-implement requires a spec id.";
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      let raw: string;
      try {
        raw = await readFile(`docs/specs/${specId}/spec.md`, "utf-8");
      } catch {
        const message = `Blocked: spec ${specId} not found at docs/specs/${specId}/spec.md.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (frontmatterStatus(raw)?.toLowerCase() !== "approved") {
        const message = `Blocked: spec ${specId} is not approved yet.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });

export default specLink;

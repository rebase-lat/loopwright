import { existsSync } from "node:fs";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Foundation gate: no domain command runs without the Govern foundation it
// reads — docs/context.md and docs/constitution.md must exist. Exempt are the
// commands that fix exactly that (setup prepares the machine, install
// materializes files from templates, onboard fills them) plus read-only guide,
// which must stay runnable to point at onboard.
const EXEMPT = new Set([
  "lpwr-setup",
  "lpwr-onboard",
  "lpwr-guide",
  "lpwr-install",
]);

const FOUNDATION = ["docs/context.md", "docs/constitution.md"];

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

const guardBootstrap = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (EXEMPT.has(name)) {
        return;
      }
      // Anchored to the plugin's own directory — cwd may be a subdirectory.
      const missing = FOUNDATION.filter(
        (file) => !existsSync(path.join(plugin.directory, file))
      );
      if (missing.length === 0) {
        return;
      }
      const message =
        `Blocked: missing ${missing.join(" and ")} — run lpwr-install for a fresh ` +
        `project, or lpwr-onboard to fill them in.`;
      await toastBlocked(plugin, message);
      throw new Error(message);
    },
  });

export default guardBootstrap;

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import {
  commandName,
  frontmatterValue,
  logWarn,
  toastBlocked,
} from "./shared.js";

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

const guardBootstrap = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      if (EXEMPT.has(commandName(input.command))) {
        return;
      }
      // Anchored to the plugin's own directory — cwd may be a subdirectory.
      const missing = FOUNDATION.filter(
        (file) => !existsSync(path.join(plugin.directory, file))
      );
      if (missing.length === 0) {
        // Advisory, not a gate: lpwr-install materializes the constitution as
        // `draft`, and only lpwr-onboard's approval flips it. Blocking here
        // would trap greenfield projects whose constitution keeps honest
        // "nothing found" placeholders and can never be placeholder-free.
        try {
          const constitution = await readFile(
            path.join(plugin.directory, "docs/constitution.md"),
            "utf-8"
          );
          if (frontmatterValue(constitution, "status") === "draft") {
            logWarn(
              plugin,
              "lpwr-guard-bootstrap",
              "docs/constitution.md is still status: draft — run lpwr-onboard to record first approval before speccing."
            );
          }
        } catch {
          // Missing foundation already handled by the check above.
        }
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

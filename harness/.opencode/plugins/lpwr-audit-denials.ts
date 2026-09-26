import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { logWarn } from "../lib/shared.js";

// Advisory audit: permission denials are otherwise silent. Structured warn
// log records who tried what, where — never blocks and never overrides the
// decision (output.status is observed, not mutated). No toast: denials can
// repeat and would spam the TUI.
const auditDenials = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "permission.ask": (input, output) => {
      if (output.status !== "deny") {
        return Promise.resolve();
      }
      logWarn(
        plugin,
        "lpwr-audit-denials",
        `[permission-denied] ${input.type} "${input.title}" (session ${input.sessionID}).`
      );
      return Promise.resolve();
    },
  });

export default auditDenials;

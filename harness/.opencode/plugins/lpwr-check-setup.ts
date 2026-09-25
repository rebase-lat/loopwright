import { existsSync } from "node:fs";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { EXPECTED, logWarn, toastWarning } from "./shared.js";

// Startup validation, once at init: warns about missing harness pieces with
// the command that produces each one. One toast aggregates the gaps (user
// should fix now); each also lands in the structured warn log. Never throws —
// a broken workspace must still start so it can be fixed from inside (see the
// escape hatches: OPENCODE_DISABLE_PROJECT_CONFIG, OPENCODE_CONFIG). The
// EXPECTED list lives in shared.ts so the TUI sidebar shows the same gaps.

const checkSetup = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    config: (_input) => {
      const missing: string[] = [];
      for (const [file, hint] of EXPECTED) {
        if (!existsSync(path.resolve(plugin.directory, file))) {
          const message = `missing ${file} — ${hint}.`;
          missing.push(message);
          logWarn(plugin, "lpwr-check-setup", message);
        }
      }
      if (missing.length > 0) {
        void toastWarning(
          plugin,
          `Harness setup incomplete: ${missing.join(" ")}`
        );
      }
      return Promise.resolve();
    },
  });

export default checkSetup;

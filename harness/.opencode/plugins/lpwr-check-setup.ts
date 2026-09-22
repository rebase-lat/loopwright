import { existsSync } from "node:fs";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Startup validation, once at init: warns about missing harness pieces with
// the command that produces each one. Never throws — a broken workspace must
// still start so it can be fixed from inside (see the escape hatches:
// OPENCODE_DISABLE_PROJECT_CONFIG, OPENCODE_CONFIG).
const EXPECTED: [string, string][] = [
  ["AGENTS.md", "protocol file"],
  ["docs/constitution.md", "run lpwr-onboard"],
  ["docs/context.md", "run lpwr-onboard"],
  ["docs/state.md", "run lpwr-install"],
  ["docs/glossary.md", "run lpwr-domain"],
  ["opencode.json", "permission matrix"],
  ["templates/spec.md", "record shapes"],
];

const checkSetup = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    config: (_input) => {
      for (const [file, hint] of EXPECTED) {
        if (!existsSync(path.resolve(plugin.directory, file))) {
          console.warn(`[harness-setup] missing ${file} — ${hint}.`);
        }
      }
      return Promise.resolve();
    },
  });

export default checkSetup;

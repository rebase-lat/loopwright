import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { looksLikeGitCommit, logWarn, toastWarning } from "../lib/shared.ts";

// Advisory only: warns on achievement trap (>3 consecutive patches
// on one file) and dislodging trap (15 min on one file without a
// commit). Never blocks; the builder is instructed to heed warnings.
// Threshold crossings raise a structured log warn on every subsequent
// edit and one warning-variant TUI toast each — logs record, toasts
// inform once per cycle so they don't spam. Detection stays mechanical
// (patch count, elapsed time) and never judges reasoning quality.
// Counters reset on commit, not on file close — a file touched across
// short sessions still counts until one of them ends in a commit.
const patchCounts = new Map<string, number>();
const fileTimers = new Map<string, number>();
const toasted = new Set<string>();
const TIMEBOX_MS = 15 * 60 * 1000;

const trapFlags = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "tool.execute.after": async (input) => {
      if (
        input.tool !== "edit" &&
        input.tool !== "write" &&
        input.tool !== "apply_patch"
      ) {
        return;
      }
      const filePath: unknown = input.args.filePath;
      if (typeof filePath !== "string" || filePath === "") {
        // apply_patch has no single filePath — pending content is guarded
        // pre-write elsewhere; trap counters need a real path.
        return;
      }
      const file = filePath;
      const count = (patchCounts.get(file) ?? 0) + 1;
      patchCounts.set(file, count);
      if (count > 3) {
        const message =
          `[achievement-trap] ${file}: ${count} consecutive patches — ` +
          `consider a root-cause refactor instead of another incremental edit.`;
        logWarn(plugin, "lpwr-flag-traps", message);
        if (count === 4) {
          await toastWarning(plugin, message);
        }
      }
      const first = fileTimers.get(file) ?? Date.now();
      fileTimers.set(file, first);
      if (Date.now() - first > TIMEBOX_MS) {
        const message =
          `[dislodging-trap] ${file}: over 15 minutes without resolution — ` +
          `stash and reset strategy per lpwr-root-cause-refactor.`;
        logWarn(plugin, "lpwr-flag-traps", message);
        if (!toasted.has(file)) {
          toasted.add(file);
          await toastWarning(plugin, message);
        }
      }
    },
    "tool.execute.before": (input, output) => {
      // Before-hooks carry the pending call arguments on output.
      if (input.tool !== "bash") {
        return Promise.resolve();
      }
      const command: unknown = output.args.command;
      if (typeof command === "string" && looksLikeGitCommit(command)) {
        patchCounts.clear();
        fileTimers.clear();
        toasted.clear();
      }
      return Promise.resolve();
    },
  });

export default trapFlags;

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { looksLikeGitCommit } from "./shared.js";

// Advisory only: warns on achievement trap (>3 consecutive patches
// on one file) and dislodging trap (15 min on one file without a
// commit). Never blocks; the builder is instructed to heed warnings.
// Threshold crossings also raise one warning-variant TUI toast each —
// console keeps warning on every subsequent edit, toasts fire once per
// cycle so they inform without spamming. Detection stays mechanical
// (patch count, elapsed time) and never judges reasoning quality.
// Counters reset on commit, not on file close — a file touched across
// short sessions still counts until one of them ends in a commit.
const patchCounts = new Map<string, number>();
const fileTimers = new Map<string, number>();
const toasted = new Set<string>();
const TIMEBOX_MS = 15 * 60 * 1000;

const toastWarning = async (
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

const trapFlags = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "tool.execute.after": async (input) => {
      if (input.tool !== "edit" && input.tool !== "write") {
        return;
      }
      const file: string = input.args.filePath;
      const count = (patchCounts.get(file) ?? 0) + 1;
      patchCounts.set(file, count);
      if (count > 3) {
        const message =
          `[achievement-trap] ${file}: ${count} consecutive patches — ` +
          `consider a root-cause refactor instead of another incremental edit.`;
        console.warn(message);
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
        console.warn(message);
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

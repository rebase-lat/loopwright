import type { Plugin } from "@opencode-ai/plugin";

// Advisory only: warns on achievement trap (>3 consecutive patches
// on one file) and dislodging trap (15 min on one file without a
// commit). Never blocks; the builder is instructed to heed warnings.
const patchCounts = new Map<string, number>();
const fileTimers = new Map<string, number>();
const TIMEBOX_MS = 15 * 60 * 1000;

export default (async () => {
  return {
    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool !== "edit") return;
      const file = output.args.filePath;

      const count = (patchCounts.get(file) ?? 0) + 1;
      patchCounts.set(file, count);
      if (count > 3) {
        console.warn(
          `[achievement-trap] ${file}: ${count} consecutive patches — ` +
            `consider a root-cause refactor instead of another incremental edit.`
        );
      }

      const first = fileTimers.get(file) ?? Date.now();
      fileTimers.set(file, first);
      if (Date.now() - first > TIMEBOX_MS) {
        console.warn(
          `[dislodging-trap] ${file}: over 15 minutes without resolution — ` +
            `stash and reset strategy per the countermeasure.`
        );
      }
    },
    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool === "bash" && /^git commit/.test(output.args.command)) {
        patchCounts.clear();
        fileTimers.clear();
      }
    },
  };
}) satisfies Plugin;

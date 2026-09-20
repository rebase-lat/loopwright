import type { Hooks } from "@opencode-ai/plugin";

// Advisory only: warns on achievement trap (>3 consecutive patches
// on one file) and dislodging trap (15 min on one file without a
// commit). Never blocks; the builder is instructed to heed warnings.
// Detection stays mechanical (patch count, elapsed time) and never
// judges reasoning quality. Counters reset on commit, not on file
// close — a file touched across short sessions still counts until
// one of them ends in a commit.
const patchCounts = new Map<string, number>();
const fileTimers = new Map<string, number>();
const TIMEBOX_MS = 15 * 60 * 1000;

const trapFlags = (): Promise<Hooks> =>
  Promise.resolve({
    "tool.execute.after": (input) => {
      if (input.tool !== "edit") {
        return Promise.resolve();
      }
      const file: string = input.args.filePath;
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
      return Promise.resolve();
    },
    "tool.execute.before": (input, output) => {
      // Before-hooks carry the pending call arguments on output.
      if (input.tool !== "bash") {
        return Promise.resolve();
      }
      const command: unknown = output.args.command;
      if (typeof command === "string" && command.startsWith("git commit")) {
        patchCounts.clear();
        fileTimers.clear();
      }
      return Promise.resolve();
    },
  });

export default trapFlags;

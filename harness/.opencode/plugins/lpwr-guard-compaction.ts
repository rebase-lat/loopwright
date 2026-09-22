import type { Hooks } from "@opencode-ai/plugin";

// Compaction policy (implementation-rules 23): the hook below customizes the
// compaction prompt — prune intermediate tool output and scratchpads, retain
// the system prompt, current goal, and active execution state, and never drop
// evidence (diff hunks, test results, log lines, recorded rationale).
// Evidence additionally lives in log.ndjson, outside the compactable
// window, by construction.
const COMPACTION_GUIDANCE = [
  "Prune intermediate tool output and scratchpad content; retain only the system prompt, current goal, and active execution state.",
  "Never drop evidence: diff hunks, test results, log lines, and recorded rationale (the 'why') must survive compaction.",
];

const contextCompactor = (): Promise<Hooks> =>
  Promise.resolve({
    "experimental.session.compacting": (_input, output) => {
      output.context.push(...COMPACTION_GUIDANCE);
      return Promise.resolve();
    },
  });

export default contextCompactor;

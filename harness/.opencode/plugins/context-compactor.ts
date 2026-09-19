import type { Plugin } from "@opencode-ai/plugin";

// Prunes tool output at compaction time, never pruning diff/tests/logs/why.
// Policy: drop intermediate tool outputs and scratchpads, retaining only the
// system prompt, current goal, and active execution state. Anything carrying
// evidence markers (diff hunks, test results, log lines, recorded rationale)
// is protected.
// Defensive by design: only transforms payload shapes it positively
// recognizes; anything else passes through untouched. Runtime behavior to be
// confirmed against the installed opencode in Phase 5.
const PROTECTED = [/^diff --git/m, /^\+\+\+ /m, /^--- /m, /@@ /m, /\b(pass|fail|ok|FAILED|PASSED)\b/i, /\bwhy\b/i];

function isProtected(text: string): boolean {
  return PROTECTED.some((re) => re.test(text));
}

function pruneText(text: string, budget = 2000): string {
  if (text.length <= budget || isProtected(text)) return text;
  return text.slice(0, budget) + `\n…[compacted: ${text.length - budget} chars pruned]`;
}

export default (async () => {
  return {
    "experimental.session.compacting": async (input: any, output: any) => {
      try {
        const messages = output?.messages ?? input?.messages;
        if (!Array.isArray(messages)) return; // unrecognized shape — pass through
        for (const m of messages) {
          if (typeof m?.content === "string") m.content = pruneText(m.content);
          if (Array.isArray(m?.content)) {
            for (const part of m.content) {
              if (part && typeof part.text === "string") part.text = pruneText(part.text);
            }
          }
        }
      } catch {
        // compaction must never break the session
      }
    },
  };
}) satisfies Plugin;

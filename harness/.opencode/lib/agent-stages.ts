// Source of truth for the workflow stages each agent claims in its
// `description:` frontmatter line. Delegation is deliberately implicit in the
// command bodies — no command names an agent — so the only two places it is
// described are the agent's own description line and `orchestrator.md`'s
// Responsibilities section, and nothing checked they agreed. That drifted once
// already: `builder.md` claimed Verify while `scribe.md` also (correctly)
// claimed it. `test/agent-stages.test.ts` parses every agent `.md` and
// asserts the stage set matches its entry here, that `STAGES` matches the
// `Stage:` lines the commands declare, and that orchestrator's prose names
// every mapped agent.
//
// Deliberately partial: only agents whose descriptions list stages belong in
// the map. The triage seats and `scout` describe their role by function
// ("triage seat 2", "ephemeral retrieval") rather than by stage, and
// `orchestrator` runs every command without naming stages — padding the map
// with them would manufacture a signal the convention does not carry. The
// test enforces the other side of that honesty: an agent left out must not
// name a stage, so a future description that starts doing so fails until the
// map is updated deliberately.

import { escapeRegExp } from "./gates.ts";

// The distinct `Stage:` values the command surface declares, alphabetically.
export const STAGES: readonly string[] = [
  "Bootstrap",
  "Cross-cutting",
  "Execute",
  "Frame",
  "Govern",
  "Retain",
  "Specify",
  "Verify",
];

export const AGENT_STAGES: Readonly<Record<string, readonly string[]>> = {
  builder: ["Bootstrap", "Execute", "Retain"],
  planner: ["Frame", "Cross-cutting", "Retain"],
  reviewer: ["Verify"],
  scribe: ["Bootstrap", "Frame", "Specify", "Verify", "Govern"],
};

// Stage words a description actually contains, boundary-aware so `Frame`
// never matches inside `Framework`.
export const stagesIn = (description: string): string[] =>
  STAGES.filter((stage) =>
    new RegExp(
      `(?:^|[^\\p{L}\\p{N}_])${escapeRegExp(stage)}(?:$|[^\\p{L}\\p{N}_])`,
      "u"
    ).test(description)
  );

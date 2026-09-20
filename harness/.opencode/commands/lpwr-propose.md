---
description: Debate a solution via triage subagents, present options for human pick.
agent: plan
---

Stage: Frame.

Take the idea in $ARGUMENTS. Invoke a triage of subagents — neutral (plain restatement), deep-expert (domain truth, what should happen), applied-judge (testability, what would convince me) — to analyze and debate the solution.

Present exactly 3 distinct solution patterns with trade-offs to the human. The human picks one option. Assign the traceability ID (`<domain>-<sequence>`) now, at `lpwr-propose` time — a proposal never exists without an ID; `lpwr-specs` only consumes it. Only the pick becomes `docs/specs/<id>/proposal.md` (via `templates/proposal.md`); triage output itself never writes to `docs/`.

Required reading first: `docs/glossary.md`, `docs/context.md`, relevant `docs/lessons/*`. Use skill `lpwr-option-triage`.
On completion, append one A2A line to `docs/specs/<id>/log.ndjson` with intent `frame` and payload pointing at the proposal.

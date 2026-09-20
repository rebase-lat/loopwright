---
description: Debate options via triage, ratify the human pick by motion, record the proposal.
agent: plan
---

Stage: Frame.

Take the idea in $ARGUMENTS. Invoke a triage of subagents — neutral (plain restatement), deep-expert (domain truth, what should happen), applied-judge (testability, what would convince me) — to analyze and debate the solution.

Present exactly 3 distinct solution patterns with trade-offs to the human. The human picks one option. Then ratify the pick by motion before assigning anything: neutral chairs, deep-expert moves the pick with its tradeoff takeaways, applied-judge seconds only if testable as stated (a fallen motion is re-moved once in testable form; a twice-fallen pick returns to the human), one scrutiny round, amendments on testability, human vote to adopt or reject. Only an adopted motion gets a traceability ID (`<domain>-<sequence>`) — a proposal never exists without an ID; `lpwr-specs` only consumes it. The adopted pick becomes `docs/specs/<id>/proposal.md` (via `templates/proposal.md`) with the full motion record; triage output itself never writes to `docs/`.

Required reading first: `docs/glossary.md`, `docs/context.md`, relevant `docs/lessons/*`. Use skills `lpwr-option-triage` and `lpwr-motion`.
On completion, append one A2A line to `docs/specs/<id>/log.ndjson` with intent `frame` and payload pointing at the proposal.

---
description: Debate options via triage, ratify the human pick by motion, record the proposal.
agent: orchestrator
---

Stage: Frame.

1. Draft 2-3 distinct options for the problem at hand.
2. Run triage per skill `lpwr-option-triage` (three seats evaluate independently).
3. Present triage results to the human via the `question` tool; human selects one option (or a tweak/merge — free text when merging).
4. Run motion per skill `lpwr-motion` — ratify the selection, check constitution, lessons, and any relevant `docs/memos/*.md`, capture dissent. Do not re-run triage's evaluation.
5. Assign the traceability ID (`<domain>-<sequence>`) — a proposal never exists without an ID; `lpwr-specs` only consumes it. Have a scribe subagent write `docs/specs/<id>/proposal.md` via `templates/proposal.md` (the orchestrator delegates but cannot write).
6. Call `journal_handoff` with intent `frame`, the spec ID, and artifact `docs/specs/<id>/proposal.md`. The triage debate in steps 2-3 is not logged — only the motion's outcome is.

Required reading first: `docs/glossary.md`, `docs/context.md`, relevant `docs/lessons/*`, and any `docs/memos/*.md` matching this topic (interview notes, research, or diagnosis grounding — "none found" is fine). Use skill `lpwr-context-economy`.

Output: writes `docs/specs/<id>/proposal.md` via templates/proposal.md; journal_handoff frame `docs/specs/<id>/proposal.md`.

Next: lpwr-specify.

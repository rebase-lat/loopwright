---
description: Debate options via triage, ratify the human pick by motion, record the proposal.
agent: plan
---

Stage: Frame.

1. Draft 2-3 distinct options for the problem at hand.
2. Run triage per skill `lpwr-option-triage` (three seats evaluate independently).
3. Present triage results to the human; human selects one (or a tweak/merge of options).
4. Run motion per skill `lpwr-motion` — ratify the selection, check constitution and lessons, capture dissent. Do not re-run triage's evaluation.
5. Assign the traceability ID (`<domain>-<sequence>`) — a proposal never exists without an ID; `lpwr-specs` only consumes it. Have a scribe subagent write `docs/specs/<id>/proposal.md` via `templates/proposal.md` (plan orchestrates but cannot write).
6. Call `journal_handoff` with intent `frame`, the spec ID, and artifact `docs/specs/<id>/proposal.md`. The triage debate in steps 2-3 is not logged — only the motion's outcome is.

Required reading first: `docs/glossary.md`, `docs/context.md`, relevant `docs/lessons/*`. Use skill `lpwr-context-economy`.

Output: writes `docs/specs/<id>/proposal.md` via templates/proposal.md; journal_handoff frame `docs/specs/<id>/proposal.md`.
Next: lpwr-specify.

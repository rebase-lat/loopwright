---
description: Debate options via triage, ratify the human pick by motion, record the proposal.
agent: plan
---

Stage: Frame.

1. Draft 2-3 distinct options for the problem at hand.
2. Run triage: neutral, deep-expert, applied-judge each evaluate the options independently.
3. Present triage results to the human; human selects one (or a tweak/merge of options).

4. Motion (this step — do not re-run triage's evaluation):
   a. Pin the human's final selection as exact, literal text — this becomes the proposal's content, not a summary of triage's notes.
   b. Check the final text against `docs/constitution.md`'s floors and `docs/lessons/*` for anything relevant. A conflict or a repeated past mistake gets flagged to the human before finalizing — never silently proceed.
   c. Ask each triage seat one question only: "does anything about this final framing, as pinned above, still concern you?" Record a dissent only if the answer is yes and specific.

5. Assign the traceability ID (`<domain>-<sequence>`) — a proposal never exists without an ID; `lpwr-specs` only consumes it. Have a scribe subagent write `docs/specs/<id>/proposal.md` via `templates/proposal.md` (plan orchestrates but cannot write).
6. Call `journal_handoff` with intent `frame`, the spec ID, and artifact `docs/specs/<id>/proposal.md`. The triage debate in steps 2-3 is not logged — only the motion's outcome is.

Required reading first: `docs/glossary.md`, `docs/context.md`, relevant `docs/lessons/*`. Use skills `lpwr-option-triage`, `lpwr-motion`, and `lpwr-context-economy`.

Output: writes `docs/specs/<id>/proposal.md` via templates/proposal.md; journal_handoff frame `docs/specs/<id>/proposal.md`.
Next: lpwr-specify.

---
description: Settle one open technical decision for specs needing design review.
agent: orchestrator
---

Stage: Specify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Run only when `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) has `design_review: required`.

Use skill `lpwr-adr-drafting` to write `docs/specs/<id>/adr.md` via `templates/adr.md`. Once the human approves the decision, set status: approved. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/adr.md`.

Output: writes `docs/specs/<id>/adr.md` via templates/adr.md; journal_handoff specify `docs/specs/<id>/adr.md`.

Next: lpwr-tasks (ADR approved — resume Specify).

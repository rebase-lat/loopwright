---
description: Settle one open technical decision for specs needing design review.
agent: scribe
---

Stage: Specify.

Run only when `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) has `design_review: required`.

Use skill `lpwr-adr-drafting` to write `docs/specs/<id>/adr.md` via `templates/adr.md`. Once the human approves the decision, set status: approved. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/adr.md`.

Output: writes `docs/specs/<id>/adr.md` via templates/adr.md; journal_handoff specify `docs/specs/<id>/adr.md`.

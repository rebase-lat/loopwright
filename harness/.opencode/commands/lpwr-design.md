---
description: Settle one open technical decision for specs needing design review.
agent: scribe
---

Stage: Specify.

Run only when `docs/specs/$ARGUMENTS/spec.md` has `design_review: required`.

Use skill `lpwr-adr-drafting` to produce `docs/specs/$ARGUMENTS/adr.md` via `templates/adr.md`. Once the human approves the decision, set status: approved. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/$ARGUMENTS/adr.md`.

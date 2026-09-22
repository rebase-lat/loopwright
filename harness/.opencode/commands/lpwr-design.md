---
description: Settle one open technical decision for specs needing design review.
agent: scribe
---

Stage: Specify.

Run only when `docs/specs/$ARGUMENTS/spec.md` has `design_review: required`.

Produce `docs/specs/$ARGUMENTS/adr.md` via `templates/adr.md`. Consider at least two real alternatives — a single-option decision with no comparison is not acceptable. Once the human approves the decision, set status: approved. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/$ARGUMENTS/adr.md`.

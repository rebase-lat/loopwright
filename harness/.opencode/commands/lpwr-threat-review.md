---
description: Review failure modes for a high-tier change. Runs only on risk_tier high.
agent: scribe
---

Stage: Verify.

Run only when `docs/specs/$ARGUMENTS/spec.md` has `risk_tier: high`.

Produce `docs/specs/$ARGUMENTS/threat-review.md` via `templates/threat-review.md`. Be specific to this diff — generic failure modes without a concrete path through this change's actual code are not acceptable entries. Call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/$ARGUMENTS/threat-review.md`.

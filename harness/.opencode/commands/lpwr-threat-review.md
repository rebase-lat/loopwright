---
description: Review failure modes for a high-tier change. Runs only on risk_tier high.
agent: scribe
---

Stage: Verify.

Run only when `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) has `risk_tier: high`.

Write `docs/specs/<id>/threat-review.md` via `templates/threat-review.md`. Be specific to this diff — generic failure modes without a concrete path through this change's actual code are not acceptable entries. Call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/<id>/threat-review.md`.

Output: writes `docs/specs/<id>/threat-review.md` via templates/threat-review.md; journal_handoff verify `docs/specs/<id>/threat-review.md`.

Next: lpwr-release (high-tier ship path).

---
description: Review failure modes for a high-tier change. Runs only on risk_tier high.
agent: orchestrator
---

Stage: Verify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Run only when `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) has `risk_tier: high`.

Write `docs/specs/<id>/threat-review.md` via `templates/threat-review.md`. Required reading first: `docs/specs/<id>/spec.md` and, when present, `docs/specs/<id>/adr.md` — call out any ADR consequence that materializes in this diff (or state "none" explicitly). Be specific to this diff — generic failure modes without a concrete path through this change's actual code are not acceptable entries. Every finding must be either fixed in this change or bound to a criterion sub-ID (existing, or added via `lpwr-specify`/`lpwr-amend` — free prose with no ID and no fix cannot ship). Residual risks in the Mitigations table get the same treatment: fixed, or bound to a criterion that can later be waived/deferred with justification. Call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/<id>/threat-review.md`.

Output: writes `docs/specs/<id>/threat-review.md` via templates/threat-review.md; journal_handoff verify `docs/specs/<id>/threat-review.md`.

Next: lpwr-commit (then lpwr-release on the high-tier ship path).

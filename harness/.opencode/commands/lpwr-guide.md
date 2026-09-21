---
description: Suggest the next command to run. Read-only, never writes.
agent: plan
---

Stage: cross-cutting.

Suggest the next command — orientation only, never enforcement (enforcement stays with `lpwr-spec-link` and `lpwr-scope-guard`). Read-only by construction: read files, suggest one command, write nothing (not to `state.md`, not to the log).

Walk this decision path over file existence and state, in order, stopping at the first unmet condition (optional `$ARGUMENTS` names the active spec; otherwise take it from `docs/state.md`'s "In flight" section):

1. No `docs/context.md` → suggest `lpwr-onboard`.
2. No `docs/constitution.md` → suggest `lpwr-onboard` (or `lpwr-constitution` if context exists but the constitution was skipped).
3. Nothing "In flight" in `docs/state.md` → suggest `lpwr-propose`.
4. Spec has `proposal.md` but no `spec.md` → suggest `lpwr-specs`.
5. `spec.md` status is `draft` → suggest `lpwr-specs` to finish approval (`lpwr-amend` if changing an already-approved spec).
6. `spec.md` is `approved` but no `tasks.md` → suggest `lpwr-tasks`.
7. `tasks.md` exists but the acceptance table has empty test-reference cells → suggest `lpwr-implement`.
8. All criteria have test references but no `review.md` verdict → suggest `lpwr-review`.
9. `review.md` `risk_tier` is "high" but no `threat-review.md` → suggest `lpwr-threat-review`.
10. `review.md` verdict is "ship" but no matching commit → suggest `lpwr-commit`.
11. `review.md` verdict is "block" → suggest `lpwr-implement` (rework), then `lpwr-review` again.
12. `review.md` verdict is "redirect" → suggest `lpwr-propose` (re-frame the spec).
13. `review.md` lists `deferred:` entries (`<criterion-id> -> <follow-up>`) → suggest `lpwr-propose` for the named follow-up, citing the deferred IDs.
14. Committed but no lesson filed at `docs/lessons/<date>-<id>.md` → suggest `lpwr-teach`.
15. Everything closed → point at `docs/state.md`'s "Next" section or suggest `lpwr-propose`.

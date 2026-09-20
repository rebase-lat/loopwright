---
description: Amend an approved spec plus its tasks, void the review, route to re-approval.
agent: plan
---

Stage: Specify.

Change the spec for `$ARGUMENTS` (`<spec-id>`, then the change description) after approval. Behavior changes update the spec first, the code second — never the reverse.

1. Load `docs/specs/<id>/spec.md`, `tasks.md`, and `review.md` (if present). If no `spec.md` exists, stop and use `lpwr-specs` — amend updates, it never creates.
2. Apply the change as EARS criteria with the same rules as `lpwr-specs` (glossary-exact terms, banned substitutes rejected, criterion sub-IDs `<id>-<n>` minted only here, never in `tasks.md`). Set `status: draft` — the amended spec must be re-approved by an explicit human verdict.
3. Void the old review: delete `docs/specs/<id>/review.md`. The old verdict no longer describes the spec, and deletion forces re-review — `lpwr-commit` and `lpwr-release` block on the missing review mechanically.
4. Reconcile `tasks.md` by criterion ID: unchanged IDs keep test references and check state; removed criteria drop their tasks (noted in the log); new criteria get new unchecked tasks; reworded same-ID criteria are unchecked with test references cleared (changed behavior must be re-proven).
5. Append one A2A line to `docs/specs/<id>/log.ndjson` with intent `specify`, then present the amended spec for human re-approval.

After a shipped commit the loop is closed — post-ship changes go through a new spec (naming the old ID in `supersedes:`), not through amend.

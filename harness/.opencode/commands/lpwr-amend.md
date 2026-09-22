---
description: Amend an approved spec plus its tasks, void the review, route to re-approval.
agent: scribe
---

Stage: Specify.

Change the spec for `$ARGUMENTS` (`<spec-id>`, then the change description) after approval. Behavior changes update the spec first, the code second — never the reverse.

0. Check `docs/state.md` Done and the git log for this spec ID — if shipped, stop and route to a new spec naming this ID in `supersedes:`; amend is pre-commit only.

1. Load `docs/specs/<id>/spec.md` (criteria + Tasks section) and `review.md` (if present). If no `spec.md` exists, stop and use `lpwr-specs` — amend updates, it never creates. If the change alters the problem rather than the spec, stop and return to `lpwr-propose`.
2. Apply the change as EARS criteria with the same rules as `lpwr-specs` (glossary-exact terms, banned substitutes rejected, criterion sub-IDs `<id>-<n>` minted only here, never in the Tasks section). New criteria take the next free sub-ID (max existing + 1); never reuse a retired sub-ID. Set `status: draft` — the amended spec must be re-approved by an explicit human verdict.
3. Void the old review: delete `docs/specs/<id>/review.md`. The old verdict no longer describes the spec, and deletion forces re-review — `lpwr-commit` and `lpwr-release` block on the missing review mechanically.
4. Reconcile the Tasks section by criterion ID: unchanged IDs keep test references and check state; removed criteria drop their tasks (noted in the log); new criteria get new unchecked tasks; reworded same-ID criteria are unchecked with test references cleared (changed behavior must be re-proven). List tests/code orphaned by removed criteria in the log for the re-implement pass to remove.
5. Call `journal_handoff` with intent `specify` for the spec, then present the amended spec for human re-approval.

After a shipped commit the loop is closed — post-ship changes go through a new spec (naming the old ID in `supersedes:`), not through amend.

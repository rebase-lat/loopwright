---
name: lpwr-spec-amendment
description: Amend an approved spec with re-approval routing and task reconciliation. Use when behavior changes after spec approval via lpwr-amend.
---

# Spec Amendment

Change an approved spec without breaking the loop's guarantees. Amend is
pre-commit only — after a shipped commit, post-ship changes go through a new
spec naming the old ID in `supersedes:`.

- Scope check first: `docs/state.md` Done and the git log decide whether the
  spec already shipped. Shipped means stop. A change that alters the problem
  rather than the spec also stops — back to `lpwr-propose`. A missing
  `spec.md` means `lpwr-specs`, not amend: amend updates, it never creates.
- Edit criteria under `lpwr-specs` rules (glossary-exact terms, banned
  substitutes rejected). Mint new sub-IDs here only, next free number, never
  reused; set `status: draft` for re-approval by explicit human verdict.
- Void the old review by deleting `review.md` — commit and release are
  mechanically blocked until re-review.
- Reconcile the Tasks section by criterion ID: unchanged keeps test
  references and check state; removed drops tasks (noted in the log); new
  gets unchecked tasks; reworded unchecks with test references cleared.
  List orphaned tests and code in the log for the re-implement pass.

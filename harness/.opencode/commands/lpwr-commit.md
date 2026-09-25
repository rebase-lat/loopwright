---
description: Group the diff into spec-tagged commits, merge to trunk, update state and lesson.
agent: orchestrator
---

Stage: Retain.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Group the diff for $ARGUMENTS (`<id>`, the spec ID) and create one or more commits on the spec's branch, then squash-merge the branch into trunk. Use skill `lpwr-commit-grouping`.

1. Gate: `docs/specs/<id>/review.md` must carry a `ship` verdict — no ship, no commit (also enforced by `lpwr-verdict-gate.ts`). Waived/deferred criteria listed in the review frontmatter are the human's explicit call — commit does not second-guess them.
2. Gate: `docs/specs/<id>/log.ndjson` must carry at least one line with this spec's `spec_ref` and an intent other than `retain` — a change with no upstream traceable work is out-of-process work, not a gap in the log; retain-only lines (or none), no merge.
3. Write `docs/lessons/<date>-<id>.md` via `templates/lesson.md` before the commits — the single highest-value thing learned, with `failure_bucket` set honestly. Prefer an insight already explained back during implement (per-criterion `execute` handoffs / session notes) over re-deriving one. The lesson must ride this branch: written after the merge it would never leave the worktree.
4. Commit: every message carries the spec ID; the diff includes the spec folder and the lesson — they ship with it. When the low-confidence advisory fired on entry, name those handoffs (`intent@ts`) in the commit summary.
5. Call `journal_handoff` with intent `retain` and artifact pointing at the commit SHA(s) — the retain handoff closes the spec's active loop; `log.ndjson` stays append-only in the repo. The journal writes after step 4's commits, so commit the new log line as a final ID-tagged commit before merging.
6. Merge: squash-merge the branch into trunk — `git -C <main> merge --squash <id>`, then commit the staged result with the same ID-tagged message: one commit on trunk per spec, tagged with the ID (rule 2). `<main>` is the trunk worktree — the parent of `git rev-parse --git-common-dir`. Refuse while trunk's working tree is dirty; resolve that first.
7. Reconcile `docs/audit.md` first: fold any open `improve-candidate` entries with no matching proposal into `docs/state.md`'s Next (mark them consumed in the audit log); fold any open `release-ref` for this `<id>` into the Done line for `<id>` (mark consumed). `setup-suggestion` entries stay until the human marks them applied.
8. Update `docs/state.md` via `templates/state.md` (single writer — Done, In flight, Next only; never file a Blocked entry, those are human escalations). In a worktree session this writes trunk's copy through the shared link — state.md is never part of a branch diff (rule 49).
9. File each `deferred:` target from the review frontmatter into `docs/state.md`'s Next section so follow-ups survive this spec's closure.
10. Cleanup is deferred: `lpwr-worktree-guard` prunes the branch + worktree at the next `lpwr-propose`, once they are shipped and clean — this session cannot delete the directory it runs from. End by telling the human to quit; `lpwr-release` and `lpwr-teach` run from the trunk session, where the merge now lives.

Output: commits on `<id>` (spec folder, lesson, retain line) plus one squash commit on trunk; writes `docs/state.md` via templates/state.md, `docs/lessons/<date>-<id>.md` via templates/lesson.md, reconciles `docs/audit.md`; journal_handoff retain `<commit-sha>`.

Next: lpwr-release (if this repo deploys) or lpwr-teach — both from the trunk session.

---
description: Group the diff into spec-tagged commits, update state and lesson.
agent: builder
---

Stage: Retain.

Group the diff for $ARGUMENTS (`<id>`, the spec ID) and create one or more commits. Use skill `lpwr-commit-grouping`.

1. Gate: `docs/specs/<id>/review.md` must carry a `ship` verdict — no ship, no commit (also enforced by `lpwr-verdict-gate.ts`). Waived/deferred criteria listed in the review frontmatter are the human's explicit call — commit does not second-guess them.
2. Gate: `docs/specs/<id>/log.ndjson` must carry at least one line with this spec's `spec_ref` and an intent other than `retain` — a change with no upstream traceable work is out-of-process work, not a gap in the log; retain-only lines (or none), no merge.
3. Commit: every message carries the spec ID; when the low-confidence advisory fired on entry, name those handoffs (`intent@ts`) in the commit summary.
4. Call `journal_handoff` with intent `retain` and artifact pointing at the commit SHA(s) — the retain handoff closes the spec's active loop; `log.ndjson` stays append-only in the repo, and `docs/state.md`'s Done line is the durable shipped signal (the guide stops suggesting steps for a Done spec).
5. Reconcile `docs/audit.md` first: fold any open `improve-candidate` entries with no matching proposal into `docs/state.md`'s Next (mark them consumed in the audit log); fold any open `release-ref` for this `<id>` into the Done line for `<id>` (mark consumed). `setup-suggestion` entries stay until the human marks them applied.
6. Update `docs/state.md` via `templates/state.md` (single writer — Done, In flight, Next only; never file a Blocked entry, those are human escalations).
7. Write `docs/lessons/<date>-<id>.md` via `templates/lesson.md` — the single highest-value thing learned, with `failure_bucket` set honestly. Prefer an insight already explained back during implement (per-criterion `execute` handoffs / session notes) over re-deriving one.
8. File each `deferred:` target from the review frontmatter into `docs/state.md`'s Next section so follow-ups survive this spec's closure.

Output: writes commits, `docs/state.md` via templates/state.md, `docs/lessons/<date>-<id>.md` via templates/lesson.md, reconciles `docs/audit.md`; journal_handoff retain `<commit-sha>`.

Next: lpwr-release (if this repo deploys) or lpwr-teach.

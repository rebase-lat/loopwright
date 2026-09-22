---
description: Group the diff into spec-tagged commits, update state and lesson.
agent: build
---

Stage: Retain.

Group the diff for $ARGUMENTS (`<id>`, the spec ID) and create one or more commits. Use skill `lpwr-commit-grouping`.

1. Gate: `docs/specs/<id>/review.md` must carry a `ship` verdict — no ship, no commit (also enforced by `lpwr-verdict-gate.ts`). Waived/deferred criteria listed in the review frontmatter are the human's explicit call — commit does not second-guess them.
2. Gate: `docs/specs/<id>/log.ndjson` must carry at least one line with this spec's `spec_ref` and an intent other than `retain` — a change with no upstream traceable work is out-of-process work, not a gap in the log; retain-only lines (or none), no merge.
3. Commit: every message carries the spec ID.
4. Call `journal_handoff` with intent `retain` and artifact pointing at the commit SHA(s), then the log goes archival.
5. Update `docs/state.md` via `templates/state.md` (single writer — Done, In flight, Next only; never file a Blocked entry, those are human escalations).
6. Write `docs/lessons/<date>-<id>.md` via `templates/lesson.md` — the single highest-value thing learned, with `failure_bucket` set honestly.
7. File each `deferred:` target from the review frontmatter into `docs/state.md`'s Next section so follow-ups survive this spec's closure.

Output: writes commits, `docs/state.md` via templates/state.md, `docs/lessons/<date>-<id>.md` via templates/lesson.md; journal_handoff retain `<commit-sha>`.

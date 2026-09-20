---
description: Group the diff into spec-tagged commits, update state and lesson.
---

Stage: Retain.

Group the diff for $ARGUMENTS and create one or more commits. Use skill `lpwr-commit-grouping`.

Rules: requires a `ship` verdict in `docs/specs/$ARGUMENTS/review.md` — no ship, no commit (also enforced by `lpwr-verdict-gate.ts`). Waived/deferred criteria listed in the review frontmatter are the human's explicit call — commit does not second-guess them. Verify `docs/specs/$ARGUMENTS/log.ndjson` carries at least one line with this spec's `spec_ref` — a change with no traceable ID is out-of-process work, not a gap in the log; no lines, no merge. Every message carries the spec ID. Append one A2A line with intent `retain` and payload pointing at the commit(s), then the log goes archival. After committing, update `docs/state.md` (single writer) and write `docs/lessons/<date>-<id>.md` via `templates/lesson.md` — the single highest-value thing learned, with `failure_bucket` set honestly. File each `deferred:` target from the review frontmatter into `docs/state.md`'s Next section so follow-ups survive this spec's closure. The spec's `log.ndjson` is archival after this point.

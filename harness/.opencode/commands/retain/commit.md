---
description: Group the diff into spec-tagged commits, update state and lesson.
---

Group the diff for $ARGUMENTS and create one or more commits. Use skill `commit-grouping`.

Rules: requires a `ship` verdict in `docs/specs/$ARGUMENTS/review.md` — no ship, no commit. Every message carries the spec ID. After committing, update `docs/state.md` (single writer) and write `docs/lessons/<date>-<id>.md` via `templates/lesson.md` — the single highest-value thing learned, with `failure_bucket` set honestly. The spec's `log.ndjson` is archival after this point.

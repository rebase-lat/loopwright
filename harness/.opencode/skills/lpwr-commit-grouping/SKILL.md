---
name: lpwr-commit-grouping
description: Group a diff into coherent spec-tagged commits. Use in lpwr-commit after a ship verdict.
---

# Commit Grouping

Split one shipped diff into commits a future reader can follow — each concern
isolated, each message keyed to its spec.

- Group the diff into one or more coherent commits; every message carries the
  spec ID (`<domain>-<sequence>`) as a required field.
- One concern per commit. Docs/config/non-behavioral refactors may record
  their own verdict per the constitution; behavioral changes need the recorded
  reviewer.
- After committing, `docs/state.md` moves the spec to Done, and the lesson is
  written to `docs/lessons/<date>-<id>.md` via `templates/lesson.md` — the
  single highest-value thing learned, with an honest `failure_bucket`
  (`wrong-spec | wrong-implementation | flaky-check | harness-defect |
  security-gap | null`).

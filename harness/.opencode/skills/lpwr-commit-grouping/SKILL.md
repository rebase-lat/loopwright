---
name: lpwr-commit-grouping
description: Group a diff into coherent spec-tagged commits. Use when committing work for a spec.
---

# Commit Grouping

- Group the diff into one or more coherent commits; every message carries the spec ID (`<domain>-<sequence>`) as a required field.
- One concern per commit; docs/config/non-behavioral refactors may record their own verdict per the constitution, behavioral changes need the recorded reviewer.
- After committing: `docs/state.md` moves the spec to Done, and `docs/lessons/<id>.md` records the single highest-value lesson with an honest `failure_bucket` (`wrong-spec | wrong-implementation | flaky-check | harness-defect | null`).

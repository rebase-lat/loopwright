---
name: lpwr-acceptance-criteria
description: Own the acceptance table lifecycle — sub-IDs, test binding, waiver rules. Use when specifying, implementing, or reviewing against a spec. EARS phrasing lives in lpwr-writing-ears.
---

# Acceptance Criteria

Countermeasure for the assumption trap (wrong question, right answer): settle
what counts as done — criteria and test binding — before solution code exists.

- Every criterion carries a sub-ID `<id>-<n>` and binds to at least one test
  reference.
- `lpwr-specs` creates the table with empty test-reference cells;
  `lpwr-implement` fills them — never mark a task done without a passing test
  referencing its criterion.
- `lpwr-review` renders `ship` only when every criterion has a passing test
  reference, is waived, or is deferred.

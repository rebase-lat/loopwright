---
name: acceptance-criteria
description: Write explicit acceptance criteria and test cases before solution code. Use when specifying, implementing, or reviewing against a spec.
---

# Acceptance Criteria

Countermeasure for the assumption trap (wrong question, right answer): write explicit acceptance criteria and test cases _prior_ to generating or writing solution code.

- Every criterion carries a sub-ID `<id>-<n>` and binds to at least one test reference.
- `/specs` creates the table with `(pending)` references; `/implement` fills them — never mark a task done without a passing test referencing its criterion.
- `/review` renders `ship` only when every criterion has a passing test reference.

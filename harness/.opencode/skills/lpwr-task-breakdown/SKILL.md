---
name: lpwr-task-breakdown
description: Break approved criteria into ordered tasks bound to sub-IDs with declared surface. Use when filling the Tasks section of spec.md (hosts: lpwr-tasks, lpwr-specify).
---

# Task Breakdown

Turn approved acceptance criteria into an ordered, scoped work list.

- Every task binds to its criterion sub-ID(s) (`— satisfies <id>-<n>`); a
  task with no binding is a note — delete it or bind it.
- Order by dependency: prerequisites first, independent tasks grouped.
- Declared surface: one file/glob per line, exact. `lpwr-scope-guard.ts`
  enforces this list — when in doubt, narrower.
- New criteria get new tasks; removed criteria drop theirs. Reworded criteria
  keep their tasks only if the work is unchanged.

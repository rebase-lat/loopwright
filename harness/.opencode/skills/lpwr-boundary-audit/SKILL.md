---
name: lpwr-boundary-audit
description: Audit data flows, boundary conditions, and dependencies before calling work done. Use in lpwr-diagnose or lpwr-explore when mapping a changed or observed surface.
---

# Boundary Audit

Countermeasure for the location trap (so close, but so far): audit core data
flows, boundary conditions, and dependencies before classifying a task as
"almost done."

- Trace the data flow end to end through the changed surface.
- Enumerate boundary conditions (empty, null, max, concurrent, unauthenticated)
  and check each.
- Confirm dependencies are listed in the stack section of `docs/context.md`;
  anything outside it is out of scope.

---
name: lpwr-repro-minimisation
description: Build a minimal reproduction and shrink it before proposing a fix. Use in lpwr-diagnose on hard bugs or flaky checks. This skill never patches — the fix runs through lpwr-implement.
---

# Repro Minimisation

Countermeasure for the fog trap (too much system, too little signal): shrink
the failure until only the cause remains in frame.

- First: build a repro that fails reliably outside the full system (isolated
  execution test).
- Then minimise: strip inputs, config and setup until removing anything else
  makes the failure disappear.
- Rank hypotheses against the minimal repro, instrument only what
  discriminates between them.
- The fix plan includes a regression-test target derived from the minimal
  repro; applying the fix runs through `lpwr-implement` against an approved
  spec.

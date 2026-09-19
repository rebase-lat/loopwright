---
name: repro-minimisation
description: Build a minimal reproduction and shrink it before fixing. Use when diagnosing hard bugs or flaky checks.
---

# Repro Minimisation

- First: build a repro that fails reliably outside the full system (isolated execution test).
- Then minimise: strip inputs, config and setup until removing anything else makes the failure disappear.
- Rank hypotheses against the minimal repro, instrument only what discriminates between them.
- The fix ships with a regression test derived from the minimal repro.

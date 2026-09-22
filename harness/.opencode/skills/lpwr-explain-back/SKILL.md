---
name: lpwr-explain-back
description: Hypothesis-first walkthrough of code you did not write, before accepting it. Use when reviewing agent patches in lpwr-implement. Landed-diff reading lives in lpwr-diff-reading.
---

# Explain-Back

Countermeasure for the progression trap (falling behind without noticing):
perform "explain-back" checks — walk through line-by-line execution _before_
accepting generated code.

- Before prompting: write down what you think is wrong (hypothesis first, then
  let the agent test it).
- While it works: ask why — what it changed, why that approach, what it ruled
  out, what it assumed.
- After acceptance: hand the landed diff to `lpwr-diff-reading` for the
  hunk-level pass; this skill covers the walkthrough, not the final read.

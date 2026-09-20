---
name: lpwr-explain-back
description: Walk through generated code line-by-line and document execution before accepting it. Use when reviewing agent patches or accepting generated code.
---

# Explain-Back

Countermeasure for the progression trap (falling behind without noticing): perform "explain-back" checks — walk through and document line-by-line execution _before_ accepting generated code.

- Before prompting: write down what you think is wrong (hypothesis first, then let the agent test it).
- While it works: ask why — what it changed, why that approach, what it ruled out, what it assumed.
- When the patch lands: read the diff, ask what could still fail. Validate, not just approve.

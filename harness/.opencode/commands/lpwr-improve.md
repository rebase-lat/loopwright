---
description: Survey the codebase for deepening opportunities, never code.
agent: plan
---

Stage: Frame.

Survey the codebase at $ARGUMENTS for deepening opportunities (structure, boundaries, tech debt). Query `docs/lessons/` by `failure_bucket` too — three lessons sharing a bucket (especially `security-gap`) mean the fix belongs in the constitution, not in a fourth lesson. Present the report in chat following `templates/improve.md`: one entry per candidate, each with a verbatim `Proposed via` line the human can feed straight into `lpwr-propose`. Output feeds back into Frame as new `lpwr-propose` candidates — never into Execute directly. This command never writes code and writes no files.

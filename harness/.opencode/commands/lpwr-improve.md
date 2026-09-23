---
description: Survey the codebase for deepening opportunities, never code.
agent: planner
---

Stage: Frame.

Survey the codebase at $ARGUMENTS for deepening opportunities (structure, boundaries, tech debt). Query `docs/lessons/` by `failure_bucket` too — three lessons sharing a bucket (especially `security-gap`) mean the fix belongs in the constitution, not in a fourth lesson. Present the report in chat following `templates/improve.md`: one full entry per candidate — Problem paragraph, Evidence pointers, risk tier, and the verbatim `Proposed via` line. A name without its block is not a candidate; summaries of candidates do not satisfy this command. Render no verdicts, blocks, or readiness judgments — surfacing is the whole job; readiness belongs to `lpwr-guide`, gates belong to their own domains. Output feeds back into Frame as new `lpwr-propose` candidates — never into Execute directly. This command never writes code and writes no files.

Output: inline candidate report following templates/improve.md; writes nothing.

Next: lpwr-propose (candidate ready to frame).

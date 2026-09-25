---
description: Survey the codebase for deepening opportunities, never code.
agent: orchestrator
---

Stage: Frame.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Survey the codebase at $ARGUMENTS for deepening opportunities (structure, boundaries, tech debt). Query `docs/lessons/` by `failure_bucket` too — three lessons sharing a bucket (especially `security-gap`) mean the fix belongs in the constitution, not in a fourth lesson. Present the report in chat following `templates/improve.md`: one full entry per candidate — Problem paragraph, Evidence pointers, risk tier, and the verbatim `Proposed via` line. A name without its block is not a candidate; summaries of candidates do not satisfy this command. After the chat report, append each full candidate entry to `docs/audit.md` as an `improve-candidate` (status: open) — the chat report stays primary; the file is the durable mirror so unconsumed candidates survive the session (rule 19: append, `lpwr-commit` reconciles). Render no verdicts, blocks, or readiness judgments — surfacing is the whole job; readiness belongs to `lpwr-guide`, gates belong to their own domains. Output feeds back into Frame as new `lpwr-propose` candidates — never into Execute directly. This command never writes code.

Output: inline candidate report following templates/improve.md; appends the same entries to `docs/audit.md`.

Next: lpwr-propose (candidate ready to frame).

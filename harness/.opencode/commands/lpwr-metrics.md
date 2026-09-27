---
description: Report rework rate, time to first Verify, and patches per file across specs. Read-only.
agent: orchestrator
---

Stage: Cross-cutting.

Delegation: none — one tool call; you hold no shell or write.

Call `project_metrics` and present the report to the human: how many spec folders carry a handoff log, the rework rate, time to first Verify (median and range over the specs that have both a Frame and a Verify handoff), and patches per file over the commits whose messages carry a traceability ID. The report states each definition beside its number — quote that wording rather than restating it, so a reader who wants the arithmetic lands on the same definition you just read.

Read-only by construction: writes nothing, journals nothing, and never opens a spec's content — only handoff timestamps from `docs/specs/<id>/log.ndjson` and git history. A project with no specs yet says so instead of reporting a zero that looks like a measurement; a gap the report names (specs with no Frame→Verify pair, folders with no log, commits with no ID) is a fact about the history, not a failure.

Output: inline metrics via `project_metrics`; writes nothing.

Next: lpwr-improve (rework or churn concentrated somewhere), lpwr-guide (what to run next), or lpwr-propose (start the spec the numbers say is missing).

---
description: Full Specify pass — criteria, design if required, and tasks in one run.
agent: scribe
---

Stage: Specify.

Full pass from an approved proposal to approved tasks in one run, using skills `lpwr-writing-ears`, `lpwr-acceptance-criteria`, `lpwr-task-breakdown`, and `lpwr-adr-drafting`:

1. Draft EARS criteria with empty test references; set `risk_tier` (human-confirmed) and `design_review` (required for new dependencies, schema or API contract changes, structural refactors).
2. If design review is required, draft the ADR via `templates/adr.md` — the tasks step waits for it.
3. Fill the Tasks section: every task bound to its criterion sub-ID, declared surface exact.
4. Present the package — spec (criteria + tasks) plus ADR if any — for one human approval covering criteria, tasks, and design together.

Granular `lpwr-specs`, `lpwr-tasks`, and `lpwr-design` remain for partial states. If `spec.md` already exists for this ID, stop and use `lpwr-amend`. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

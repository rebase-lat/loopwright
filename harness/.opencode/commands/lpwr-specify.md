---
description: Full Specify pass — criteria, design if required, and tasks in one run.
agent: scribe
---

Stage: Specify.

Full pass from an approved proposal to approved tasks in one run, using skills `lpwr-writing-ears`, `lpwr-acceptance-criteria`, `lpwr-task-breakdown`, and `lpwr-adr-drafting`:

1. Draft EARS criteria with empty test references; resolve every `Open questions` entry into a criterion sub-ID, a non-goal, or a struck line with one-line resolution — refuse the package approval while any remain open; set `risk_tier` and `design_review` (required for new dependencies, schema or API contract changes, structural refactors) — both human picks via the `question` tool.
2. If design review is required, write the ADR to `docs/specs/<id>/adr.md` via `templates/adr.md` — the tasks step waits for it.
3. Fill the Tasks section: every task bound to its criterion sub-ID, declared surface exact.
4. Present the package — `docs/specs/<id>/spec.md` (criteria + tasks) plus `docs/specs/<id>/adr.md` if any — for one human approval via `question` covering criteria, tasks, and design together.

Granular `lpwr-specs`, `lpwr-tasks`, and `lpwr-design` remain for partial states. If `spec.md` already exists for this ID, stop and use `lpwr-amend`. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: writes `docs/specs/<id>/spec.md` via templates/spec.md (plus `docs/specs/<id>/adr.md` via templates/adr.md when design review applies); journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-implement (approved package).

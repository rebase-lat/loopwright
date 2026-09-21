---
description: Amend the project constitution (never per-task).
agent: scribe
---

Stage: Govern.

Amend `docs/constitution.md` via `templates/constitution.md` ($ARGUMENTS).

Rules: amendments go through `lpwr-propose` → `lpwr-review` like any spec — Govern gets no side channel. Never re-litigate ubiquitous rules per-task; update the constitution instead and set `last_amended`.
Call `journal_handoff` with intent `govern` for the active spec.

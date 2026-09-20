---
description: Amend the project constitution (never per-task).
---

Stage: Govern.

Amend `docs/constitution.md` via `templates/constitution.md` ($ARGUMENTS).

Rules: amendments go through `lpwr-propose` → `lpwr-review` like any spec — Govern gets no side channel. Never re-litigate ubiquitous rules per-task; update the constitution instead and set `last_amended`.
Append one A2A line to the active spec's `log.ndjson` with intent `govern`.

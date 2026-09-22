---
description: Amend the project constitution (never per-task).
agent: scribe
---

Stage: Govern.

Amend `docs/constitution.md` via `templates/constitution.md`. `$ARGUMENTS` is `<spec-id>` followed by the change description — constitution amendments travel with their proposal's spec (rule 25), so the ID is always known.

Rules: amendments go through `lpwr-propose` → `lpwr-review` like any spec — Govern gets no side channel. Never re-litigate ubiquitous rules per-task; update the constitution instead and set `last_amended`.
Call `journal_handoff` with intent `govern` for that spec ID.

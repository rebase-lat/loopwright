---
description: Break an approved spec into tasks bound to criterion IDs.
agent: scribe
---

Stage: Specify.

From the approved spec for $ARGUMENTS, write `docs/specs/<id>/tasks.md` via `templates/tasks.md`. Every task binds to its criterion sub-ID(s) (`— satisfies <id>-<n>`); the declared surface (files/globs) is what `lpwr-scope-guard.ts` will later enforce, so list it exactly. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/tasks.md`.

---
description: Materialize docs files from templates for a fresh project. Idempotent.
agent: scribe
---

Stage: Bootstrap.

Bootstrap a fresh project from templates — this command materializes files, it fills in nothing. For each template in `templates/` with a matching `docs/` path (`constitution.md`, `context.md`, `state.md`), write the file if and only if it is missing; never overwrite an existing file. Placeholder values stay placeholders — filling them is `lpwr-onboard`'s job, and the machine-level checks are `lpwr-setup`'s.

Idempotent: running twice on a materialized project is a no-op with a confirmation, not an error. Afterwards suggest `lpwr-onboard` unless context and constitution are already filled.

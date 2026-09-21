---
description: Guided first-run pass producing docs/context.md and a drafted constitution.
agent: scribe
---

Stage: Govern.

Walk the repo once — codebase structure, domain language, stack and tooling (including configured MCP servers: name, transport, required env, what each one is for) — and write `docs/context.md` via `templates/context.md`, plus a drafted `docs/constitution.md` built from what you find, never invented in a vacuum.

Works on new and existing code the same way: on a fresh repo most sections come back thin (fine — the file grows as real code lands); on an existing repo capture what's real (actual lint config, actual test coverage, actual non-functional realities). Thin is allowed; unrun is the failure (rule 35).

This command drafts only — the constitution is approved by a human on demand, never here. Afterwards the granular commands (`lpwr-codebase`, `lpwr-domain`, `lpwr-stack`, `lpwr-constitution`) refresh one section each without re-running this pass.

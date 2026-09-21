---
description: Guided onboarding pass producing docs/context.md and a drafted constitution; safe to re-run as refresh.
agent: scribe
---

Stage: Govern.

Walk the repo once — codebase structure, domain language, stack and tooling (including configured MCP servers: name, transport, required env, what each one is for; plus external services and system binaries the repo needs: containers, databases, CLIs) — and write `docs/context.md` via `templates/context.md`, plus a drafted `docs/constitution.md` built from what you find, never invented in a vacuum. Fill Code Principles (toolchain discovered), Project Specifics (locale, services, environment found), and Business Rules (domain constraints found in code and docs) from discovery — placeholders stay only where nothing was found. Draft one `Audit command:` line per discovered stack (npm audit, pip-audit, govulncheck, trivy, …) matching what the repo actually uses — `lpwr-setup` verifies the binaries, `lpwr-security-scan` blocks on any failure.

Works on new and existing code the same way: on a fresh repo most sections come back thin (fine — the file grows as real code lands); on an existing repo capture what's real (actual lint config, actual test coverage, actual non-functional realities). Thin is allowed; unrun is the failure (rule 35).

This command drafts only — the constitution is approved by a human on demand, never here. Afterwards the granular commands (`lpwr-codebase`, `lpwr-domain`, `lpwr-stack`, `lpwr-constitution`) refresh one section each without re-running this pass.

Re-running is a refresh, not a reset: update `docs/context.md` sections in place (bump `last_updated`); if `docs/constitution.md` exists with `status: approved` and no unfilled `<...>` placeholders, do not touch it — report discovered deltas as a `lpwr-propose` candidate instead. Draft or re-draft the constitution when it is missing, still `draft`, or approved-but-placeholder (placeholders mean it was never truly approved). Only a placeholder-free file confirmed by a human becomes `approved`.

When a new pass contradicts an earlier one (or the existing files), re-read the authoritative sources — package manifest plus lockfiles, `opencode mcp list`, container signals — and present a single resolved draft naming what changed and why. Ask the human to confirm the resolved contents, never to choose between unverified alternatives.

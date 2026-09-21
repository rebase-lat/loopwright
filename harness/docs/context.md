---
last_updated: 2026-09-19
updated_by: lpwr-onboard
---

# Project context

## Codebase
Agentic workflow workspace for opencode. Entry points: `AGENTS.md` (protocol) and
`opencode.json` (permission matrix, instructions). `.opencode/` holds agents (8),
flat `lpwr-*` commands (22), `lpwr-*` skills (12), and `lpwr-*` plugins (10, auto-discovered).
`docs/` holds constitution, glossary, context, specs, lessons, state.
`templates/` holds the fixed record shapes. The project root holds the Node toolchain
(`package.json`, `oxlint.config.ts`, `oxfmt.config.ts`, `tsconfig.json`).

## Domain
Spec-driven agent harness: six workflow domains (Govern, Frame, Specify, Execute, Verify,
Retain) plus Bootstrap. One traceability ID per spec joins worktree, branch, folder, log,
and commits. Human owns the verdict; plugins enforce the gates. Review weight scales by
risk tier (set at specs, re-confirmed at review); high-tier specs need a threat review
before release. See `docs/glossary.md`.

## Stack and tools
TypeScript (strict, NodeNext) for `.opencode/plugins/*.ts`. Linter oxlint + formatter oxfmt
via ultracite presets (`npm run lint`, `npm run fmt:check`); `tsc --noEmit` via
`npm run typecheck`. Package manager npm (`package-lock.json` agrees). No CI gate configured yet; no deploy target
(this repo ships no runtime). MCP servers: none configured. External services: none — no
containers (no Dockerfile/compose signals), no databases; system binaries needed: node, npm, opencode.

## Principles (summary)
See `docs/constitution.md` — ubiquitous rules, verdict floor, and verdict authority live
there, never duplicated here.

---
last_updated: 2026-09-27
updated_by: lpwr-onboard
---

# Project context

## Codebase
Two roots, deliberately distinct — this file describes both:

- **Repo root** — this file, `constitution.md` (this repo's committed rule
  record), `package.json`, `oxlint.config.ts`, `oxfmt.config.ts`,
  `tsconfig.json`, `loopwright.sh`, and the repo-history documents
  (`README.md`, `PRINCIPLES.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `integration-analysis.md` — the single audit trail; the 1.4.2–1.4.4 audit
  originals are folded into its Rounds 7 and 8).
- **`harness/`** — the pure-boilerplate payload that ships into a project:
  `AGENTS.md` (protocol), `opencode.json` (permission matrix + instructions),
  `tui.json`, `.opencode/` holding 9 agent role files, 28 flat `lpwr-*`
  commands (each declaring its Stage), 17 `lpwr-*` skills, 13 auto-discovered
  `lpwr-*` plugins, `lib/`, and `tui/`; `docs/` holding the tracked glossary,
  conventions, and implementation-rules (the generated foundation —
  constitution, context, state, audit, memos — is gitignored and created by
  `lpwr-install` + `lpwr-onboard`); and `templates/` holding the fixed record
  shapes.

Run opencode from `harness/` (README Quickstart).

## Domain
Spec-driven agent harness: six workflow domains (Govern, Frame, Specify, Execute, Verify,
Retain) plus Bootstrap. One traceability ID per spec joins worktree, branch, folder, log,
and commits. Human owns the verdict; plugins enforce the gates. Review weight scales by
risk tier (set at specs, re-confirmed at review); high-tier specs need a threat review
before release. See `harness/docs/glossary.md`.

## Stack and tools
TypeScript (strict, NodeNext) for `harness/.opencode/plugins/*.ts`. Linter oxlint + formatter oxfmt
via ultracite presets (`npm run lint`, `npm run fmt:check`); `tsc --noEmit` via
`npm run typecheck`. Package manager npm (`package-lock.json` agrees). No CI gate configured yet; no deploy target
(this repo ships no runtime). MCP servers: none in `harness/opencode.json` (the shipped
matrix); the repo root's own `opencode.json` carries developer-side MCP servers
(grep, context, graft, engram) and applies only to sessions started at the root —
it is not the permission matrix. External services: none — no
containers (no Dockerfile/compose signals), no databases; system binaries needed: node, npm, opencode.

## Principles (summary)
See `constitution.md` at the repo root — ubiquitous rules, verdict floor, and verdict
authority live there, never duplicated here. That file is this repo's committed record
for humans; the harness runtime reads its own `docs/constitution.md`, which is
generated per workspace by `lpwr-install` + `lpwr-onboard` and is gitignored, so this
workspace stays bootstrap-gated until those two run (README Quickstart).

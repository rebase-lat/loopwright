# Loopwright

Agentic coding workflow for [opencode](https://opencode.ai): six workflow domains plus a
Bootstrap stage, wired together by one traceability ID, mechanical gates, and a shared audit
log. Humans own the verdicts; plugins enforce the boundaries.

Licensed under the [MIT License](LICENSE). Design intent lives in
[PRINCIPLES.md](PRINCIPLES.md).

## How it works

Every unit of work keys off one spec ID (`<domain>-<sequence>`, e.g. `auth-014`) that joins
the worktree, branch, `docs/specs/<id>/` folder, log lines, and commit messages. Work flows
through typed stages — each command declares its `Stage:` — and every handoff appends one
structured line (`intent`, `spec_ref`, artifact-pointer `payload`, `confidence`) to the
spec's `log.ndjson`. Gates hold whether or not the agent cooperates: `lpwr-spec-link` blocks
unapproved specs, `lpwr-scope-guard` blocks out-of-surface edits (`edit`/`write`/
`apply_patch`), `lpwr-verdict-gate` blocks
ship-less commits and deploys, `lpwr-security-scan` blocks secrets (dependency findings
warn-and-trace to `audit.md`, reviewed at lpwr-review). Review weight scales by
human-confirmed risk tier; high-tier specs need a threat review before release.
Structured human picks run through the
`question` tool; advisories land in
`client.app.log` (`logWarn`) and one-shot warning toasts — never raw `console.*`.

One `orchestrator` agent is the only interactive primary: all 25 commands pin
to it, it fans doer steps out to subagents (`builder` implements, `scribe`
authors, `reviewer` verifies), and every other agent carries `task: deny` —
workers return a complete report and get resumed, never spawn. The TUI adds a
read-only workflow-pulse sidebar to the session view (spec status, verdict,
foundation gaps), refreshed by its palette command or a docs file-watcher
event.

Specs work on branch-per-ID worktrees: `lpwr-propose` / `lpwr-explore` mint
the ID from trunk, the worktree guard creates branch + worktree `../<id>`
(name = branch = folder, rule 2), and the session restarts there for
Specify → Verify; `lpwr-commit` squash-merges back to trunk as one
ID-tagged commit, and the worktree prunes itself at the next propose.
Foundation files stay trunk-owned and symlinked in — `state.md` never
merges.

## Quickstart

Run from `harness/` (the live workspace). After any config change, quit + restart opencode.

1. `lpwr-setup` — install deps, check env/runtime, evaluate tool surface + MCP (report-only; idempotent).
2. `lpwr-install` — materialize `docs/` files from templates (missing only, never overwrite).
3. `lpwr-onboard` — guided pass producing `docs/context.md` + a drafted constitution.
4. `lpwr-guide` — read-only "what's next" helper; callable any time, from anywhere.
5. `lpwr-propose` → `lpwr-specs` → `lpwr-tasks` → `lpwr-implement` → `lpwr-review` →
   `lpwr-commit` → `lpwr-teach` — the idea-to-lesson spine.

## Repo layout

```
loopwright/
├── README.md
├── PRINCIPLES.md               # design intent (resume of the former principles essays)
├── LICENSE                     # MIT
├── CHANGELOG.md
├── package.json                # npm scripts: lint, fmt, fmt:check, typecheck, test; version 1.3.1
├── opencode.json               # developer MCP + LSP config — distinct from harness/opencode.json (shipped matrix)
├── constitution.md             # this repo's own rules — the committed record (harness ships without one; onboard creates it)
├── context.md                  # this repo's own context (same: generated per project by onboard)
├── integration-analysis.md     # workflow cross-phase audit + fix-wave plans (repo history, not shipped)
├── harness/                    # pure boilerplate — no prefilled project info (run opencode from here)
│   ├── AGENTS.md               # protocol only — rules live in docs/constitution.md
│   ├── opencode.json           # permission matrix (single source), instructions
│   ├── tui.json                # TUI plugin wiring — loads .opencode/tui/ (relative path, no build)
│   ├── .opencode/
│   │   ├── agents/             # 9 role files (orchestrator, builder, planner, scribe, reviewer, triage seats, scout)
│   │   ├── commands/           # 25 flat lpwr-* commands, each declaring its Stage:
│   │   ├── skills/             # 17 lpwr-* procedures (SKILL.md + trigger descriptions)
│   │   ├── plugins/            # 12 lpwr-* plugins + shared helper (gates, journaling, advisories, worktree lifecycle —
│   │   │                       #   auto-discovered; typechecked via root tsconfig.json)
│   │   └── tui/                # lpwr-tui.tsx — read-only workflow-pulse sidebar (session view)
│   ├── docs/                   # glossary + conventions + implementation-rules, kept in git;
│   │                           #   generated foundation files (constitution, context, state.md, audit.md)
│   │                           #   are gitignored — recreate via lpwr-install + lpwr-onboard
│   └── templates/              # fixed record shapes (spec, review, lesson, …)
├── oxlint.config.ts / oxfmt.config.ts  # ultracite presets
└── tsconfig.json               # strict, covers plugins + tui + configs
```

## Commands

| Stage | Commands |
| --- | --- |
| Bootstrap | `lpwr-setup`, `lpwr-install` |
| Govern | `lpwr-onboard`, `lpwr-constitution`, `lpwr-domain`, `lpwr-stack` |
| Frame | `lpwr-propose`, `lpwr-interview`, `lpwr-research`, `lpwr-improve` |
| Specify | `lpwr-specify`, `lpwr-specs`, `lpwr-tasks`, `lpwr-amend`, `lpwr-design`, `lpwr-explore` |
| Execute | `lpwr-implement`, `lpwr-diagnose` |
| Verify | `lpwr-review`, `lpwr-goal`, `lpwr-release`, `lpwr-threat-review` (high tier only) |
| Retain | `lpwr-commit`, `lpwr-teach` |
| Cross-cutting | `lpwr-guide` |

Cross-cutting rules: amendments (including harness changes) go through
`lpwr-propose` → `lpwr-review`; approved specs change only via `lpwr-amend`
(review voided, re-approval required); risk tier is set at specs, re-confirmed
at review, and high tier needs `lpwr-threat-review` before release;
`docs/state.md` has exactly one writer (`lpwr-commit`); payloads are always
artifact pointers, never inline content.

## Toolchain

```sh
npm install          # dev deps: oxlint, oxfmt, ultracite, typescript
npm run lint         # oxlint + format check
npm run lint:fix     # oxlint --fix + write formatting (code files only, never prose)
npm run typecheck    # tsc --noEmit over this workspace's plugins, lib, tui + configs
npm test             # node:test gate fixtures (test/)
```

Markdown docs are excluded from formatting by policy — prose stays human-written.

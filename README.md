# Loopwright

Agentic coding workflow for [opencode](https://opencode.ai): six workflow domains plus a
Bootstrap stage, wired together by one traceability ID, mechanical gates, and a shared audit
log. Humans own the verdicts; plugins enforce the boundaries.

## How it works

Every unit of work keys off one spec ID (`<domain>-<sequence>`, e.g. `auth-014`) that joins
the worktree, branch, `docs/specs/<id>/` folder, log lines, and commit messages. Work flows
through typed stages — each command declares its `Stage:` — and every handoff appends one
structured line (`intent`, `spec_ref`, artifact-pointer `payload`, `confidence`) to the
spec's `log.ndjson`. Gates hold whether or not the agent cooperates: `lpwr-spec-link` blocks
unapproved specs, `lpwr-scope-guard` blocks out-of-surface edits, `lpwr-verdict-gate` blocks
ship-less commits and deploys.

## Quickstart

Run from `harness/` (the live workspace). After any config change, quit + restart opencode.

1. `lpwr-setup` — install deps, check env and runtime (idempotent, machine-level).
2. `lpwr-onboard` — guided pass producing `docs/context.md` + a drafted constitution.
3. `lpwr-guide` — read-only "what's next" helper; callable any time, from anywhere.
4. `lpwr-propose` → `lpwr-specs` → `lpwr-tasks` → `lpwr-implement` → `lpwr-review` →
   `lpwr-commit` → `lpwr-teach` — the idea-to-lesson spine.

## Repo layout

```
loopwright/
├── README.md
├── harness/                    # the live opencode workspace (run opencode from here)
│   ├── AGENTS.md               # protocol only — rules live in docs/constitution.md
│   ├── opencode.json           # permission matrix (single source), instructions
│   ├── .opencode/
│   │   ├── agents/             # 8 role files (build, plan, scribe, reviewer, triage seats, scout)
│   │   ├── commands/           # 22 flat lpwr-* commands, each declaring its Stage:
│   │   ├── skills/             # 11 lpwr-* procedures (SKILL.md + trigger descriptions)
│   │   └── plugins/            # 10 lpwr-* plugins (gates, journaling, advisories — auto-discovered, typechecked)
│   ├── docs/                   # constitution, glossary, context, specs, lessons, state
│   └── templates/              # fixed record shapes (spec, review, lesson, …)
├── harness-layout.md           # original six-domain layout (v2; command structure
├── cross-module-connections.md #   superseded by implementation-guide-v3.md —
├── harness-principles.md       #   banners on file mark what still holds)
├── implementation-rules.md     # flat build checklist (each rule names its failure)
├── naming-and-communication-conventions.md
├── implementation-guide-v3.md  # current picture: flat commands, Bootstrap, prefix policy
├── harness-implementation-plan.md  # build log, phases 0–5 (history)
├── harness-v3-migration-plan.md    # v3 migration log, phases A–D (history)
├── package.json                # npm scripts: lint, fmt, fmt:check, typecheck
├── oxlint.config.ts / oxfmt.config.ts  # ultracite presets
└── tsconfig.json               # strict, covers plugins + configs
```

## Commands

| Stage | Commands |
| --- | --- |
| Bootstrap | `lpwr-setup` |
| Govern | `lpwr-onboard`, `lpwr-constitution`, `lpwr-codebase`, `lpwr-domain`, `lpwr-stack` |
| Frame | `lpwr-propose`, `lpwr-interview`, `lpwr-research`, `lpwr-improve` |
| Specify | `lpwr-specs`, `lpwr-tasks`, `lpwr-amend` |
| Execute | `lpwr-implement`, `lpwr-diagnose` |
| Verify | `lpwr-review`, `lpwr-goal`, `lpwr-release`, `lpwr-threat-review` (high tier only) |
| Retain | `lpwr-commit`, `lpwr-teach` |
| Cross-cutting | `lpwr-guide` |

Cross-cutting rules: amendments (including harness changes) go through
`lpwr-propose` → `lpwr-review`; approved specs change only via `lpwr-amend`
(review voided, re-approval required); `docs/state.md` has exactly one writer
(`lpwr-commit`); payloads are always artifact pointers, never inline content.

## Toolchain

```sh
npm install          # dev deps: oxlint, oxfmt, ultracite, typescript
npm run lint         # oxlint + format check
npm run lint:fix     # oxlint --fix + write formatting (code files only, never prose)
npm run typecheck    # tsc --noEmit over plugins + configs
```

Markdown docs are excluded from formatting by policy — prose stays human-written.

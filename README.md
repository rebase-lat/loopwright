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
unapproved specs; `lpwr-scope-guard` blocks out-of-surface edits (`edit`/`write`/
`apply_patch`) and freezes `spec.md` at `status: approved` to test-reference cells — any
other spec change goes through `lpwr-amend`, which flips the status to draft first;
`lpwr-verdict-gate` blocks ship-less commits, refuses a commit when `spec.md`'s acceptance
table and `review.md`'s Specs axis disagree (the tables are the review's only binding to
the spec it reviewed), and allows the constitution's `Deploy command:` only inside an open
`lpwr-release` window; `lpwr-security-scan` blocks secrets (dependency findings
warn-and-trace to `audit.md`, reviewed at lpwr-review). Review weight scales by
human-confirmed risk tier; high-tier specs need a threat review before release.
Structured human picks run through the
`question` tool; advisories land in
`client.app.log` (`logWarn`) and one-shot warning toasts — never raw `console.*`.

One `orchestrator` agent is the only interactive primary: all 27 commands pin
to it, it fans doer steps out to subagents (`builder` implements, `scribe`
authors, `reviewer` verifies), and every other agent carries `task: deny` —
workers return a complete report and get resumed, never spawn. The TUI adds a
read-only workflow-pulse sidebar to the session view (spec status, verdict,
foundation gaps), refreshed by its palette command or a docs file-watcher
event.

Specs work on branch-per-ID worktrees: `lpwr-propose` / `lpwr-explore` journal
from trunk, then `worktree_mint` creates branch + worktree `../<id>`
(name = branch = folder, rule 2), and the session restarts there for
Specify → Verify; `lpwr-commit` squash-merges back to trunk as one
ID-tagged commit and marks the worktree pending cleanup —
`lpwr-worktree-prune` (or the next propose) closes shipped or
pending-cleanup worktrees, behind a default cap of 2 open worktrees
(`LPWR_MAX_WORKTREES` raises it). Foundation files and the shared `docs/memos/`
stay trunk-owned and symlinked in — `state.md` never merges.

## Quickstart

Run from `harness/` (the live workspace). After any config change, quit + restart opencode.

1. `lpwr-setup` — install deps, check env/runtime, evaluate tool surface + MCP (report-only; idempotent).
2. `lpwr-install` — materialize `docs/` files from templates (missing only, never overwrite).
3. `lpwr-onboard` — guided pass producing `docs/context.md` + a drafted constitution.
4. `lpwr-guide` — read-only "what's next" helper; callable any time, from anywhere.
5. `lpwr-propose` → `lpwr-specs` → `lpwr-tasks` → `lpwr-implement` → `lpwr-review` →
   `lpwr-commit` → `lpwr-teach` — the idea-to-lesson spine.

**Worktree cap.** The open-worktree cap defaults to 2. Raise it for the
session with `LPWR_MAX_WORKTREES=4`, or persistently in `opencode.json`:

```json
{ "lpwr": { "max_worktrees": 4 } }
```

The env var wins; invalid values fall through to config; if both are absent,
the default applies. The cap is read on every check, so either edit takes
effect from the next command — no restart (rule 29).

## Install into a project

One script installs, updates, and health-checks the harness in any project:

```sh
curl -fsSL https://raw.githubusercontent.com/rebase-lat/loopwright/main/loopwright.sh \
  -o loopwright.sh && chmod +x loopwright.sh
./loopwright.sh install    # fetch a release, merge the harness into this project
./loopwright.sh install ../other-project   # or name the destination directory
./loopwright.sh doctor     # detect errors — exit 0 clean, 1 findings, 2 not installed
./loopwright.sh update     # 3-way merge a newer release over local edits
./loopwright.sh fix        # restore drifted files, install deps, heal config keys
```

`install` copies `harness/` into the project root, merges the permission
matrix into an existing `opencode.json` (JSONC comments preserved; project
keys win outside the matrix, `instructions` unions, and a pre-existing
`AGENTS.md` is kept while the protocol lands in `AGENTS.lpwr.md`), records a
checksummed `.loopwright/manifest.json`, and caches the payload for later
3-way updates. On `update`, local edits and upstream changes both merge
(`git merge-file` for files, JSONC-aware merge for configs); real conflicts
keep markers, are flagged by `doctor`, and are recorded by `fix` once the
human resolves them. Colliding files need `--yes`; every overwrite is backed
up under `.loopwright/backups/`. The repository is public, so install needs
no auth (`GITHUB_TOKEN` only raises the rate limit); `--source local <dir>`
installs from a checkout and `--version <tag>` pins a release. The target
directory is a positional argument (or `--project DIR`); `status`,
`uninstall`, and `--dry-run` cover the rest of the lifecycle — see
`./loopwright.sh --help`.

## Repo layout

```
loopwright/
├── README.md
├── PRINCIPLES.md               # design intent (resume of the former principles essays)
├── LICENSE                     # MIT
├── CHANGELOG.md
├── package.json                # npm scripts: lint, fmt, fmt:check, typecheck, test; version 1.4.6
├── loopwright.sh               # installer: install/update/doctor/fix/status/uninstall for harness/
├── opencode.json               # developer MCP + LSP config — distinct from harness/opencode.json (shipped matrix)
├── constitution.md             # this repo's own rules — the committed record for humans (harness ships without one; onboard creates harness/docs/constitution.md, which is what the gates read)
├── context.md                  # this repo's own context — documents both roots and that split (same: generated per project by onboard)
├── integration-analysis.md     # the single audit trail — one `# Round N` per review/simulation pass; Rounds 7–8 carry the folded 1.4.2–1.4.4 originals (repo history, not shipped)
├── CONTRIBUTING.md             # repo-development rules: audit findings go into integration-analysis.md as the next round, never a new root file
├── harness/                    # pure boilerplate — no prefilled project info (run opencode from here)
│   ├── AGENTS.md               # protocol only — rules 1–13 here; floors in docs/constitution.md, checklist in docs/implementation-rules.md
│   ├── .gitignore              # generated foundation + secrets stay untracked (root install)
│   ├── opencode.json           # permission matrix (single source), instructions
│   ├── tui.json                # TUI plugin wiring — loads .opencode/tui/ (relative path, no build)
│   ├── .opencode/
│   │   ├── agents/             # 9 role files (orchestrator, builder, planner, scribe, reviewer, triage seats, scout)
│   │   ├── commands/           # 27 flat lpwr-* commands, each declaring its Stage:
│   │   ├── skills/             # 17 lpwr-* procedures (SKILL.md + trigger descriptions)
│   │   ├── plugins/            # 12 lpwr-* plugins (gates, journaling, advisories, worktree lifecycle —
│   │   │                       #   auto-discovered; typechecked via root tsconfig.json)
│   │   ├── lib/                # worktree.ts (worktree lifecycle service, npm test) + shared.ts (plugin helpers,
│   │   │                       #   worktree/journal resolution) + gates.ts (pure gate predicates, npm test)
│   │   │                       #   + installer-lib.mjs (JSONC merge / manifest / verify for loopwright.sh)
│   │   └── tui/                # lpwr-tui.tsx — read-only workflow-pulse sidebar (session view)
│   ├── docs/                   # glossary + conventions + implementation-rules, kept in git;
│   │                           #   generated foundation files (constitution, context, state.md, audit.md,
│   │                           #   memos/) are gitignored — recreate via lpwr-install + lpwr-onboard
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
| Cross-cutting | `lpwr-guide`, `lpwr-worktree-status`, `lpwr-worktree-prune` |

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

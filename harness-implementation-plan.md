# Harness Implementation Plan (opencode workspace in `harness/`)

Target workspace: `./harness/` (empty dir at repo root). Design refs stay at root: `harness-layout.md`, `harness-principles.md`, `cross-module-connections.md`.
Decisions: full harness phased / enforce plugins as specified / full permission+model matrix.

All repo-relative paths below are rooted at `harness/` unless noted. After every config-phase change: quit + restart opencode (no hot-reload).

## Phase 0 — Baseline + schema validation [done 2026-09-19]

- [x] Fetch `https://opencode.ai/config.json` and confirm exact shapes for `agent`, `command`, `permission`, `plugin`, `mcp`, `skills`, `references`
- [x] Confirm `harness/opencode.json` location (`./harness/opencode.json`) with `"$schema": "https://opencode.ai/config.json"`
- [x] Normalize known mismatches from `harness-layout.md` §6:
  - [x] `write: allow/deny` → opencode key `edit` (schema confirms: `read,edit,glob,grep,list,bash,task,external_directory,todowrite,question,webfetch,websearch,lsp,doom_loop,skill`; `webfetch` flat-action only)
  - [x] `.opencode/plugins/*.ts` auto-discovered, no `plugin[]` entry unless options needed
  - [x] `.opencode/tools/` has no opencode equivalent → map to `mcp:` or plugin `tool:`, or drop (dropped in Phase 1)
  - [x] Nested commands `.opencode/commands/govern/*.md` rely on `**/*.md` scan → verify invoked command name before wiring cross-refs (open: verify at runtime in Phase 5)
  - [x] `command.execute.before` hook used by `spec-link.ts` → validate against installed `@opencode-ai/plugin` version (open: validate in Phase 3; opencode 1.18.31 installed)
- [x] Verify cold-start fallback: `OPENCODE_DISABLE_PROJECT_CONFIG=1`

- [ ] Fetch `https://opencode.ai/config.json` and confirm exact shapes for `agent`, `command`, `permission`, `plugin`, `mcp`, `skills`, `references`
- [ ] Confirm `harness/opencode.json` location (`./harness/opencode.json`) with `"$schema": "https://opencode.ai/config.json"`
- [ ] Normalize known mismatches from `harness-layout.md` §6:
  - [ ] `write: allow/deny` → opencode key `edit`
  - [ ] `.opencode/plugins/*.ts` auto-discovered, no `plugin[]` entry unless options needed
  - [ ] `.opencode/tools/` has no opencode equivalent → map to `mcp:` or plugin `tool:`, or drop
  - [ ] Nested commands `.opencode/commands/govern/*.md` rely on `**/*.md` scan → verify invoked command name before wiring cross-refs
  - [ ] `command.execute.before` hook used by `spec-link.ts` → validate against installed `@opencode-ai/plugin` version
- [ ] Verify cold-start fallback: `OPENCODE_DISABLE_PROJECT_CONFIG=1`

## Phase 1 — Govern foundation [done 2026-09-19]

- [x] `harness/AGENTS.md` — protocol + pointer to constitution only, never rules
- [x] `harness/opencode.json` skeleton — `$schema`, `instructions: ["AGENTS.md"]`, empty `agent`/`permission` tables
- [x] `harness/docs/constitution.md`, `harness/docs/glossary.md` (banned substitutes), `harness/docs/stack.md`, `harness/docs/standards/`, `harness/docs/state.md`
- [x] `harness/templates/` (7 files, full content from `harness-layout.md` §5): `constitution.md`, `proposal.md`, `spec.md`, `tasks.md`, `review.md`, `lesson.md`, `state.md`
- [x] Commands `harness/.opencode/commands/govern/` — `constitution.md`, `codebase.md`, `domain.md`, `stack.md` (file form, `description` + `template` body, `$ARGUMENTS` for IDs)
- [x] Gate: opencode starts clean; `/constitution` round-trips

Note: `templates/proposal.md` is derived (layout §5 omits its full content); closes the Frame → Specify `proposal_ref` link.

- [ ] `harness/AGENTS.md` — protocol + pointer to constitution only, never rules
- [ ] `harness/opencode.json` skeleton — `$schema`, `instructions: ["AGENTS.md"]`, empty `agent`/`permission` tables
- [ ] `harness/docs/constitution.md`, `harness/docs/glossary.md` (banned substitutes), `harness/docs/stack.md`, `harness/docs/standards/`, `harness/docs/state.md`
- [ ] `harness/templates/` (7 files, full content from `harness-layout.md` §5): `constitution.md`, `proposal.md`, `spec.md`, `tasks.md`, `review.md`, `lesson.md`, `state.md`
- [ ] Commands `harness/.opencode/commands/govern/` — `constitution.md`, `codebase.md`, `domain.md`, `stack.md` (file form, `description` + `template` body, `$ARGUMENTS` for IDs)
- [ ] Gate: opencode starts clean; `/constitution` round-trips

## Phase 2 — Frame + Specify (read-only) [done 2026-09-19]

- [x] Agents in `harness/.opencode/agents/` (file form, `mode: subagent`, no `model` — inherits; global config sets none, matrix lands in Phase 5):
  - [x] `plan.md` (Frame/Specify primary seat; `edit: deny, bash: deny, webfetch: allow`)
  - [x] `neutral.md` (triage seat 1; all deny)
  - [x] `deep-expert.md` (triage seat 2; `webfetch: allow`)
  - [x] `applied-judge.md` (triage seat 3; all deny)
- [x] Commands `harness/.opencode/commands/frame/` — `propose.md` (triage fan-out), `interview.md`, `research.md`, `improve.md`
- [x] Commands `harness/.opencode/commands/specify/` — `specs.md` (loads constitution + glossary, emits EARS-typed criteria), `tasks.md`
- [x] Skills in `harness/.opencode/skills/<name>/SKILL.md` (each with `name` + `description` frontmatter): `writing-ears`, `acceptance-criteria`, `option-triage`, `explain-back`, `primary-sources`, `context-economy`
- [x] Traceability wired: `spec.md` frontmatter `id: <domain>-<sequence>`, `status: draft|approved|superseded`, `proposal_ref`; criterion sub-IDs `<id>-<n>`
- [x] Gate: triage debate stays read-only, never writes `docs/` directly; only human pick becomes `proposal.md`

- [ ] Agents in `harness/.opencode/agents/` (file form, `mode: subagent`, explicit `model: provider/model-id`):
  - [ ] `plan.md` (Frame/Specify primary seat; `edit: deny, bash: deny`)
  - [ ] `neutral.md` (triage seat 1; all deny)
  - [ ] `deep-expert.md` (triage seat 2; `webfetch: allow`)
  - [ ] `applied-judge.md` (triage seat 3; all deny)
- [ ] Commands `harness/.opencode/commands/frame/` — `propose.md` (triage fan-out), `interview.md`, `research.md`, `improve.md`
- [ ] Commands `harness/.opencode/commands/specify/` — `specs.md` (loads constitution + glossary, emits EARS-typed criteria), `tasks.md`
- [ ] Skills in `harness/.opencode/skills/<name>/SKILL.md` (each with `name` + `description` frontmatter): `writing-ears`, `acceptance-criteria`, `option-triage`, `explain-back`, `primary-sources`, `context-economy`
- [ ] Traceability wired: `spec.md` frontmatter `id: <domain>-<sequence>`, `status: draft|approved|superseded`, `proposal_ref`; criterion sub-IDs `<id>-<n>`
- [ ] Gate: triage debate stays read-only, never writes `docs/` directly; only human pick becomes `proposal.md`

## Phase 3 — Execute (write-isolated) [done 2026-09-19]

- [x] Agents:
  - [x] `harness/.opencode/agents/build.md` (`mode: primary`, `edit: allow`, `bash: ask`, `webfetch: deny`)
  - [x] `harness/.opencode/agents/scout.md` (ephemeral retrieval-only, returns summaries)
- [x] Commands `harness/.opencode/commands/execute/` — `implement.md` (thin; refs `@docs/specs/$SPEC_ID/tasks.md` + `acceptance-criteria` skill + `log.ndjson` append), `diagnose.md`
- [x] Skills: `diff-reading`, `repro-minimisation`, `boundary-audit`, `root-cause-refactor`
- [x] Plugins in `harness/.opencode/plugins/` (enforce as specified):
  - [x] `scope-guard.ts` — blocks `edit`/`write` outside `tasks.md` declared surface via `OPENCODE_SPEC_ID` (helpers `readDeclaredSurface`/`matchesAny` implemented; spec folder always allowed)
  - [x] `spec-link.ts` — refuses `/implement` without `status: approved` (FIXED vs layout: frontmatter parsed for `status:` line instead of `startsWith("---\nstatus: approved")`, which never matches our spec template)
  - [x] `trap-flags.ts` — achievement (>3 patches) + dislodging (15-min) advisory warns
- [x] Gate: unapproved spec blocked live; out-of-surface edit blocked live (runtime verification deferred to Phase 5)
- [x] `command.execute.before` signature: kept per skill hook surface; runtime shape of `output.command`/`output.args` to confirm in Phase 5 (matcher broadened to `/(^|[/:])implement$/`)

- [ ] Agents:
  - [ ] `harness/.opencode/agents/build.md` (`mode: primary`, `edit: allow`, `bash: ask`, `webfetch: deny`)
  - [ ] `harness/.opencode/agents/scout.md` (ephemeral retrieval-only, returns summaries)
- [ ] Commands `harness/.opencode/commands/execute/` — `implement.md` (thin; refs `@docs/specs/$SPEC_ID/tasks.md` + `acceptance-criteria` skill + `log.ndjson` append), `diagnose.md`
- [ ] Skills: `diff-reading`, `repro-minimisation`, `boundary-audit`, `root-cause-refactor`
- [ ] Plugins in `harness/.opencode/plugins/` (enforce as specified):
  - [ ] `scope-guard.ts` — blocks `edit`/`write` outside `tasks.md` declared surface via `OPENCODE_SPEC_ID`
  - [ ] `spec-link.ts` — refuses `/implement` without `status: approved`
  - [ ] `trap-flags.ts` — achievement (>3 patches) + dislodging (15-min) advisory warns
- [ ] Gate: unapproved spec blocked live; out-of-surface edit blocked live

## Phase 4 — Verify + Retain (gates + memory) [done 2026-09-19]

- [x] Agent `harness/.opencode/agents/reviewer.md` (`mode: subagent`, all deny, standards + specs axes)
- [x] Commands `harness/.opencode/commands/verify/` — `review.md` (both axes before verdict), `goal.md`, `release.md` (only fires on recorded `ship`)
- [x] Commands `harness/.opencode/commands/retain/` — `commit.md` (requires `ship`, tags spec ID, single writer of `state.md`), `teach.md`
- [x] Skill: `commit-grouping`
- [x] Plugins:
  - [x] `evidence-log.ts` — journals `{intent,spec_ref,payload}` bus events to `harness/docs/specs/<id>/log.ndjson` via the `event` catch-all (closed intent set validated, `spec_ref` → dir mapping, never throws; agents also append directly per command prompts)
  - [x] `context-compactor.ts` — prunes tool output at `experimental.session.compacting`, never diff/tests/logs/why (protected markers; unrecognized shapes pass through untouched)
- [x] A2A vocabulary closed set `frame|specify|execute|verify|retain|govern`; payload always artifact pointer, never inline diff
- [x] Gate: `ship/block/redirect` recorded in `review.md`; `redirect` re-opens via new `/propose`
- [x] Note: `command.execute.after` is NOT in the skill hook surface, so both plugins avoid it (`event` + `experimental.session.compacting` only); runtime confirmation deferred to Phase 5

- [ ] Agent `harness/.opencode/agents/reviewer.md` (`mode: subagent`, all deny, standards + specs axes)
- [ ] Commands `harness/.opencode/commands/verify/` — `review.md` (both axes before verdict), `goal.md`, `release.md` (only fires on recorded `ship`)
- [ ] Commands `harness/.opencode/commands/retain/` — `commit.md` (requires `ship`, tags spec ID, single writer of `state.md`), `teach.md`
- [ ] Skill: `commit-grouping`
- [ ] Plugins:
  - [ ] `evidence-log.ts` — appends A2A `{"intent","spec_ref","payload","confidence"}` lines to `harness/docs/specs/<id>/log.ndjson`
  - [ ] `context-compactor.ts` — prunes tool output, never diff/tests/logs/why
- [ ] A2A vocabulary closed set `frame|specify|execute|verify|retain|govern`; payload always artifact pointer, never inline diff
- [ ] Gate: `ship/block/redirect` recorded in `review.md`; `redirect` re-opens via new `/propose`

## Phase 5 — Hardening + team conventions [done 2026-09-19]

- [x] `harness/opencode.json` full matrix — per-agent `permission` (corrected `edit` key), `default_agent: build`, top-level `permission: {}` (inherit); models intentionally UNSET per user decision (all inherit runtime default; pin when the team standardizes)
- [x] Permissions single-sourced in `opencode.json` (stripped from 7 agent `.md` files); `scout` additionally `task: deny` (leaf agent)
- [x] `harness/docs/conventions.md` — worktrees per spec ID, config precedence, permissions/model policy, harness-changes-like-code, ≤2 worktrees, inline completion off
- [x] Cold-start validation: `opencode agent list` from `harness/` loads all 7 harness agents with correct modes (JSONC comments accepted); `AGENTS.md` instructions inject confirmed
- [x] Plugin typecheck: `tsc --strict` against real `@opencode-ai/plugin` — zero errors on all 5 plugins
- [x] Logic dry-run: `spec-link` frontmatter parse + `evidence-log` spec-ref→dir mapping verified against real templates (`auth-014-3` → `auth-014`; FIXED: inline `#` comments now stripped from `status:` values)
- [x] Frontmatter sweep: 35/35 agent/command/skill files valid
- [ ] Deferred (need live session + model calls): `/implement` block on unapproved spec, `scope-guard` block on out-of-surface edit, `command.execute.before` arg-shape confirmation, end-to-end `auth-xxx` dry-run Govern → Retain

- [ ] `harness/opencode.json` full matrix — per-agent `model` + `permission` (corrected `edit` key); top-level `permission` defaults; `formatter`/`lsp`/`tool_output`/`compaction` as needed
- [ ] Conventions: worktrees per spec ID (`OPENCODE_SPEC_ID` env), repo `harness/.opencode/` authoritative vs `~/.config/opencode/` ergonomics-only, harness changes via `/propose` → `/review`, ≤2 concurrent worktrees, inline completion off
- [ ] End-to-end `auth-xxx` dry-run Govern → Retain inside `harness/`; check ID joins and `log.ndjson` completeness
- [ ] Final restart test from `harness/` as cwd

## Risks / open validations

- [ ] Nested command invocation names
- [ ] `write` → `edit` rename applied everywhere
- [ ] `tools/` mapping resolved
- [ ] Plugin API drift checked against installed version

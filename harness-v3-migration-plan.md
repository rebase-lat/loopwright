# Harness v3 Migration Plan (implementation-guide-v3.md → `harness/`)

Starting point: `/customize-opencode` skill. Target: flat `lpwr-*` command set, prefixed skills +
plugins, Bootstrap stage, `docs/context.md`, `docs/stack.md` folded away. Agents, templates
(except +`context.md`), A2A schema, ID scheme, `opencode.json` structure, and the permission
matrix are explicitly unchanged.

Decisions already locked (2026-09-19): `docs/stack.md` deleted with refs redirected to
`docs/context.md`; lessons revert to v3's `<date>-<id>.md` (supersedes the naming-conventions
dateless call on this point); all 6 current plugins take the `lpwr-` prefix; `lpwr-guide`
runs on the read-only `plan` agent instead of a new stateful plugin.

## Skill-derived constraints (do not violate during migration)

- Commands: loader scans `**/*.md`; file `lpwr-foo.md` is command `lpwr-foo`. Frontmatter allows
  only `description, agent, model, variant, subtask` — rule 37's stage declaration goes in an
  opening body line (`Stage: <Stage>`), never in frontmatter (unknown-key behavior for commands
  is unspecified; only agents route unknowns to `options`).
- Skills: folder rename requires `name:` frontmatter to match exactly (`lpwr-*`, all ≤64 chars).
  No `skills.paths` change needed — `.opencode/skills/` is the default scan root.
- Plugins: auto-discovery by `*.ts` in `.opencode/plugins/` keeps working through renames.
  v3's "plugin array now lists lpwr-* entries" is explicitly declined — auto-discovery is
  verified working (opencode created `.opencode/.gitignore` on load) and a redundant array
  is a second source of truth.
- `opencode.json`: no structural change (no new agents, no model changes, no permission changes).
- After any config change: quit + restart opencode; re-verify with `agent list` from `harness/`.

## Phase A — Renames (all via `git mv`, history-preserving) [done]

- [x] 17 commands flat

- [x] 17 commands flat: `govern/{constitution,codebase,domain,stack}` → `lpwr-{constitution,codebase,domain,stack}.md`;
  `frame/{propose,interview,research,improve}` → `lpwr-*.md`; `specify/{specs,tasks}` → `lpwr-specs.md`,
  `lpwr-tasks.md`; `execute/{implement,diagnose}` → `lpwr-implement.md`, `lpwr-diagnose.md`;
  `verify/{review,goal,release}` → `lpwr-review.md`, `lpwr-goal.md`, `lpwr-release.md`;
  `retain/{commit,teach}` → `lpwr-commit.md`, `lpwr-teach.md`. Delete emptied domain dirs.
- [x] 11 skills: folder → `lpwr-<name>/`, `name:` frontmatter → `lpwr-<name>`.
- [x] 6 plugins: `scope-guard` → `lpwr-scope-guard.ts`, `spec-link` → `lpwr-spec-link.ts`,
  `flag-traps` → `lpwr-flag-traps.ts`, `log-handoffs` → `lpwr-log-handoffs.ts`,
  `guard-compaction` → `lpwr-guard-compaction.ts`, `verdict-gate` → `lpwr-verdict-gate.ts`.
- [x] Add opening `Stage: <Stage>` line to all 20 command bodies (rule 37).

## Phase B — Reference sweep (every cross-name updated, then grep to zero) [done 2026-09-19]

- [x] Command→command: `/propose`, `/review`, `/specs`, `/implement`, `/commit` mentions →
  `lpwr-` names (constitution + specs + review + release + commit commands, `AGENTS.md`).
- [x] Command→skill: `Use skill X` refs → `lpwr-` names (implement, propose, specs, research,
  commit, diagnose commands).
- [x] Command→plugin: `commit.md`'s `` `verdict-gate.ts` `` → `` `lpwr-verdict-gate.ts` ``.
- [x] Agent prose: `build.md` (`flag-traps`, `spec-link` mentions) → prefixed names.
- [x] Skill prose: `root-cause-refactor` description (`flag-traps fires`) → `lpwr-flag-traps`.
- [x] `docs/stack.md` refs → `docs/context.md` stack section (implement, diagnose, build agent,
  specs table, `lpwr-stack` command body). Then `git rm docs/stack.md`.
- [x] Lessons path revert → `docs/lessons/<date>-<id>.md` (commit command, commit-grouping skill,
  cross-module-connections, harness-layout).
- [x] Verify: grep for bare old names (`trap-flags`, `evidence-log`, `context-compactor`,
  unprefixed skill/command refs, `stack.md`, `<id>.md` lesson paths) excluding node_modules
  and this plan's history sections → zero hits. Re-run frontmatter + skill name==folder sweeps
  (20 commands, 7 agents, 11 skills).

## Phase C — New artifacts (Bootstrap + Govern front door + guide)

- [ ] `lpwr-setup.md` (Bootstrap, no `agent:` override → default build for shell): install via
  repo manifest, prompt-for (never store) secrets, verify node 20+ / npm / opencode / plugin
  load (`agent list`); idempotent no-op with confirmation on re-run; writes nothing under
  `docs/`; no spec ID (rule 33). Adapt v3's Bun check to what's real (node runtime; loader
  already proven by `.opencode/.gitignore` auto-creation).
- [ ] `lpwr-onboard.md` (Govern, `agent: plan`): single guided pass → `docs/context.md`
  (codebase / domain / stack / principles-pointer) + drafted constitution from findings;
  thin sections allowed on greenfield (rule 35). Constitution stays human-approved on demand
  (standing rule) — onboard drafts, never approves.
- [ ] `lpwr-guide.md` (cross-cutting, `agent: plan` — read-only enforced by `edit: deny`
  permission config, per decision; no new plugin): body encodes v3 §3.3's 10-step decision
  path; suggests only, never writes (not to `state.md`, not to the log).
- [ ] `templates/context.md` (v3 §6 shape verbatim) + initial thin `docs/context.md` for the
  harness repo itself (TS plugins, opencode config, npm toolchain) + `docs/memos/`,
  `docs/lessons/` dirs.

## Phase D — Verification + close-out

- [ ] `npm run lint`, `npm run fmt:check`, `npm run typecheck` green (dir-scoped globs cover
  renames; md excluded by policy).
- [ ] Cold-start: fresh opencode session from `harness/`, `agent list` shows 7 agents;
  flat `lpwr-*` commands resolve (same check as the confirmed nested invocation).
- [ ] Root design docs (`harness-layout.md`, `cross-module-connections.md`,
  `implementation-rules.md`) get mechanical reference updates; phase log above stays as
  history. `implementation-guide-v3.md` committed alongside.
- [ ] Commit per phase (standing rule); restart reminder on completion.

## Explicit non-changes

Agents (names, roles, permissions), A2A schema + intent vocabulary, traceability ID scheme,
`opencode.json`, templates except `+context.md`, oxlint/oxfmt/tsconfig setup.
Known accepted deviations carried forward: noun commands from the layout contract
(`/specs`, `/tasks`, `/goal` — now `lpwr-` prefixed nouns), `decision` left unbanned in
the glossary (definition-use vs synonym-use).

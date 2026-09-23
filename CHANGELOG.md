# Changelog

All notable changes to this project, grouped by git tag. See the commit
history for per-change detail.

## [1.1.1] — 2026-09-23

- Permission matrix names every known builtin on all eight agents (omitted
  tools default allow); global `mcp_*` and `websearch` deny, `doom_loop` /
  `external_directory` ask; `lsp` allow only on builder, `websearch` allow
  only on deep-expert; `question` denied on triage leaves.
- Structured human picks go through the `question` tool (risk tier, design
  review, verdict, option selection, interview rounds); Execute and Bootstrap
  seed `todowrite` from their checklists without journaling `todo.updated`
  (rule 48 + conventions).
- `lpwr-setup` step 4 evaluates the tool surface and MCP servers report-only —
  flags rule-16 gaps and emits copy-pasteable permission keys; never patches
  `opencode.json`. Env flags (`OPENCODE_ENABLE_EXA`/`_PARALLEL`,
  `OPENCODE_EXPERIMENTAL_LSP_TOOL`) documented, not flipped.
- `apply_patch` handled across gates: scope-guard parses `*** … File:` marker
  paths, secret scan pre-writes pending `patchText`, flag-traps counts edits
  when a real `filePath` is present.
- Advisories replace `console.warn` with `logWarn` (`client.app.log`) and a
  shared one-shot `toastWarning`; permission denials and setup gaps log
  structured warns (setup aggregates one toast).
- Verdict-gate strips inline comments and code spans before the
  template-leftover check so format hints no longer false-positive;
  `templates/review.md` deferred hint de-bracketed.
- Execute handoff artifact is the criterion id (never a commit SHA — SHAs
  appear only on the `retain` handoff after `lpwr-commit`).

## [1.0.0] — 2026-09-22

First stable release.

- Alignment passes across the harness: commands end with a canonical `Output:`
  line; skills use one skeleton (H1 + intro + bullets, no `Output:`/`$ARGUMENTS`);
  agents use `## Persona / Permission / Responsibilities / Skills / Limits` with
  true stage claims; templates stripped of persisting instruction prose and
  frontmatter-normalized; plugins share `shared.ts` helpers.
- `lpwr-codebase` removed (sole glossary writer is `lpwr-domain`); orphaned
  `templates/audit.md` and `harness/docs/standards/` deleted; audit shape
  owned by `lpwr-security-scan`.
- Commit gate 2 mechanized (non-retain `log.ndjson` line required);
  `lpwr-specify` added to the journal hook map; security-scan anchors to
  `plugin.directory` with spec-ID path validation.
- Agents renamed off built-in collisions: `build` → `builder`, `plan` →
  `planner`; `shared.ts` carries a no-op default Plugin export for discovery.
- Root `docs/` retired: design history removed; `implementation-rules.md` moved
  to `harness/docs/`; principles essays synthesized into root `PRINCIPLES.md`.
- MIT `LICENSE` added; `package.json` version 1.0.0.

## [0.7.1]

- Waiver tags go inline (`waived:` / `deferred:` single-line values) so they
  no longer scan as pending tasks; empty markers (`none`, `[]`) and the
  legacy list form both validate.
- Lifecycle status unified on `approved` across proposal, spec, and ADR.

## [0.7.0]

- Verdict gate hardened: Verdict section parsed with exactly-one-of
  Ship/Block/Redirect required, placeholder test references rejected,
  threat-review needs a real "Acceptable to proceed" tick, state.md Blocked
  checked on commit/release, post-ship `lpwr-amend` refused (state Done or
  matching commit subject), and a raw `git commit` gated on spec-shaped
  branches under the same checks as `/lpwr-commit`.
- Secret scanning pre-write (pending edit/write content) and on staged
  diffs at commit; obvious fixture values (`test`, `changeme`, `dummy`,
  `placeholder`, `xxx…`) no longer count as secrets; oversized files warn
  instead of skipping silently.
- Plugins anchor all file reads to their own directory (spec-link, scope-guard,
  guard-bootstrap, log-handoffs) and normalize CRLF before frontmatter
  parsing — subdirectory cwd and Windows-authored files no longer bypass gates.
- Handoff lines written from command hooks carry `origin: "hook"` (no
  `command.execute.after` exists to tag completion); release journals its
  spec folder rather than a phantom `review.md` pointer; journal resolution
  prefers an existing spec folder before stripping trailing sequence digits.
- Permissions: scribe gains ask-level bash/webfetch (review git history,
  research primary sources, onboard MCP list — each human-confirmed),
  reviewer gains ask-level bash; conventions document that the matrix only
  enumerates known tools and that Blocked entries are human escalations.
- Review runs against the uncommitted change (`git diff HEAD`), not
  `HEAD~1..HEAD`; template `diff_ref` and the diff-reading skill match.
- Diagnose aligns with implement: repro, hypotheses, fix plan — the patch
  itself runs through `lpwr-implement`, diagnosis grounds `lpwr-propose`
  when no spec fits; teach drafts lessons for a human/scribe to file.
- Guide decision path: missing `state.md` → install first, Blocked surfaced
  early as a human stop, folder-derived resume when nothing is In flight.
- Specs resumes existing `status: draft` files instead of refusing;
  commit requires a non-`retain` log line; foundation files
  (`harness/docs/{constitution,context,state}.md`) gitignored as generated.
- Bootstrap/docs consistency: README plugin count 10 → 11, constitution
  template ships `status: draft`, ADR template drops unused `risk_tier`,
  rules 33–37 moved into `implementation-rules.md` (rule 34 updated to the
  permission-matrix enforcement), v3 guide banner marks its inventories
  historical, setup installs `.opencode/package.json` deps and notes the
  re-run after onboard, check-setup expects `state.md`.

## [0.6.1]

- Improve completeness: full candidate blocks required, no foreign verdicts
  from other domains.
- Tasks journals its specify handoff like every other spec artifact write.
- Scribe confirmations show exact contents with sources and next step;
  onboard resolves contradictions from ground truth instead of punting
  alternatives to the human.
- Stale Phase-5 model TODOs reworded to name the real trigger; propose
  journal step deduplicated.
- Standards placeholders renamed Code Principles / Project Specifics /
  Business Rules, filled by onboard from discovery.
- Pure boilerplate: live constitution/context moved to root, empty state
  dropped; `harness/` ships no prefilled project info.
- Bootstrap gate (`lpwr-guard-bootstrap`) plus `lpwr-install`: install
  materializes from templates, setup prepares, onboard fills.

## [0.6.0]

- Design review checkpoint: risk-gated ADR co-located in the spec folder,
  with specs-side refusal and `lpwr-spec-link` enforcement.
- Explore entry into Specify: observed-basis specs with an accuracy (not
  desirability) approval gate.
- Blocked specs refused via `docs/state.md`, with the tool-hook attribution
  limit documented in conventions.
- Plugin audit pass: amend journaling, blocked-ID boundary fix, standalone
  file notes.
- Case-consistent gates: liberal frontmatter reads, strict lowercase IDs.
- Guides and design docs moved to root `docs/`; repository standards
  (gitkeep coverage, editorconfig, gitattributes, node version).
- Frontmatter values documented across all templates; `audit.md` carries a
  `spec_ref` header.
- Constitution ships `draft` until onboard-approved; onboard re-runs refresh
  without clobbering and treat placeholder content as unapproved.

## [0.5.0]

- Motion narrowed to pin / memory-check / dissent capture — no more
  move/second/scrutiny/vote machinery; proposal template follows the
  motion-step guide (rules 40–42).
- New templates: `improve.md` (per-candidate `lpwr-propose` lines),
  `audit.md` (plugin output shape), `memo.md` (research output shape).
- Agent corrections: research to scribe, teach to plan-only (conversational),
  propose delegates its file write to a scribe subagent.
- Orphan skills and templates wired into commands and agents — nothing
  write-only remains.
- Shared voice persona: `lpwr-voice` skill, protocol line, rule 43.
- Audit findings warn-and-trace to `audit.md` instead of blocking implement.

## [0.4.0]

- Flat `lpwr-*` command set (v3 phases A–D); nested `commands/<domain>/`
  superseded; `lpwr-` prefix on commands, skills, plugins.
- New commands: `lpwr-setup` (Bootstrap), `lpwr-onboard` (Govern front door),
  `lpwr-guide` (read-only next-step helper); `docs/context.md` +
  `templates/context.md`; `docs/stack.md` folded away.
- Security layer: constitution floors, `risk_tier`, always-on secret scan,
  `lpwr-threat-review` for high tier, third review axis, `security-gap`
  bucket; audit gated then made constitution-declared and multi-stack.
- Deferred/waived criteria: frontmatter lists with enforced follow-ups;
  guide, goal, commit, and verdict gate all waiver-aware.
- `lpwr-amend` update path with review voiding and task reconciliation;
  scribe authoring agent (`edit: ask`).
- Naming conventions applied (verb-noun plugins, verdict language, glossary
  terms, dateless lessons); root-relative paths for project-root installs.
- TUI toasts on gate blockages and trap crossings; warning toasts once
  per cycle.
- API integrations: branch-derived spec IDs, `journal_handoff` tool, denial
  audit, setup check, branch-cache invalidation, session-error toasts.
- oxlint + oxfmt via ultracite; `tsc --strict`; root README.

## [0.3.1]

- Least privilege: `task: deny` on leaf subagents (only plan/build
  orchestrate); doc-authoring commands moved to scribe.
- Isolation conventions recorded; exact-once communication rule.

## [0.3.0]

- Deferred/waived criteria system and motion ratification (v1) in Frame.
- `lpwr-amend`, scribe agent, root-relative install paths.
- Case-consistent gates; TUI toasts; API-opportunity plugins; event hooks.
- Version 0.3.0 with 9 plugins.

## [0.2.0]

- Full harness scaffold through phases 0–5 (Govern foundation, Frame +
  Specify, Execute, Verify + Retain, hardening) plus root README.

## [0.1.0]

- Initial harness layout: six domains, traceability IDs, A2A schema,
  templates, permission matrix, five enforcing plugins.
- Naming conventions and implementation-rules gap closure.

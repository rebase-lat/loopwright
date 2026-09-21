# Changelog

All notable changes to this project, grouped by git tag. See the commit
history for per-change detail.

## [Current] — 0.6.1

- Improve completeness: full candidate blocks required, no foreign verdicts
  from other domains.
- Tasks journals its specify handoff like every other spec artifact write.
- Scribe confirmations show exact contents with sources and next step;
  onboard resolves contradictions from ground truth instead of punting
  alternatives to the human.
- Stale Phase-5 model TODOs reworded to name the real trigger; propose
  journal step deduplicated.

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

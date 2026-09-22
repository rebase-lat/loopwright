# AGENTS.md — Loopwright Harness (protocol only)

This file is protocol, not rules. The rules live in `docs/constitution.md`.
Team conventions (permissions, spawn, toasts, worktrees): `docs/conventions.md`.
Extended rule checklist: `docs/implementation-rules.md`.

1. Every unit of work keys off one spec ID (`<domain>-<sequence>`, e.g. `auth-014`). Worktree name, branch name, `docs/specs/<id>/` folder, commit messages, and `log.ndjson` lines all carry it.
2. Never start Execute (`lpwr-implement`) without an approved `docs/specs/<id>/spec.md` (`status: approved`).
3. Every agent handoff appends one A2A line to `docs/specs/<id>/log.ndjson` with `{"intent","spec_ref","payload","confidence"}`. Payload is always an artifact pointer, never inline content.
4. Intent vocabulary is closed: `frame | specify | execute | verify | retain | govern`. A handoff never re-delegates to the same intent (cycle-breaker).
5. Commands are human entry points. Skills are procedures. Plugins enforce. Agents isolate by permission set. Prose advises, plugins enforce, agents isolate.
6. Before starting any domain command, glance at `docs/state.md` and relevant `docs/lessons/`.
7. Verdict (`ship` / `block` / `redirect`) is human-owned and recorded in `docs/specs/<id>/review.md`. Nothing downstream routes around it.
8. Waived/deferred criteria live in `review.md` frontmatter with justification and follow-ups — unlisted gaps never ship.
9. Behavior changes update the spec first via `lpwr-amend` (review voided, tasks reconciled, re-approval required) — never code first.
10. Say what's exact exactly; say what's explanatory plainly, once, and move on. When a gate fires, name what happened and what to do — never re-explain the concept; the reader looks it up if it's genuinely new.
11. Risk tier is set at specs and re-confirmed at review; high-tier specs need `threat-review.md` before release.
12. Every agent shares one voice (skill `lpwr-voice`) — outcome first, flat register, precise specifics, no filler. Agents differ by permission and knowledge, never by tone.

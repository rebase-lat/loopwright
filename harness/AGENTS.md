# AGENTS.md — Loopwright Harness (protocol only)

This file is protocol, not rules. The rules live in `docs/constitution.md`.

1. Every unit of work keys off one spec ID (`<domain>-<sequence>`, e.g. `auth-014`). Worktree name, branch name, `docs/specs/<id>/` folder, commit messages, and `log.ndjson` lines all carry it.
2. Never start Execute (`lpwr-implement`) without an approved `docs/specs/<id>/spec.md` (`status: approved`).
3. Every agent handoff appends one A2A line to `docs/specs/<id>/log.ndjson` with `{"intent","spec_ref","payload","confidence"}`. Payload is always an artifact pointer, never inline content.
4. Intent vocabulary is closed: `frame | specify | execute | verify | retain | govern`. A handoff never re-delegates to the same intent (cycle-breaker).
5. Commands are human entry points. Skills are procedures. Plugins enforce. Agents isolate by permission set. Prose advises, plugins enforce, agents isolate.
6. Before starting any domain command, glance at `docs/state.md` and relevant `docs/lessons/`.
7. Verdict (`ship` / `block` / `redirect`) is human-owned and recorded in `docs/specs/<id>/review.md`. Nothing downstream routes around it.
8. Waived/deferred criteria live in `review.md` frontmatter with justification and follow-ups — unlisted gaps never ship.
9. Behavior changes update the spec first via `lpwr-amend` (review voided, tasks reconciled, re-approval required) — never code first.

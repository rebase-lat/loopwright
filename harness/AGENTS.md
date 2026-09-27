# AGENTS.md — Loopwright Harness (protocol only)

This file is protocol: rules 1–13 below. `docs/constitution.md` holds the
ubiquitous floors (EARS), verdict floor, and verdict authority — generated per
workspace by `lpwr-install` + `lpwr-onboard`, not the numbered rules.
`docs/implementation-rules.md` is the extended checklist with its own 1–52
numbering. The two sets overlap (`rule 9` means different things in each), so
cite every rule by source: `AGENTS rule N` or `implementation-rules N`.
Team conventions (permissions, spawn, toasts, worktrees): `docs/conventions.md`.

1. Every unit of work keys off one spec ID (`<domain>-<sequence>`, e.g. `auth-014`). Worktree name, branch name, `docs/specs/<id>/` folder, commit messages, and `log.ndjson` lines all carry it.
2. Never start Execute (`lpwr-implement`) without an approved `docs/specs/<id>/spec.md` (`status: approved`).
3. Every agent handoff appends one A2A line to `docs/specs/<id>/log.ndjson` with `{"intent","spec_ref","payload","confidence"}`. Payload is always an artifact pointer, never inline content.
4. Intent vocabulary is closed: `frame | specify | execute | verify | retain | govern`. A handoff never re-delegates to the same intent (cycle-breaker).
5. Commands are human entry points. Skills are procedures. Plugins enforce. Agents isolate by permission set. Prose advises, plugins enforce, agents isolate.
6. Before starting any domain command, glance at `docs/state.md` and relevant `docs/lessons/`.
7. Verdict (`ship` / `block` / `redirect`) is human-owned and recorded in `docs/specs/<id>/review.md`. Nothing downstream routes around it.
8. Waived/deferred criteria live in `review.md` frontmatter with justification and follow-ups — unlisted gaps never ship. Unresolved open questions and unbound threat findings have no criterion ID: promote them to real criteria at specify/review time so the deferred path works.
9. Behavior changes update the spec first via `lpwr-amend` (review voided, tasks reconciled, re-approval required) — never code first.
10. Say what's exact exactly; say what's explanatory plainly, once, and move on. When a gate fires, name what happened and what to do — never re-explain the concept; the reader looks it up if it's genuinely new.
11. Risk tier is set at specs and re-confirmed at review; high-tier specs need `threat-review.md` before release.
12. Every agent shares one voice (skill `lpwr-voice`) — outcome first, flat register, precise specifics, no filler. Agents differ by permission and knowledge, never by tone.
13. The worktree lifecycle is explicit, never implied: trunk mints (`lpwr-propose` / `lpwr-explore` journal, then call `worktree_mint`), the human restarts opencode in the reported worktree, work-stage commands run only there, `lpwr-commit` squash-merges and marks the worktree pending cleanup in `.loop-worktrees/manifest.json`, and `lpwr-worktree-prune` (or the next `lpwr-propose`) closes shipped or pending-cleanup worktrees. Open worktrees are capped at 2 by default (`LPWR_MAX_WORKTREES` / `lpwr.max_worktrees` in `opencode.json`); a session never prunes the worktree it runs from.

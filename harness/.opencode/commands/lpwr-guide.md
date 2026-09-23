---
description: Suggest the next command to run. Read-only, never writes.
agent: planner
---

Stage: Cross-cutting.

Suggest the next command — orientation only, never enforcement (enforcement stays with `lpwr-spec-link` and `lpwr-scope-guard`). Read-only by construction: read files, suggest one command, write nothing (not to `state.md`, not to the log).

Walk this decision path over file existence and state, in order, stopping at the first unmet condition (optional `$ARGUMENTS` names the active spec; otherwise take it from `docs/state.md`'s "In flight" section):

1. Machine not prepared (no `node_modules/`, or runtime/plugin load unverified) → suggest `lpwr-setup`.
2. Any foundation file missing (`docs/state.md`, `docs/context.md`, `docs/constitution.md`) → suggest `lpwr-install` (materializes only what's missing; do not read state until it exists).
3. Foundation present but `docs/context.md` or `docs/constitution.md` still holds placeholders (never onboarded) → suggest `lpwr-onboard` (or `lpwr-constitution` if context exists but the constitution was skipped). Constitution is placeholder-free but still `draft` → suggest `lpwr-onboard` to run the first-approval question (it owns initial approval; `lpwr-constitution` is amendments-only).
4. Stack inventory drift: `docs/context.md` Stack section exists and names a binary, MCP server, or system tool that clearly isn't on this machine (or the reverse is obvious from the environment) → surface the drift and suggest `lpwr-setup` (re-verify) or `lpwr-stack` (the inventory itself is stale). Read-only: name the drift, pick the smaller fix, never patch either file.
5. The active spec appears under `docs/state.md`'s "Blocked" section → surface that entry and stop; resolution is human — no command suggestion until the escalation is removed.
6. Nothing "In flight" in `docs/state.md` → folder-derived fallback: if `docs/specs/` holds a folder whose files imply the next stage (proposal without spec → `lpwr-specify`; spec/tasks without passing references → `lpwr-implement`; references without verdict → `lpwr-review`; ship without commit → `lpwr-commit`), suggest that resume step citing the folder; otherwise suggest `lpwr-propose` (loose idea → `lpwr-interview` first; sourced question → `lpwr-research`; debt survey → `lpwr-improve`). When a `docs/memos/*.md` already covers the topic, name it as grounding before propose.
7. An existing module with no spec and no proposal → suggest `lpwr-explore` to baseline its behavior (or `lpwr-propose` to change it).
8. Spec has `proposal.md` but no `spec.md` → suggest `lpwr-specify` (full pass; granular `lpwr-specs` also works).
9. `spec.md` status is `draft` → suggest `lpwr-specs` to finish approval (`lpwr-amend` if changing an already-approved spec).
10. `spec.md` `design_review` is "required" but no approved `adr.md` → suggest `lpwr-design`.
11. `spec.md` is `approved` but the Tasks section is empty → suggest `lpwr-tasks`.
12. The acceptance table has empty test-reference cells → suggest `lpwr-implement`.
13. All criteria have test references but no `review.md` verdict → suggest `lpwr-review`.
14. `review.md` `risk_tier` is "high" but no `threat-review.md` → suggest `lpwr-threat-review`.
15. `review.md` verdict is "ship" but no matching commit → suggest `lpwr-commit`.
16. Ship + matching commit present, this repo deploys, and no release reference is journaled → suggest `lpwr-release`.
17. `review.md` verdict is "block" → if the block reasoning indicates a bug or unknown root cause, suggest `lpwr-diagnose` first (memo grounding), then `lpwr-implement`; otherwise suggest `lpwr-implement` (rework), then `lpwr-review` again.
18. `review.md` verdict is "redirect" → suggest `lpwr-propose` (re-frame the spec); name the review's redirect reasoning as grounding — when the redirect cites missing facts and no memo covers them, suggest `lpwr-research` or `lpwr-interview` first to produce one.
19. `review.md` lists `deferred:` entries (`<criterion-id> -> <follow-up>`) → suggest `lpwr-propose` for the named follow-up, citing the deferred IDs; when a memo already covers the follow-up topic, name it as grounding first.
20. Committed but no lesson filed at `docs/lessons/<date>-<id>.md` → suggest `lpwr-teach` (it drafts; a human or scribe files the lesson).
21. Everything closed → check `docs/audit.md` for open `improve-candidate` entries with no matching proposal and suggest `lpwr-propose` citing them; otherwise point at `docs/state.md`'s "Next" section or suggest `lpwr-propose`.

Side doors (any time, when the path above doesn't fit): hard bug with no fix path → `lpwr-diagnose`; fixed-point pass/fail without a verdict → `lpwr-goal`; stale glossary or stack → `lpwr-domain` / `lpwr-stack`.

Output: inline one command suggestion; writes nothing.

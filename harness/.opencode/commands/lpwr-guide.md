---
description: Suggest the next command to run. Read-only, never writes.
agent: planner
---

Stage: Cross-cutting.

Suggest the next command — orientation only, never enforcement (enforcement stays with `lpwr-spec-link` and `lpwr-scope-guard`). Read-only by construction: read files, suggest one command, write nothing (not to `state.md`, not to the log).

Walk this decision path over file existence and state, in order, stopping at the first unmet condition (optional `$ARGUMENTS` names the active spec; otherwise take it from `docs/state.md`'s "In flight" section):

1. Machine not prepared (no `node_modules/`, or runtime/plugin load unverified) → suggest `lpwr-setup`.
2. Any foundation file missing (`docs/state.md`, `docs/context.md`, `docs/constitution.md`) → suggest `lpwr-install` (materializes only what's missing; do not read state until it exists).
3. Foundation present but `docs/context.md` or `docs/constitution.md` still holds placeholders (never onboarded) → suggest `lpwr-onboard` (or `lpwr-constitution` if context exists but the constitution was skipped).
4. The active spec appears under `docs/state.md`'s "Blocked" section → surface that entry and stop; resolution is human — no command suggestion until the escalation is removed.
5. Nothing "In flight" in `docs/state.md` → folder-derived fallback: if `docs/specs/` holds a folder whose files imply the next stage (proposal without spec → `lpwr-specify`; spec/tasks without passing references → `lpwr-implement`; references without verdict → `lpwr-review`; ship without commit → `lpwr-commit`), suggest that resume step citing the folder; otherwise suggest `lpwr-propose` (loose idea → `lpwr-interview` first; sourced question → `lpwr-research`; debt survey → `lpwr-improve`).
6. An existing module with no spec and no proposal → suggest `lpwr-explore` to baseline its behavior (or `lpwr-propose` to change it).
7. Spec has `proposal.md` but no `spec.md` → suggest `lpwr-specify` (full pass; granular `lpwr-specs` also works).
8. `spec.md` status is `draft` → suggest `lpwr-specs` to finish approval (`lpwr-amend` if changing an already-approved spec).
9. `spec.md` `design_review` is "required" but no approved `adr.md` → suggest `lpwr-design`.
10. `spec.md` is `approved` but the Tasks section is empty → suggest `lpwr-tasks`.
11. The acceptance table has empty test-reference cells → suggest `lpwr-implement`.
12. All criteria have test references but no `review.md` verdict → suggest `lpwr-review`.
13. `review.md` `risk_tier` is "high" but no `threat-review.md` → suggest `lpwr-threat-review`.
14. `review.md` verdict is "ship" but no matching commit → suggest `lpwr-commit`.
15. Ship + matching commit present, this repo deploys, and no release reference is journaled → suggest `lpwr-release`.
16. `review.md` verdict is "block" → suggest `lpwr-implement` (rework), then `lpwr-review` again.
17. `review.md` verdict is "redirect" → suggest `lpwr-propose` (re-frame the spec).
18. `review.md` lists `deferred:` entries (`<criterion-id> -> <follow-up>`) → suggest `lpwr-propose` for the named follow-up, citing the deferred IDs.
19. Committed but no lesson filed at `docs/lessons/<date>-<id>.md` → suggest `lpwr-teach` (it drafts; a human or scribe files the lesson).
20. Everything closed → point at `docs/state.md`'s "Next" section or suggest `lpwr-propose`.

Side doors (any time, when the path above doesn't fit): hard bug with no fix path → `lpwr-diagnose`; fixed-point pass/fail without a verdict → `lpwr-goal`; stale glossary or stack → `lpwr-domain` / `lpwr-stack`.

Output: inline one command suggestion; writes nothing.

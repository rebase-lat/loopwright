---
description: Create the EARS specification from an approved proposal.
agent: scribe
---

Stage: Specify.

From the approved proposal for $ARGUMENTS, write `docs/specs/<id>/spec.md` via `templates/spec.md` with `basis: proposed`. If `spec.md` already exists: `status: draft` means resume it — continue the draft to a human approval verdict, never restart or overwrite the prior text; any other status means use `lpwr-amend` — specs creates and resumes, it never overwrites approved work.

Load first: the proposal (`proposal_ref`), `docs/constitution.md`, `docs/glossary.md`. Use skills `lpwr-writing-ears` and `lpwr-acceptance-criteria`.
Rules: EARS-typed criteria with sub-IDs `<id>-<n>`; behavior and constraints, never implementation details; explicit non-goals; acceptance table left with an empty test-reference column for Execute to fill. Every entry under `Open questions` must be resolved before approval — each becomes a criterion with a real sub-ID, an explicit non-goal, or is struck with a one-line resolution; refuse the approval verdict while any remain open (unresolved questions have no ID and cannot use the `deferred:` path later). Set `risk_tier` in frontmatter via the `question` tool (human pick among low/medium/high; suggest medium or higher when the spec touches auth, secrets, permissions, or external network calls). Set `design_review: required` (also a `question` human pick) for new dependencies, schema or API contract changes, or structural refactors. Refuse approval while `design_review: required` without an accepted `adr.md`. Criteria in the Optional features section are pre-declared deferral candidates — flag them as such so the reviewer expects the deferral; the reviewer still confirms. Reject (don't silently correct) any banned substitute from `docs/glossary.md` found in the proposal or draft — glossary-exact terms are required before approval. Present the spec for a human verdict via `question` (approve / keep drafting / reject; `status: approved` only on an explicit human verdict).

Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: writes `docs/specs/<id>/spec.md` via templates/spec.md; journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-tasks (granular) or lpwr-implement (full pass already filled tasks).

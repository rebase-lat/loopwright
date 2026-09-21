---
description: Create the EARS specification from an approved proposal.
agent: scribe
---

Stage: Specify.

From the approved proposal for $ARGUMENTS, write `docs/specs/<id>/spec.md` via `templates/spec.md`. If `spec.md` already exists for this ID, stop and use `lpwr-amend` — specs creates, it never overwrites.

Load first: the proposal (`proposal_ref`), `docs/constitution.md`, `docs/glossary.md`. Use skills `lpwr-writing-ears` and `lpwr-acceptance-criteria`.
Rules: EARS-typed criteria with sub-IDs `<id>-<n>`; behavior and constraints, never implementation details; explicit non-goals; acceptance table left with an empty test-reference column for Execute to fill. Criteria in the Optional features section are pre-declared deferral candidates — flag them as such so the reviewer expects the deferral; the reviewer still confirms. Reject (don't silently correct) any banned substitute from `docs/glossary.md` found in the proposal or draft — glossary-exact terms are required before approval. Present the spec for a human verdict (`status: approved` only on an explicit human verdict).

Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

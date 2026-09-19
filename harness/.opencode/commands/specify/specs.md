---
description: Create the EARS specification from an approved proposal.
agent: plan
---

From the approved proposal for $ARGUMENTS, write `docs/specs/<id>/spec.md` via `templates/spec.md`.

Load first: the proposal (`proposal_ref`), `docs/constitution.md`, `docs/glossary.md`. Use skills `writing-ears` and `acceptance-criteria`.
Rules: EARS-typed criteria with sub-IDs `<id>-<n>`; behavior and constraints, never implementation details; explicit non-goals; acceptance table left with `(pending)` test references for Execute to fill. Present the spec for human approval (`status: approved` only on human sign-off).

Append one A2A line to `docs/specs/<id>/log.ndjson` with intent `specify`.

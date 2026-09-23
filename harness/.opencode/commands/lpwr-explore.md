---
description: Draft a spec from a module's actual code. Alternate entry into Specify.
agent: scribe
---

Stage: Specify.

Read the module at $ARGUMENTS directly — no upstream proposal — and write `docs/specs/<id>/spec.md` describing current behavior. Assign the traceability ID (`<domain>-<sequence>`) now; set `basis: observed` and `proposal_ref: null` (no proposal exists).

Use skills `lpwr-boundary-audit`, `lpwr-primary-sources`, and `lpwr-writing-ears`: map data flows, edges, and dependencies first; ground every behavioral claim in the code actually read, never assumed; write observed behavior in EARS syntax. Add the `Current behavior narrative` and `Open questions` sections from `templates/spec.md` — ambiguities found (a null check that might be intentional or latent, a path with no caller, a comment contradicting the code) go there, not into invented criteria. Do not seek approval while any Open questions entry remains unresolved — each must become a criterion sub-ID, a non-goal, or a struck line with one-line resolution first (unresolved questions have no ID and cannot defer later).

Set `risk_tier` (human-confirmed, same heuristics as `lpwr-specs`) and leave the acceptance table empty for Execute to fill. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Approval answers "does this correctly describe what the code does" — not "is this what it should do." If the behavior itself is wrong, don't approve: run `lpwr-propose` with this draft as grounding, and let the new spec `supersede` it.

Output: writes `docs/specs/<id>/spec.md` via templates/spec.md; journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-tasks or lpwr-implement (after accuracy approval).

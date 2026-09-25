---
description: Amend an approved spec plus its tasks, void the review, route to re-approval.
agent: orchestrator
---

Stage: Specify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Change the spec for `$ARGUMENTS` (`<spec-id>`, then the change description) after approval. Behavior changes update the spec first, the code second — never the reverse. Post-ship specs are refused by `lpwr-verdict-gate.ts` (amend is pre-commit only — route those to a new spec with `supersedes:`). Use skill `lpwr-spec-amendment`, then confirm the void-review consequence and collect re-approval via the `question` tool (approve / keep editing / cancel). Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: edits `docs/specs/<id>/spec.md`; journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-implement (after re-approval; review was voided).

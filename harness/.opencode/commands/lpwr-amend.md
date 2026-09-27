---
description: Amend an approved spec plus its tasks, void the review, route to re-approval.
agent: orchestrator
---

Stage: Specify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Change the spec for `$ARGUMENTS` (`<spec-id>`, then the change description) after approval. Behavior changes update the spec first, the code second — never the reverse. Post-ship specs are refused by `lpwr-verdict-gate.ts` (amend is pre-commit only — route those to a new spec with `supersedes:`). Use skill `lpwr-spec-amendment`, then confirm the void-review consequence and collect re-approval via the `question` tool (approve / keep editing / cancel). On approval, in this order: (1) set `status: draft` and delete `docs/specs/<id>/review.md` (delegated to a worker) — the missing review is what re-blocks `lpwr-commit`/`lpwr-release` until re-review; (2) only then apply the amendment. The order is mechanical, not prose: `lpwr-scope-guard` freezes `spec.md` at `status: approved` to test-reference cells, so the draft flip is the door the amendment walks through — a flip that carries other changes in the same write is refused by the gate. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: edits `docs/specs/<id>/spec.md`; journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-specs (resume to a human approval verdict — status is draft again, review deleted), then lpwr-implement.

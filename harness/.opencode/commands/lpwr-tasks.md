---
description: Break approved criteria into the Tasks section. Granular path; full pass is lpwr-specify.
agent: orchestrator
---

Stage: Specify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

From the approved spec for $ARGUMENTS, write the Tasks section of `docs/specs/<id>/spec.md`. Use skill `lpwr-task-breakdown`. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: edits Tasks section of `docs/specs/<id>/spec.md`; journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-implement.

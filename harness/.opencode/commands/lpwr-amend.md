---
description: Amend an approved spec plus its tasks, void the review, route to re-approval.
agent: scribe
---

Stage: Specify.

Change the spec for `$ARGUMENTS` (`<spec-id>`, then the change description) after approval. Behavior changes update the spec first, the code second — never the reverse. Use skill `lpwr-spec-amendment`, then present the amended spec for human re-approval. Call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: edits `docs/specs/<id>/spec.md`; journal_handoff specify `docs/specs/<id>/spec.md`.

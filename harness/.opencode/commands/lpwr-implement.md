---
description: Build approved tasks against the spec, with tests per criterion.
agent: build
---

Stage: Execute.

Implement the tasks in the Tasks section of `docs/specs/$ARGUMENTS/spec.md` against the approved spec.

Use skills `lpwr-acceptance-criteria`, `lpwr-diff-reading`, and `lpwr-explain-back` — every task must produce a test referencing its criterion sub-ID before being marked done; re-read the full diff and explain back each patch before marking complete.

On completion, call `journal_handoff` per criterion with intent "execute", spec_ref set to the task's criterion id, and artifact pointing at the diff — do not inline the diff into the message.

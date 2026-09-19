---
description: Build approved tasks against the spec, with tests per criterion.
agent: build
---

Implement the tasks in `docs/specs/$ARGUMENTS/tasks.md` against the approved spec `docs/specs/$ARGUMENTS/spec.md`.

Use skill: acceptance-criteria — every task must produce a test referencing its criterion sub-ID before being marked done.

On completion, append one line per criterion to `docs/specs/$ARGUMENTS/log.ndjson` with intent "execute", spec_ref set to the task's criterion id, and payload pointing to the diff — do not inline the diff into the message.

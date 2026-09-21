---
description: Deploy only on a recorded ship verdict.
agent: build
---

Stage: Verify.

Release $ARGUMENTS. This command is the only one permitted to trigger deploy, and only fires on a recorded `ship` verdict in `docs/specs/$ARGUMENTS/review.md`.

Check the verdict first: no `ship` line → refuse and stop. On `ship`, run the deploy steps for this repo and call `journal_handoff` with intent `verify`, the spec ID, and artifact pointing at the release.

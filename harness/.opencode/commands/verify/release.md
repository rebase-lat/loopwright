---
description: Deploy only on a recorded ship verdict.
agent: reviewer
---

Release $ARGUMENTS. This command is the only one permitted to trigger deploy, and only fires on a recorded `ship` verdict in `docs/specs/$ARGUMENTS/review.md`.

Check the verdict first: no `ship` line → refuse and stop. On `ship`, run the deploy steps for this repo and append one A2A line to `docs/specs/$ARGUMENTS/log.ndjson` with intent `verify` and payload pointing at the release.

---
description: Deploy only on a recorded ship verdict.
agent: build
---

Stage: Verify.

Release $ARGUMENTS (`<id>`, the spec ID). This command is the only one permitted to trigger deploy, and only fires on a recorded `ship` verdict in `docs/specs/<id>/review.md` plus, for `high` risk tier, a present `threat-review.md`.

Check the verdict first: no `ship` line → refuse and stop. Then check the tier: `high` without `threat-review.md` → refuse and stop (both enforced by `lpwr-verdict-gate.ts`). On `ship`, run the deploy steps for this repo, then call `journal_handoff` with intent `verify`, the spec ID, and artifact set to the release reference — the deployed URL or release tag, whichever this repo produces.

Output: inline deploy result with release reference (URL or tag); journal_handoff verify `<release-ref>`.

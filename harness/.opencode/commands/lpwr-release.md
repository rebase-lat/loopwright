---
description: Deploy only on a recorded ship verdict.
agent: orchestrator
---

Stage: Verify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Release $ARGUMENTS (`<id>`, the spec ID). Run this from the trunk session after `lpwr-commit` — the deploy ships trunk's merge, not the spec worktree. This command is the only one permitted to trigger deploy, and only fires on a recorded `ship` verdict in `docs/specs/<id>/review.md` plus, for `high` risk tier, a present `threat-review.md`.

Check the verdict first: no `ship` line → refuse and stop. Then check the tier: `high` without `threat-review.md` → refuse and stop (both enforced by `lpwr-verdict-gate.ts`). On `ship`, run the deploy steps for this repo, then call `journal_handoff` with intent `verify`, the spec ID, and artifact set to the release reference — the deployed URL or release tag, whichever this repo produces. Also append a `release-ref` entry to `docs/audit.md` (`<spec-id>` + the reference, status: open) — release never writes `state.md` directly (single writer is `/commit`); the next `/commit` for this ID folds the ref into the Done line.

Output: inline deploy result with release reference (URL or tag); appends `release-ref` to `docs/audit.md`; journal_handoff verify `<release-ref>`.

Next: lpwr-teach.

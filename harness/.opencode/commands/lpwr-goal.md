---
description: Check spec-vs-implementation drift at a fixed point, pass or fail.
agent: orchestrator
---

Stage: Verify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Check for deviation between the spec for $ARGUMENTS and the implementation at the given fixed point (commit, branch, or HEAD — pass as second argument, default HEAD). For a full three-axis verdict into `review.md`, use `lpwr-review` instead.

Read the spec's acceptance table and the implementation side by side. Ignore criteria listed under `waived:` / `deferred:` in `docs/specs/<id>/review.md` (if present; `<id>` from `$ARGUMENTS`) — waived and deferred criteria are intended drift, not deviation. Never create or modify `review.md` from this command.

Output: inline pass/fail with drift notes; writes nothing.

Next: lpwr-review (full verdict) when the fixed-point check is not enough.

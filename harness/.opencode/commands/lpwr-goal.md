---
description: Check spec-vs-implementation drift at a fixed point, pass or fail.
agent: reviewer
---

Stage: Verify.

Check for deviation between the spec for $ARGUMENTS and the implementation at the given fixed point (commit, branch, or HEAD — pass as second argument, default HEAD).

Read the spec's acceptance table and the implementation side by side. Produce only a pass/fail with drift notes — this command writes no artifact of its own; the human consumes the result inline.

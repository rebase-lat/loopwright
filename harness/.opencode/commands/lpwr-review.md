---
description: Review the diff against the spec on standards and specs axes, render verdict.
agent: reviewer
---

Stage: Verify.

Review the diff HEAD~1..HEAD for $ARGUMENTS against `docs/specs/$ARGUMENTS/spec.md` using `templates/review.md`.

Fill both axes — standards and specs — before rendering a verdict. Do not render "ship" unless every criterion in the acceptance table has a passing test reference. Record the verdict (`ship` / `block` / `redirect`) with reasoning in `docs/specs/$ARGUMENTS/review.md`, and append one A2A line to `docs/specs/$ARGUMENTS/log.ndjson` with intent `verify`.

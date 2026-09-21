---
description: Review the diff against the spec on standards and specs axes, render verdict.
agent: scribe
---

Stage: Verify.

Review the diff HEAD~1..HEAD for $ARGUMENTS against `docs/specs/$ARGUMENTS/spec.md` using `templates/review.md`.

Fill all three axes — standards, specs, and security — before rendering a verdict. Read every diff in full per skill `lpwr-diff-reading`. Do not render "ship" unless every criterion in the acceptance table has a passing test reference, is waived, or is deferred. Waivers: leave Pass? empty for waived/deferred rows and list the IDs under `waived:` / `deferred:` in the review frontmatter (deferred entries as `<criterion-id> -> <follow-up spec>`); justify each one in Verdict reasoning. The gate enforces the lists mechanically. Record the verdict (`ship` / `block` / `redirect`) with reasoning in `docs/specs/$ARGUMENTS/review.md`, and call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/$ARGUMENTS/review.md`.

---
description: Review the diff against the spec on standards and specs axes, render verdict.
agent: orchestrator
---

Stage: Verify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Review the uncommitted change `git diff HEAD` for $ARGUMENTS against `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) using `templates/review.md` — the working tree is what is being reviewed; after `lpwr-commit` the same review runs against the staged/committed diff for the amend cycle. Full three-axis verdict; for a quick fixed-point pass/fail check use `lpwr-goal`.

Fill all three axes — standards, specs, and security — before rendering a verdict. Read every diff in full per skill `lpwr-diff-reading`. Do not render "ship" unless every criterion in the acceptance table has a passing test reference, is waived, or is deferred. Record waived/deferred IDs and their justifications per the frontmatter comments in `templates/review.md` — the gate enforces the lists mechanically. Carry `risk_tier` over verbatim from `spec.md`; a tier change travels through `lpwr-amend` (rule 9) — `lpwr-verdict-gate` blocks commit and release on any mismatch. Write the verdict (`ship` / `block` / `redirect`) with reasoning to `docs/specs/<id>/review.md` via `templates/review.md`, and call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/<id>/review.md`.

Output: writes `docs/specs/<id>/review.md` via templates/review.md; journal_handoff verify `docs/specs/<id>/review.md`.

Next: lpwr-commit (ship) or lpwr-implement (block) or lpwr-propose (redirect).

---
description: Review the diff against the spec on standards and specs axes, render verdict.
agent: orchestrator
---

Stage: Verify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Rebase first onto the trunk branch (delegated; the human's bash checkpoint approves it) so the review evaluates current trunk, not a stale base — derive trunk as the branch checked out in the main worktree (`git -C <main> branch --show-current`, `<main>` being the parent of `git rev-parse --git-common-dir`); never assume `develop`. Then `git rebase --autostash <trunk>` — `--autostash` carries the uncommitted change across. On conflicts, stop and let the human resolve before reviewing.

Review the uncommitted change `git diff HEAD` for $ARGUMENTS against `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) using `templates/review.md` — the working tree is what is being reviewed; after `lpwr-commit` the same review runs against the staged/committed diff for the amend cycle. Full three-axis verdict; for a quick fixed-point pass/fail check use `lpwr-goal`.

Fill all three axes — standards, specs, and security — before rendering a verdict. Read every diff in full per skill `lpwr-diff-reading`. Do not render "ship" unless every criterion in the acceptance table has a passing test reference, is waived, or is deferred. Record waived/deferred IDs and their justifications per the frontmatter comments in `templates/review.md` — the gate enforces the lists mechanically. Carry `risk_tier` over verbatim from `spec.md`; a tier change travels through `lpwr-amend` (rule 9) — `lpwr-verdict-gate` blocks commit and release on any mismatch. The verdict itself is one structured human pick: present the filled axes and the acceptance-table state through the `question` tool (`ship` / `block` / `redirect`, reasoning as free text is fine), then write exactly that pick — with the human's reasoning — to `docs/specs/<id>/review.md` via `templates/review.md` (rule 48: verdicts are structured picks, never the reviewer's own call), and call `journal_handoff` with intent `verify`, the spec ID, and artifact `docs/specs/<id>/review.md`.

Output: writes `docs/specs/<id>/review.md` via templates/review.md; journal_handoff verify `docs/specs/<id>/review.md`.

Next: lpwr-commit (ship) or lpwr-implement (block) or lpwr-propose (redirect).

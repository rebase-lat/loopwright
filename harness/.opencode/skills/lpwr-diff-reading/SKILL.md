---
name: lpwr-diff-reading
description: Read a landed diff in full (not just test output) and extract residual risk. Use in lpwr-review or lpwr-implement. Hypothesis-first walkthrough: lpwr-explain-back.
---

# Diff Reading

When a patch lands: read every hunk, ask what could still fail. Validate, not
just approve.

- Read the diff in full, never only the test output. Review runs against the
  uncommitted change (`git diff HEAD`); after commit, against the commit range
  (`HEAD~n..HEAD`).
- For each hunk: what changed, why that approach, what it ruled out, what it
  assumed about the system.
- Note residual risks explicitly before returning to the loop.

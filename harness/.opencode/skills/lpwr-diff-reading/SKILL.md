---
name: lpwr-diff-reading
description: Read diffs fully (not just test output) to validate patches. Use when implementing, diagnosing, or reviewing changes.
---

# Diff Reading

When a patch lands: read the diff, ask what could still fail. Validate, not just approve.

- Read the full diff `HEAD~n..HEAD`, never only the test output (constitution verdict floor requires a human to read the diff in full).
- For each hunk: what changed, why that approach, what it ruled out, what it assumed about the system.
- Expand and return to the loop: note residual risks explicitly.

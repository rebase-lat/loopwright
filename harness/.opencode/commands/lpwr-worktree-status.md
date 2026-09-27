---
description: Show open spec worktrees, their shipped/dirty/pending state, and the cap. Read-only.
agent: orchestrator
---

Stage: Cross-cutting.

Delegation: none — one tool call; you hold no shell or write.

Inspect the worktree state without running the full guide: call `worktree_status` and present the report to the human — each open worktree's spec ID, shipped or in flight, clean or dirty, pending cleanup, whether it is prunable, which entry this session runs from, cap usage, and the always-on audit surface: foundation link gaps per worktree (missing on trunk → `lpwr-install` / `lpwr-setup`) plus manifest health — an unreadable `.loop-worktrees/manifest.json` and stale pending marks (worktree gone; `lpwr-worktree-prune` sweeps them), so "why didn't my worktree prune" is answerable here without running anything.

Read-only by construction: writes nothing, prunes nothing, never repairs the manifest. When anything is prunable or the cap is reached, name `lpwr-worktree-prune` as the next action; an open in-flight entry names the session to resume.

Output: inline worktree status via `worktree_status`; writes nothing.

Next: lpwr-worktree-prune (close prunable worktrees), lpwr-guide (what to run next), or restart in an open worktree's session.

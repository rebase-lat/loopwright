---
description: List open spec worktrees and prune shipped or pending-cleanup ones. Force removals need human confirmation.
agent: orchestrator
---

Stage: Cross-cutting.

Delegation: none — the worktree tools do the git work; you hold no shell or write.

Close open spec worktrees on demand instead of waiting for the next `lpwr-propose` (the cap, rule 29, stops minting while they accumulate). Read-only inspection plus two tools; nothing else.

1. Call `worktree_status` and show the human the list: spec ID, shipped or in flight, clean or dirty, pending cleanup, cap usage, and which entry is this session.
2. Pick targets. With `$ARGUMENTS` naming a spec ID, prune that one. Without, ask the human which worktree(s) to prune via the `question` tool — recommend the entries marked prunable (shipped or pending cleanup, clean); leave in-flight ones open.
3. Call `worktree_prune` with the chosen `spec_id` (omit `spec_id` to prune every eligible worktree). Clean shipped/pending-cleanup worktrees close directly. `force: true` is the only way past dirt or in-flight status — every force removal raises a permission confirmation naming the worktree path; a declined confirmation leaves it alone. This session's own worktree is never pruned — quit it first, then prune from trunk.
4. Call `worktree_status` again and report what closed and what remains (and why it stayed open).

Idempotent: pruning an already-closed spec reports `No open worktree for <id>` — not an error.

Output: prunes worktrees + their spec branches via `worktree_prune`; writes no docs file, no `journal_handoff` (project-level, unkeyed).

Next: lpwr-guide, or restart opencode in an open worktree's session.

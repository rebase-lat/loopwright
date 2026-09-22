---
name: lpwr-context-economy
description: Keep context lean via artifact pointers, ephemeral sub-agents, and compaction. Use when handing off between agents or pruning long sessions.
---

# Context Economy

Token-burn preventions — exchange references, isolate heavy work, prune
scratch:

- **Pass-by-reference**: exchange file paths, object URIs, or content hashes —
  never embed raw diffs or full payloads in handoffs.
- **Ephemeral sub-agent isolation**: delegate heavy retrieval to single-purpose
  sub-agents (e.g. scout) with fresh windows; only the consolidated result
  returns.
- **Prompt/prefix caching**: keep system instructions and schemas static
  across turns.
- **Compaction**: prune tool output and scratchpads after each action — retain
  only system prompt, current goal, active state. Never prune diff, tests,
  logs, or why.

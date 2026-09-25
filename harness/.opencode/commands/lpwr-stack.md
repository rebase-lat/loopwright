---
description: Record primary, secondary and complementary stack.
agent: orchestrator
---

Stage: Govern.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Write the stack for $ARGUMENTS to the stack section of `docs/context.md`, including configured MCP servers (name, transport, required env, purpose) and external services/system binaries — this section is the inventory `lpwr-setup` verifies against. `lpwr-implement` and `lpwr-diagnose` may only choose tools listed there.

Project-level output — unkeyed: no `journal_handoff` (spec-ID exemption).

Output: edits stack section of `docs/context.md`; writes nothing else.

Next: lpwr-guide.

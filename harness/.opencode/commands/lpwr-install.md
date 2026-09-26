---
description: Materialize docs files from templates for a fresh project. Idempotent.
agent: orchestrator
---

Stage: Bootstrap.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Bootstrap a fresh project from templates — this command materializes files, it fills in nothing. For each template in `templates/` with a matching `docs/` path (`constitution.md`, `context.md`, `state.md`, `audit.md`), write the file if and only if it is missing; never overwrite an existing file. Placeholder values stay placeholders — filling them is `lpwr-onboard`'s job, and the machine-level checks are `lpwr-setup`'s. Also ensure `docs/memos/` exists: the shared memo dir (trunk-owned, gitignored, symlinked into every spec worktree by `lpwr-worktree-guard` like `state.md` — rule 49 pattern); it ships no template.

Idempotent: running twice on a materialized project is a no-op with a confirmation, not an error. Once foundation files exist, `lpwr-guard-bootstrap` unblocks the remaining domain commands.

Project-level output — unkeyed: no `journal_handoff` (spec-ID exemption).

Output: writes `docs/constitution.md` via templates/constitution.md, `docs/context.md` via templates/context.md, `docs/state.md` via templates/state.md, `docs/audit.md` via templates/audit.md; ensures `docs/memos/` exists; writes nothing else.

Next: lpwr-onboard.

---
description: Build approved tasks against the spec, with tests per criterion.
agent: orchestrator
---

Stage: Execute.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Implement the tasks in the Tasks section of `docs/specs/<id>/spec.md` (`<id>` from `$ARGUMENTS`) against the approved spec. Gates on the way in: `lpwr-spec-link` (approved status, state, design review), `lpwr-scope-guard` (edits stay inside the declared surface), `lpwr-security-scan` (secrets block; dependency audit traces to `docs/specs/<id>/audit.md` and warns — implement continues).

Tool choice is constrained by the Stack section of `docs/context.md`: prefer the package manager, containers, and CLIs recorded there. Before invoking an unlisted system binary via bash, confirm it with the human via the `question` tool (named binary + why it's needed) — unlisted tools without that ok are out of stack. Freeform non-bash tooling stays prose advice; bash-invoked binaries are the checkpoint.

On entry, seed `todowrite` from the Tasks checklist — one todo per task line (`<task> — <criterion-id>`); check a todo off only after its criterion has a passing test reference. Never journal `todo.updated` (rule 22: handoffs, not tool chatter).

Use skills `lpwr-acceptance-criteria`, `lpwr-diff-reading`, and `lpwr-explain-back` — every task must produce a test referencing its criterion sub-ID before being marked done; re-read the full diff and explain back each patch before marking complete. When a `docs/memos/<topic>.md` diagnosis exists for this spec, read it and map its regression-test targets into the acceptance table's test-reference cells before marking the bound tasks done.

On completion, call `journal_handoff` per criterion with intent `execute`, spec_ref set to the task's criterion id, and artifact set to the same criterion id — never a commit SHA (Execute leaves the tree uncommitted; SHAs appear only on the `retain` handoff after `lpwr-commit`) and never the inline diff. Summarize the change in chat by task, not by patch.

Output: inline task-level change summary (code is the artifact); journal_handoff execute per criterion, artifact = criterion id.

Next: lpwr-review.

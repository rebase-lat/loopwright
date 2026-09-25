---
description: Phased diagnosis of a hard bug — repro, ranked hypotheses, fix plan (no patch).
agent: orchestrator
---

Stage: Execute.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

Run a phased diagnosis on $ARGUMENTS: build a repro, minimise it, rank hypotheses, instrument (leave no production edits behind), and write the diagnosis with a fix plan and regression-test targets — then stop. Diagnose never patches: applying the fix runs through `lpwr-implement` against an approved spec. Session-error toasts from `lpwr-surface-errors` point here.

Write the diagnosis to `docs/memos/<topic>.md` via `templates/memo.md` — `<topic>` is a kebab-case slug from $ARGUMENTS. Use skills `lpwr-repro-minimisation`, `lpwr-boundary-audit`, `lpwr-root-cause-refactor` (the refactor advice informs the plan; applying it happens in implement). Scope tool choice to the stack section of `docs/context.md` — before invoking an unlisted system binary via bash, confirm it with the human via the `question` tool (named binary + why); unlisted tools without that ok are out of stack. If the bug maps to an approved spec, call `journal_handoff` with intent `execute` for that spec and artifact `docs/memos/<topic>.md`, then hand the plan to `lpwr-implement`; if no approved spec fits, hand the diagnosis to `lpwr-propose` as grounding to frame one — no handoff without a spec ID. Name the regression-test targets with the criterion sub-IDs they should bind to (or note they need new criteria via specify/amend) so `lpwr-implement` can map them into the acceptance table.

Output: writes `docs/memos/<topic>.md` via templates/memo.md; journal_handoff execute `docs/memos/<topic>.md` (only when a spec ID fits).

Next: lpwr-implement (approved spec) or lpwr-propose (no spec).

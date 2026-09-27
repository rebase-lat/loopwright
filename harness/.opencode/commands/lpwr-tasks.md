---
description: Break approved criteria into the Tasks section. Granular path; full pass is lpwr-specify.
agent: orchestrator
---

Stage: Specify.

Delegation: all steps below run on workers you spawn — you hold no shell or write.

From the spec for $ARGUMENTS, write the Tasks section of `docs/specs/<id>/spec.md`. Use skill `lpwr-task-breakdown`.

`status: approved` freezes `spec.md` to test-reference cells (`lpwr-scope-guard` enforces it — the declared surface is what the human is approving, so the builder can never write it mid-Execute). Run in this order:

1. If the spec is approved, flip `status: draft` **alone** — that flip is the gate's door and may carry nothing else. (A spec still `draft` skips this step.)
2. Write the Tasks section with its `### Declared surface`.
3. Present the completed package — criteria, tasks, and surface together — for one human approval via the `question` tool (approve / keep editing), and on approval set `status: approved`. This is the same package approval `lpwr-specify` collects at the end of its pass; `lpwr-implement` stays blocked while the spec sits in draft.

If the worktree guard injects a surface-overlap warning (rule 50), present it to the human via the `question` tool before finalizing — proceed only on an explicit pick; fix the declared surface first when the overlap was not intended. Overlap caught here is a planning decision; the same overlap at merge time is a process gap. Then call `journal_handoff` with intent `specify`, the spec ID, and artifact `docs/specs/<id>/spec.md`.

Output: edits Tasks section of `docs/specs/<id>/spec.md` (status flips draft → approved around the write); journal_handoff specify `docs/specs/<id>/spec.md`.

Next: lpwr-implement.

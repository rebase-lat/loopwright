---
description: Answer a question from primary sources, leave a cited memo.
agent: scribe
---

Stage: Frame.

Answer the question in $ARGUMENTS by reading the sources that own the answer. Primary sources only: official docs, source code, specs, first-party APIs — never blogs, never model say-so.

Write a cited Markdown memo to `docs/memos/<topic>.md` via `templates/memo.md` — `<topic>` is a kebab-case slug from $ARGUMENTS. Use skill `lpwr-primary-sources`. Never write code.

When $ARGUMENTS is keyed to a spec ID, call `journal_handoff` with intent `frame`, that spec ID, and artifact `docs/memos/<topic>.md`; unkeyed research writes the memo with no handoff (spec-ID exemption).

Output: writes `docs/memos/<topic>.md` via templates/memo.md; journal_handoff frame `docs/memos/<topic>.md` (only when keyed to a spec ID).

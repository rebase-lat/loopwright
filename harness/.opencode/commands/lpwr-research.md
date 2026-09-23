---
description: Answer a question from primary sources, leave a cited memo.
agent: scribe
---

Stage: Frame.

Answer the question in $ARGUMENTS by reading the sources that own the answer, per skill `lpwr-primary-sources` (which sources count and the citation bar). Never write code.

Write a cited Markdown memo to `docs/memos/<topic>.md` via `templates/memo.md` — `<topic>` is a kebab-case slug from $ARGUMENTS.

When $ARGUMENTS is keyed to a spec ID, call `journal_handoff` with intent `frame`, that spec ID, and artifact `docs/memos/<topic>.md`; unkeyed research writes the memo with no handoff (spec-ID exemption).

Output: writes `docs/memos/<topic>.md` via templates/memo.md; journal_handoff frame `docs/memos/<topic>.md` (only when keyed to a spec ID).

Next: lpwr-propose (when keyed and grounded).

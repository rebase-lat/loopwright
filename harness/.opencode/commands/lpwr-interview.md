---
description: Interview the user in rounds until a plan seems feasible.
agent: scribe
---

Stage: Frame.

Take the loose idea in $ARGUMENTS and interview the user per skill `lpwr-frontier-interview` (round mechanics and stopping rule). Stop when the skill's stop condition is met — the outcome, constraints and non-goals are explicit enough for `lpwr-propose`.

Never write code. Write the interview notes to `docs/memos/<topic>.md` via `templates/memo.md` — `<topic>` is a kebab-case slug from $ARGUMENTS — for the human to feed into `lpwr-propose`.

Frame-stage output before a spec exists — unkeyed: no `journal_handoff` (spec-ID exemption).

Output: writes `docs/memos/<topic>.md` via templates/memo.md; writes nothing else.

Next: lpwr-propose.

---
name: lpwr-motion
description: Ratify a picked option by parliamentary motion before the traceability ID is assigned. Use after the human picks an option in lpwr-propose.
---

# Motion

Ratification procedure for the tradeoff takeaways. Runs after the human picks an option
and before the traceability ID is assigned — nothing is filed until the motion is adopted.

- Chair (neutral): states the question, rules out-of-scope contributions out of order,
  records moved / seconded / amendments / vote.
- Mover (deep expert): moves the picked option with its tradeoff takeaways.
- Seconder (applied judge): seconds only if the motion is testable as stated. No
  second → the motion falls and the mover restates it in testable form, once; if the
  re-move falls too, the pick returns to the human.
- Debate: one scrutiny round — the seconder interrogates the tradeoffs, the mover responds.
- Amendment: the seconder may move to amend on testability constraints only; the mover
  accepts or rejects; the chair restates the motion as amended.
- Vote: the human adopts or rejects. Adoption assigns the traceability ID and writes the
  proposal with the full motion record. Rejection returns to the options.

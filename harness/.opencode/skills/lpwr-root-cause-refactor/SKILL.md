---
name: lpwr-root-cause-refactor
description: Halt incremental patching after 3 consecutive fixes and refactor the root cause. Use when flag-traps fires or patches stack up on one file.
---

# Root-Cause Refactor

Countermeasure for the achievement trap (band-aid on a broken bone) and the dislodging trap (stuck in a rut):

- Flag files requiring >3 consecutive patches; halt incremental edits and trigger a root-cause refactor.
- Enforce the 15-minute time-box: if an approach stalls, `git stash` the changes and force a complete strategy reset.
- The refactor targets the cause (wrong abstraction, missing boundary, wrong-spec), not the symptom.

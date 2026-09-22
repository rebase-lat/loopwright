---
name: lpwr-root-cause-refactor
description: Halt incremental patching after 3 consecutive fixes and reset toward a root-cause diagnosis. Use when lpwr-flag-traps fires or patches stack up on one file (host: lpwr-diagnose).
---

# Root-Cause Refactor

Countermeasure for the band-aid trap (achievement on a broken bone) and the
stuck-in-a-rut trap: stop stacking patches and force a strategy reset.

- Flag files requiring >3 consecutive patches; halt incremental edits and
  reset strategy — the diagnosis continues in `lpwr-diagnose`, never as
  another patch.
- Enforce the 15-minute time-box: if an approach stalls, `git stash` the
  changes and force a complete strategy reset (stash stays for later review —
  do not drop it).
- The eventual refactor targets the cause (wrong abstraction, missing
  boundary, wrong-spec), not the symptom.

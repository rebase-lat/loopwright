---
description: Phased diagnosis of a hard bug with repro, ranked hypotheses, fix.
agent: build
---

Stage: Execute.

Run a phased diagnosis on $ARGUMENTS: build a repro, minimise it, rank hypotheses, instrument, provide a fix with regression tests, then clean up.

Use skills `lpwr-repro-minimisation`, `lpwr-boundary-audit`, `lpwr-root-cause-refactor`. Scope tool choice to the stack section of `docs/context.md`. If the bug maps to an approved spec, call `journal_handoff` with intent `execute` for that spec.

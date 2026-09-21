# Loopwright — Motion Step Implementation Guide

Motion is the last step inside `lpwr-propose`, after the human has picked an option from triage.
It is ratification, not re-evaluation — triage already answered "which option is best"; motion's
job is to turn that answer into a committed, auditable artifact. Three things belong in it, and
only three, because each does something triage didn't already do.

---

## 1. What motion does

| Step | What it checks | Why it's not redundant with triage |
| --- | --- | --- |
| **Pin the final statement** | The human's actual selection, including any tweak or merge of triaged options | Triage evaluated options as proposed; the human's pick is often not identical to any one of them verbatim |
| **Check against memory** | `docs/constitution.md`'s floors, `docs/lessons/*` for anything relevant | Triage judged the option on its own merits (domain truth, testability) — not against accumulated constraints or past mistakes |
| **Capture dissent, if any** | Whether any triage seat has an unresolved reservation about the *final* framing specifically | Not a restatement of triage's evaluation — only fires if something about the final wording, post-tweak, still bothers a seat |

If none of the three surfaces anything new, motion is short — that's the expected case, not a
sign it's not doing enough.

---

## 2. Where it sits in `lpwr-propose.md`

```markdown
---
agent: plan
---

1. Draft 2-3 distinct options for the problem at hand.
2. Run triage: neutral, deep-expert, applied-judge each evaluate the options independently.
3. Present triage results to the human; human selects one (or a tweak/merge of options).

4. Motion (this step — do not re-run triage's evaluation):
   a. Pin the human's final selection as exact, literal text — this becomes proposal.md's content,
      not a summary of triage's notes.
   b. Check the final text against @docs/constitution.md's floors and @docs/lessons/*.md for
      anything relevant. If a conflict or a repeated past mistake surfaces, flag it to the human
      before finalizing — do not silently proceed.
   c. Ask each triage seat one question only: "does anything about this final framing, as pinned
      above, still concern you?" Record a dissent only if the answer is yes and specific.

5. Write docs/specs/$SPEC_ID/proposal.md using @templates/proposal.md.
6. Append one log.ndjson line: intent "frame", spec_ref $SPEC_ID, payload pointing to proposal.md.
   The triage debate in steps 2-3 is not logged — only the motion's outcome is.
```

---

## 3. Template — `templates/proposal.md` (motion section added)

```markdown
---
id: <domain>-<sequence>
status: draft
---

# Proposal: <title>

## Options considered
<brief — one line per option triage evaluated, for context only>

## Motion

### Final statement
<the human's exact selection, verbatim — including any tweak or merge of triaged options>

### Checked against memory
- Constitution: <no conflict | flagged: describe>
- Lessons: <none relevant | flagged: describe, with a pointer to the specific lesson file>

### Dissent
<none | seat: specific, unresolved concern about the final framing above>

## Next
Proceeds to lpwr-specs once this proposal is accepted.
```

---

## 4. Rule additions

38. **Motion never re-runs triage's evaluation.** If a motion step asks the same three seats the
    same question they already answered, it's doing triage's job with different packaging —
    that's the shallowness signal, and the fix is narrowing motion's scope, not deepening it.
39. **Motion is the one point in Frame that gets logged.** The triage debate that precedes it
    stays out of `log.ndjson`, per the existing "log handoffs, not internal reasoning" rule —
    motion is what that rule was missing a concrete anchor for in this domain.
40. **A motion with nothing to report is the expected case, not an incomplete one.** Don't pad
    the constitution-check or dissent sections with restated triage reasoning to make the artifact
    look more thorough — an honest "no conflict, no dissent" is the correct output most of the
    time.

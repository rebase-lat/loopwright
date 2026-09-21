# Loopwright — Design Review Implementation Guide

A conditional checkpoint between Frame and Specify, same shape as the threat-review pattern from
the security guide: most specs skip it entirely, but a change carrying a genuinely consequential
technical decision needs that decision settled *before* acceptance criteria get written against
an assumed structure.

---

## 1. `spec.md` — the `design_review` field

Added to `spec.md`'s frontmatter at `lpwr-specs` time, alongside `risk_tier`:

```markdown
---
id: <domain>-<sequence>
status: draft
risk_tier: low
design_review: none   # none | required
---
```

Set to `required` when the spec involves a new dependency, a schema or API contract change, or a
structural refactor — a human call, same as `risk_tier`, not a keyword-matched default.

---

## 2. `lpwr-design` — conditional command

Runs only when `design_review: required`. Sits between Frame's motion step and Specify — the
decision gets settled before `lpwr-specs` writes criteria that assume a particular shape.

### `templates/adr.md`

```markdown
---
id: <domain>-<sequence>
spec_ref: docs/specs/<id>/proposal.md
date: <date>
status: proposed   # proposed | accepted | superseded
---

# ADR: <title>

## Decision
<the technical choice being made, stated plainly>

## Alternatives considered
| Option | Why not chosen |
| --- | --- |
| <alternative 1> | <reason> |
| <alternative 2> | <reason> |

## Why this one
<the actual reasoning — trade-offs accepted, constraints that drove it>

## Consequences
<what this commits the spec to; what becomes harder or easier because of it>
```

### `commands/lpwr-design.md`

```markdown
---
agent: plan
---

Run only when @docs/specs/$SPEC_ID/proposal.md's design_review is "required".

Produce docs/decisions/$SPEC_ID-adr.md using @templates/adr.md. Consider at
least two real alternatives — a single-option "decision" with no comparison
is not acceptable. Once the human accepts a decision, set status: accepted.

Append one log.ndjson line: intent "specify", spec_ref $SPEC_ID, payload
pointing to the ADR file.
```

---

## 3. The gate

`lpwr-specs` refuses to move `spec.md` to `approved` if `design_review: required` and no accepted
ADR exists — same gate shape as `lpwr-release` checking for a threat review on `high` risk tier.

```
lpwr-specs approval requires: design_review != "required"
                               OR (docs/decisions/<id>-adr.md exists AND status == "accepted")
```

---

## 4. Rule addition

42. **`lpwr-design` settles one decision before the spec locks in — it is not a second proposal
    step.** If it starts re-litigating what Frame's motion already decided, it has drifted into
    Frame's job; its scope is narrower: given what to build, decide the one open technical
    question standing in the way of writing criteria against a stable structure.

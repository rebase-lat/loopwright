# Loopwright — `lpwr-explore` Implementation Guide

An alternate entry into Specify: instead of Frame's proposal feeding `lpwr-specs`, a module's
actual code feeds it directly. One new frontmatter field (`basis`) is all the existing spec
lifecycle needs to absorb this — no new artifact type, no new gate shape.

---

## 1. What it does, and what it recycles

`lpwr-explore <module-path>` reads a module's code directly — no upstream proposal — and drafts a
`spec.md` describing current behavior. Three existing skills cover the job without needing a new
one:

| Skill (existing) | Role in `lpwr-explore` |
| --- | --- |
| `lpwr-boundary-audit` | Maps data flows, edges, and dependencies of the module before drafting anything |
| `lpwr-primary-sources` | Every behavioral claim is grounded in the code actually read, never assumed |
| `lpwr-writing-ears` | The observed behavior is written in the same EARS syntax used for prescriptive specs |

---

## 2. `spec.md` — one new field, two new sections

```markdown
---
id: <domain>-<sequence>
status: draft
basis: observed          # observed | proposed — new field, "proposed" is the default for every other spec
proposal_ref: null        # explicitly null when basis is "observed" — no proposal exists
---

# Spec: <title>

## Current behavior narrative
<plain-language explanation of what this module does today, before the formal EARS breakdown —
written for someone who has never read this code>

## Ubiquitous
- <id>-1: The system shall <always-true observed behavior>.

## Event-driven
- <id>-2: When <trigger>, the system shall <observed response>.

[... same EARS sections as a normal spec ...]

## Open questions
- <anything the exploration found ambiguous — a null check that might be intentional or might be
  a latent bug, a code path with no apparent caller, a comment that contradicts the code>

## Acceptance criteria → test binding
| Criterion ID | Test reference |
| --- | --- |
| <id>-1 | (pending — see §3) |
```

`Current behavior narrative` and `Open questions` only appear when `basis: observed` — a normal
prescriptive spec doesn't need either.

---

## 3. The gate — accuracy review, not desirability review

An observed-basis draft moves from `draft` to `approved` the same way any spec does, but the
question a human is answering is different: **"does this correctly describe what the code does"**
— not "is this what the code should do." Two outcomes:

- **Accurate as described** → approve. It becomes a legitimate baseline spec; any future change
  to this module now goes through the normal loop against a real spec instead of none.
- **Behavior itself is wrong or unwanted** → don't approve. Instead, run `lpwr-propose` using this
  draft as grounding material (same as a `lpwr-improve` candidate). The eventual accepted proposal
  produces a new spec that `supersedes` this one, via the field the lifecycle already has.

No new gate logic required — `spec-link.ts` already checks for `status: approved` before
`lpwr-implement` runs, regardless of `basis`.

---

## 4. A pre-existing permission gap this command exposes

`lpwr-explore` writes `docs/specs/<id>/spec.md` — and the `plan` agent, which this command (and
`lpwr-specs`, `lpwr-tasks`, `lpwr-propose`, `lpwr-design`) all run on, is currently configured
`write: deny` in the permissions table. That's the same contradiction flagged earlier for
`reviewer` and `review.md` — except it's broader here, since `plan` is the agent behind most of
Frame and Specify, not just one command.

Fix with the same pattern already used for `reviewer`: a scoped write exception rather than a
blanket flip.

```jsonc
"plan": {
  "permission": {
    "write": {
      "docs/specs/**": "allow",
      "docs/decisions/**": "allow",
      "docs/memos/**": "allow",
      "docs/context.md": "allow",
      "*": "deny"
    },
    "bash": "deny",
    "webfetch": "allow"
  }
}
```

This should be fixed regardless of whether `lpwr-explore` ships — it's already blocking
`lpwr-specs` and `lpwr-tasks` as specified.

---

## 5. Rule additions

43. **`lpwr-explore`'s draft can only be approved on accuracy, never on desirability.** If a
    reviewer starts editing the draft to describe what the module *should* do instead of what it
    *does*, that's Frame's job — stop, and route through `lpwr-propose` instead.
44. **The `plan` agent needs scoped write access to `docs/specs/**`, `docs/decisions/**`,
    `docs/memos/**`, and `docs/context.md`.** The blanket `write: deny` in the original
    permissions table is a bug, not a policy — it currently blocks `lpwr-specs`, `lpwr-tasks`,
    `lpwr-propose`, and `lpwr-design` from producing their own artifacts.

---
name: lpwr-adr-drafting
description: Draft an architecture decision record with two real alternatives. Use when a spec needs design review (host: lpwr-design / lpwr-specify).
---

# ADR Drafting

Settle one open technical decision before criteria lock in against an assumed
structure. Given what to build, decide the one question standing in the way.

- Frame exactly one decision — if two questions are open, they are two ADRs.
- Consider at least two real alternatives. A single-option "decision" with no
  comparison is not acceptable; neither is a strawman alternative included
  only to lose.
- Record trade-offs accepted and constraints that drove the choice, plus what
  the decision commits later work to (blast radius in both directions).
- The draft stays `draft` until a human approves it. Approval is a verdict on
  the reasoning, not a rubber stamp on the conclusion.

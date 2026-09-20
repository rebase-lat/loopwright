---
name: lpwr-writing-ears
description: Write unambiguous EARS requirements (ubiquitous, event-driven, state-driven, unwanted-behavior, optional-feature). Use when drafting specs, acceptance criteria, or proposals.
---

# Writing EARS

EARS (Easy Approach to Requirements Syntax) produces requirements unambiguous enough to act on. Five patterns:

1. **Ubiquitous** — always true: "The system shall <behavior>."
2. **Event-driven** — "When <trigger>, the system shall <response>."
3. **State-driven** — "While <state>, the system shall <behavior>."
4. **Unwanted behavior** — "If <condition>, then the system shall <response>."
5. **Optional features** — "Where <feature> is included, the system shall <behavior>."

Pitfalls: over-specification (spec implementation details — spec behavior and constraints instead); under-specification (EARS or it doesn't count); skipping the constitution (project-level rules stay out of specs); treating the spec as immutable (behavior change → spec first, code second); specs outside the repo (they rot — specs live in `docs/specs/<id>/`).
Use glossary-exact terms; banned substitutes are enforced.

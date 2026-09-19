---
status: approved
last_amended: 2026-09-19
---

# Project constitution

Ubiquitous rules — always true, never re-litigated per spec.

## Non-functional floors
- The system shall never log credentials or secrets in plaintext.
- The system shall reject any request without authentication.
- The system shall respond to <critical path> within <threshold>.

## Verdict floor
A spec may be marked "ship" only when:
- every acceptance criterion sub-ID has a passing test referencing it, and
- a human has read the diff in full, not only the test output.

## Verdict authority
- Low-risk changes (docs, config, non-behavioral refactors): self-approval permitted.
- Behavioral changes: one reviewer other than the implementer required.

## Standards enforcement
| Language | Linter | Formatter | CI gate |
| --- | --- | --- | --- |
| <lang> | <tool> | <tool> | <required check name> |

## Glossary pointer
See `docs/glossary.md` — banned substitutes are enforced, not suggested.

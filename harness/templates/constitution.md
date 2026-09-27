---
status: draft   # draft | approved — approved only via lpwr-onboard's first-approval question; amendments after that travel through lpwr-propose -> lpwr-review (rule 25)
last_amended: <date>
---

# Project constitution

Ubiquitous rules — always true, never re-litigated per spec.

## Non-functional floors
- The system shall respond to <critical path> within <threshold>.

## Security floors
- The system shall never log credentials, tokens, or secrets in plaintext.
- The system shall reject any request without authentication on <protected surfaces>.
- The system shall not commit secrets, keys, or credentials to version control.
- Dependencies shall carry no known critical or high-severity vulnerability at release time.

Audit command: <one audit command per stack — findings are traced to docs/specs/<id>/audit.md, never blocking>
Deploy command: <the one command that ships this repo — optional; lpwr-verdict-gate blocks it outside an open lpwr-release window (implementation-rules 8)>

## Verdict floor
A spec may be marked "ship" only when:
- every acceptance criterion sub-ID has a passing test referencing it, and
- a human has read the diff in full, not only the test output.

## Verdict authority
- Low-risk changes (docs, config, non-behavioral refactors): the implementer may record their own verdict.
- Behavioral changes: one reviewer other than the implementer required.

## Code Principles
| Language | Linter | Formatter | CI gate |
| --- | --- | --- | --- |
| <lang> | <tool> | <tool> | <required check name> |

## Project Specifics
- <localization and locale rules>
- <external services and environment specifics>

## Business Rules
- <domain rules, e.g. financial handling>
- <rounding, precision, and audit requirements>

## Glossary pointer
See `docs/glossary.md`.

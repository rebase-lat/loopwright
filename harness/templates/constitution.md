---
status: approved
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

Audit command: <one audit command per stack — findings are traced to audit.md, never blocking>

## Verdict floor
A spec may be marked "ship" only when:
- every acceptance criterion sub-ID has a passing test referencing it, and
- a human has read the diff in full, not only the test output.

## Verdict authority
- Low-risk changes (docs, config, non-behavioral refactors): the implementer may record their own verdict.
- Behavioral changes: one reviewer other than the implementer required.

## Standards enforcement
| Language | Linter | Formatter | CI gate |
| --- | --- | --- | --- |
| <lang> | <tool> | <tool> | <required check name> |

## Localization
- The system shall externalize all user-facing strings into locale bundles; no hardcoded user-facing text in code.
- The system shall default to <default locale> and fall back deterministically when a key is missing.
- Dates, numbers, and currency shall render in the user's locale.

## Business rules (financial)
- Monetary amounts shall be represented as integer minor units, never floating point.
- Money calculations shall round <half-even> at <boundary> and record the rounding mode used.
- Every money movement shall append an immutable audit entry with actor, amount, and reason.

## Glossary pointer
See `docs/glossary.md` — banned substitutes are enforced, not suggested.

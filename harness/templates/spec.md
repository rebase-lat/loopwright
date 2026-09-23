---
id: <domain>-<sequence>
status: draft   # draft | approved | superseded
risk_tier: low   # low | medium | high — human-confirmed
design_review: none   # none | required — human call
basis: proposed   # proposed | observed — observed iff drafted from code by lpwr-explore
supersedes: null
proposal_ref: docs/specs/<id>/proposal.md
---

# Spec: <title>

## Current behavior narrative
<plain-language explanation of what this module does today, for someone who has never read the code — lpwr-explore fills this from observed code>

## Ubiquitous
- <id>-1: The system shall <always-true behavior>.

## Event-driven
- <id>-2: When <trigger>, the system shall <response>.

## State-driven
- <id>-3: While <state>, the system shall <behavior>.

## Unwanted behavior
- <id>-4: If <condition>, then the system shall <response>.

## Optional features
- <id>-5: Where <feature> is included, the system shall <behavior>.

## Non-goals
- <explicitly out of scope, to prevent scope creep during lpwr-implement>

## Open questions
<ambiguities found — a null check that might be intentional or latent, a path with no caller, a comment contradicting the code — lpwr-explore files these here, not into invented criteria; every entry must be resolved before approval: promote to a criterion sub-ID, move to Non-goals, or strike with a one-line resolution>

## Acceptance criteria → test binding
| Criterion ID | Test reference (filled by lpwr-implement) |
| --- | --- |
| <id>-1 |  |

## Tasks
1. [ ] <task> — satisfies <id>-1
2. [ ] <task> — satisfies <id>-2, <id>-4
3. [ ] <task> — satisfies <id>-3

### Declared surface
- `<file-or-glob>` per line — the only files `lpwr-implement` may touch

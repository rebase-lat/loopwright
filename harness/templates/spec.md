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
<observed basis only — plain-language explanation of what this module does today, for someone who has never read the code>

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
<observed basis only — ambiguities found: a null check that might be intentional or latent, a path with no caller, a comment contradicting the code>

## Acceptance criteria → test binding
| Criterion ID | Test reference (filled by lpwr-implement) |
| --- | --- |
| <id>-1 |  |

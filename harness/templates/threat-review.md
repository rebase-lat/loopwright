---
id: <domain>-<sequence>
spec_ref: docs/specs/<id>/spec.md
risk_tier: high
date: <date>
---

# Threat review: <title>

## What could go wrong
- <specific failure mode 1 — be concrete, not generic>
- <specific failure mode 2>

## Who could exploit it
- <actor: e.g. an unauthenticated external user, an insider with read access, a compromised dependency>

## Blast radius
- <what's exposed or affected if this goes wrong: data, systems, users, scope>

## Mitigations in this change
| Failure mode | Mitigation | Residual risk |
| --- | --- | --- |
| <mode 1> | <what the diff does about it> | <what's left unaddressed, and why that's acceptable> |

## Verdict
- [ ] Acceptable to proceed  [ ] Needs changes before proceeding
- Reasoning: <why the mitigations above are or aren't sufficient>

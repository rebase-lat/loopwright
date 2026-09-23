---
id: <domain>-<sequence>
spec_ref: <domain>-<sequence>
risk_tier: high
date: <date>
---

# Threat review: <title>

## What could go wrong
- <specific failure mode 1> — <fixed in diff | bound to criterion <id>-<n>>
- <specific failure mode 2> — <fixed in diff | bound to criterion <id>-<n>>

## Who could exploit it
- <actor: e.g. an unauthenticated external user, an insider with read access, a compromised dependency>

## Blast radius
- <what's exposed or affected if this goes wrong: data, systems, users, scope>

## Mitigations in this change
| Failure mode | Mitigation | Residual risk | Criterion binding |
| --- | --- | --- | --- |
| <mode 1> | <what the diff does about it> | <what's left unaddressed, and why that's acceptable> | <fixed | criterion-id — residual risk must be waived/deferred on that criterion at review> |

## Verdict
- [ ] Acceptable to proceed  [ ] Needs changes before proceeding
- Reasoning: <why the mitigations above are or aren't sufficient; every finding is fixed or bound to a criterion ID — free prose with no ID cannot ship>

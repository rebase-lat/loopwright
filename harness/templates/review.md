---
id: <domain>-<sequence>
date: <date>
diff_ref: HEAD (uncommitted)   # `git diff HEAD` — switch to the commit range after lpwr-commit
risk_tier: low   # low | medium | high — carried over from spec.md
waived: none   # criterion IDs explicitly waived, comma-separated; justify each in Verdict reasoning
deferred: none   # format: criterion-id -> follow-up-spec, comma-separated; each needs a follow-up
---

# Review: <title>

## Standards axis
- [ ] Passes linter / formatter / CI gate named in constitution.md
- Notes: <deviations, if any, and why>

## Specs axis
| Criterion ID | Test reference | Pass? |
| --- | --- | --- |
| <id>-1 | <test> | yes/no (leave empty if waived/deferred — see frontmatter) |

## Security axis
- [ ] Audit findings in `docs/specs/<id>/audit.md` (shape: `lpwr-security-scan.ts`) reviewed (or scan clean), no unresolved secrets
- [ ] Constitution's security floors are met
- [ ] Risk tier still looks correct given the actual diff
- [ ] If risk_tier is high: threat-review.md exists and every finding is fixed, or bound to a criterion ID that is passing / waived / deferred (free prose with no ID cannot tick this box)
- Notes: <anything downgraded, deferred, or accepted as residual risk, and why>

## Verdict
- [ ] Ship  [ ] Block  [ ] Redirect
- Reasoning: <why the evidence above is or isn't enough; justify every waived/deferred ID here>

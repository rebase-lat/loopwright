---
id: <domain>-<sequence>
diff_ref: HEAD (uncommitted)   # `git diff HEAD` — switch to the commit range after lpwr-commit
risk_tier: low   # low | medium | high — carried over from spec.md
waived: []       # criterion IDs explicitly waived; justify each in Verdict reasoning
deferred: []     # one `<criterion-id> -> <follow-up spec>` per line; each needs a follow-up
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
- [ ] Audit findings in `audit.md` (shape: `templates/audit.md`) reviewed (or scan clean), no unresolved secrets
- [ ] Constitution's security floors are met
- [ ] Risk tier still looks correct given the actual diff
- [ ] If risk_tier is high: threat-review.md exists and its findings are addressed
- Notes: <anything downgraded, deferred, or accepted as residual risk, and why>

## Verdict
- [ ] Ship  [ ] Block  [ ] Redirect
- Reasoning: <why the evidence above is or isn't enough; justify every waived/deferred ID here>

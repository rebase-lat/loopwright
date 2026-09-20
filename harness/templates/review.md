---
id: <domain>-<sequence>
diff_ref: HEAD~<n>..HEAD
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

## Verdict
- [ ] Ship  [ ] Block  [ ] Redirect
- Reasoning: <why the evidence above is or isn't enough; justify every waived/deferred ID here>

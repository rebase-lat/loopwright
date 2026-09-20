# Glossary

Banned substitutes are enforced, not suggested. `/specs` must use the exact terms below.

| Term | Definition | Banned substitutes |
| --- | --- | --- |
| Spec | An approved `docs/specs/<id>/spec.md` file | "requirements doc", "ticket", "PRD" |
| Verdict | The human decision recorded in review.md | "approval", "sign-off" (too ambiguous — use verdict) |
| Criterion | One EARS statement with sub-ID `<id>-<n>` | "requirement", "item" |
| Surface | The file/glob list declared in `tasks.md` for the active spec | "scope" (too ambiguous — use surface) |
| Waived | A criterion ID listed under `waived:` in `review.md` frontmatter, with justification in Verdict reasoning | "dropped", "abandoned" |
| Deferred | A criterion ID listed under `deferred:` as `<id> -> <follow-up spec>`, moving it to a follow-up | "postponed", "moved" |
| Triage | The neutral / deep-expert / applied-judge debate run by `/propose`; read-only, never writes `docs/` | "panel", "jury" |
| Handoff | One intent-tagged A2A line in `log.ndjson` | "ping", "notification" |

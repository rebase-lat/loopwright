# Glossary

Banned substitutes are rejected at `lpwr-specs` time — the draft goes back until the exact term replaces them (scribe check, human-confirmed; multi-word phrases are the reliable catches). The terms below are required exactly.

| Term | Definition | Banned substitutes |
| --- | --- | --- |
| Spec | An approved `docs/specs/<id>/spec.md` file | "requirements doc", "ticket", "PRD" |
| Verdict | The human decision recorded in review.md | "approval", "sign-off" (too ambiguous — use verdict) |
| Criterion | One EARS statement with sub-ID `<id>-<n>` | "requirement", "item" |
| Surface | The file/glob list declared in the Tasks section for the active spec | "scope" (too ambiguous — use surface) |
| Tasks | The criterion-bound work list in `spec.md`'s Tasks section; the declared surface lives here | "todo list" |
| Waived | A criterion ID listed under `waived:` in `review.md` frontmatter, with justification in Verdict reasoning | "dropped", "abandoned" |
| Deferred | A criterion ID listed under `deferred:` as `<criterion-id> -> <follow-up spec>`, moving it to a follow-up | "postponed", "moved" |
| Triage | The neutral / deep-expert / applied-judge debate plus ratification motion run by `lpwr-propose` | "panel", "jury" |
| Handoff | One intent-tagged A2A line in `log.ndjson` | "ping", "notification" |
| Motion | The ratification of a picked option: pinned final statement, memory check, dissent capture — never a re-run of triage | "resolution", "measure" |
| Risk tier | The `low | medium | high` band in `spec.md` frontmatter, human-confirmed, deciding how much review a spec gets | "risk level" |
| Threat review | The failure-mode analysis required before releasing a `high`-tier spec | "threat model" |
| Design review | The ADR settling one open technical decision before criteria are written | "design doc" |
| ADR | Architecture decision record: decision, alternatives, reasoning, consequences | "decision log" |
| Basis | `observed` (drafted from code by `lpwr-explore`) or `proposed` (from an approved proposal); set at specs time | "origin" |
| Amend | A post-approval change to the Tasks section and criteria of `spec.md` via `lpwr-amend`; voids the review, routes to re-approval | "revise", "tweak" |
| Trunk | The branch checked out in the main worktree — resolved dynamically from git, never hardcoded; the session that mints specs | "main branch", "master branch" |
| Worktree | A linked working tree created for one spec: `dirname(<project root>)/<id>`, branch = folder = spec ID (rule 2) | "spec branch", "checkout" |
| Mint | Create a spec ID's branch + worktree from the trunk session — `worktree_mint`, called by `lpwr-propose` / `lpwr-explore` | "create worktree", "spin up" |
| Prune | Remove a shipped or pending-cleanup worktree and its branch — `lpwr-worktree-prune`, or opportunistically at the next `lpwr-propose` | "close worktree", "delete worktree" |
| Shipped | A spec with a `Done` entry in `docs/state.md` — the derived condition prune and the cap act on (not the same as the Done section itself) | "finished" |
| Open | A worktree that is not the main worktree — each open worktree is one spec's live session | "active worktree" |

# Glossary

Banned substitutes are rejected at `lpwr-specs` time — the draft goes back until the exact term replaces them (scribe check, human-confirmed; multi-word phrases are the reliable catches). The terms below are required exactly. A `—` in the banned column means no safe ban exists (a literal would false-positive on legitimate prose) — the term in the first column is still the required word.

| Term | Definition | Banned substitutes |
| --- | --- | --- |
| Spec | The `docs/specs/<id>/spec.md` record for one spec ID — status runs `draft` → `approved`; only `approved` may enter Execute (rule 2) | "requirements doc", "ticket", "PRD" |
| Spec ID | The `<domain>-<sequence>` key (e.g. `auth-014`) joining worktree, branch, folder, commit messages, and log lines (rule 1) — also called its traceability ID, the formal name used where the ID is assigned (`lpwr-propose`, `lpwr-explore`) | "ticket ID", "issue ID" |
| Verdict | The human decision — `ship`, `block`, or `redirect` — recorded in `docs/specs/<id>/review.md` (rule 7); nothing downstream routes around it | "approval", "sign-off" (too ambiguous — use verdict) |
| Criterion | One EARS statement with sub-ID `<id>-<n>` | "requirement", "item" |
| Surface | The file/glob list declared in the Tasks section for the active spec | "scope" (too ambiguous — use surface) |
| Tasks | The criterion-bound work list in `spec.md`'s Tasks section; the declared surface lives here | "todo list" |
| Waived | A criterion ID listed under `waived:` in `review.md` frontmatter, with justification in Verdict reasoning | "dropped", "abandoned" |
| Deferred | A criterion ID listed under `deferred:` as `<criterion-id> -> <follow-up spec>`, moving it to a follow-up | "postponed", "moved" |
| Triage | The neutral / deep-expert / applied-judge debate plus ratification motion run by `lpwr-propose` | "panel", "jury" |
| Handoff | One intent-tagged A2A line in `log.ndjson` | "ping", "notification" |
| Intent | The closed handoff vocabulary — `frame`, `specify`, `execute`, `verify`, `retain`, `govern` — tagging every handoff line (rule 4); never extended ad hoc | — |
| Motion | The ratification of a picked option: pinned final statement, memory check, dissent capture — never a re-run of triage | "resolution", "measure" |
| Risk tier | The `low \| medium \| high` band in `spec.md` frontmatter, human-confirmed, deciding how much review a spec gets | "risk level" |
| Threat review | The failure-mode analysis required before releasing a `high`-tier spec | "threat model" |
| Design review | The ADR settling one open technical decision before criteria are written | "design doc" |
| ADR | Architecture decision record: decision, alternatives, reasoning, consequences | "decision log" |
| Basis | `observed` (drafted from code by `lpwr-explore`) or `proposed` (from an approved proposal); set at specs time | "origin" |
| Amend | A post-approval change to the Tasks section and criteria of `spec.md` via `lpwr-amend`; voids the review, routes to re-approval | "revise", "tweak" |
| Gate | A check a plugin or a human performs and can refuse with — never a sentence in a command's prompt (rule 5). Prose advises; gates enforce | — |
| State | `docs/state.md` — the project ledger with sections `Done` / `In flight` / `Blocked` / `Next`; exactly one writer (`lpwr-commit`, rule 19) | "status file", "progress tracker" |
| Done | The `State` section a shipped spec is recorded in — `Done` is the record; *shipped* is the condition derived from it | — |
| Foundation | The generated `docs/` layer every session runs on: `lpwr-install` materializes constitution, context, state, audit and ensures `docs/memos/` — those are gitignored, trunk-owned, symlinked into worktrees (rule 49); `lpwr-domain` writes the glossary, which is kept in git so every worktree checks it out. Missing pieces surface as foundation gaps (`lpwr-check-setup`, the TUI sidebar, `lpwr-worktree-status`) | "starter files", "base files" |
| Trunk | The branch checked out in the main worktree — resolved dynamically from git, never hardcoded. A session sits *on trunk* while it is in the main worktree, and only trunk mints specs | "main branch", "master branch" |
| Worktree | A linked working tree created for one spec: `dirname(<project root>)/<id>`, branch = folder = spec ID (rule 2) | "spec branch", "checkout" |
| Work-stage | A command that operates on one spec's worktree (`lpwr-specify` … `lpwr-commit`) — permitted only inside that spec's worktree session | — |
| Mint | Create a spec ID's branch + worktree from the trunk session — `worktree_mint`, called by `lpwr-propose` / `lpwr-explore` | "create worktree", "spin up" |
| Prune | Remove a shipped or pending-cleanup worktree and its branch — `lpwr-worktree-prune`, or opportunistically at the next `lpwr-propose` | "close worktree", "delete worktree" |
| Pending cleanup | The mark `lpwr-commit` records in `.loop-worktrees/manifest.json` once `Done` lands, naming a worktree `lpwr-worktree-prune` may close without waiting for the next `lpwr-propose` (rule 52) | "marked for deletion" |
| Shipped | A spec with a `Done` entry in `docs/state.md` — the derived condition prune and the cap act on (not the same as the `Done` section itself) | "finished" |
| Open | A worktree that is not the main worktree — each open worktree is one spec's live session | "active worktree" |
| Worktree cap | The limit on open worktrees — default 2, resolved on every check (`LPWR_MAX_WORKTREES` or `lpwr.max_worktrees` in `opencode.json`, rule 29); a blocked mint names the recovery | "worktree quota" |

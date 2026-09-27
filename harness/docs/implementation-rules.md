# Loopwright — Implementation Rules

A flat checklist to run against while building, not a re-explanation of the design. Each rule
names the failure it prevents.

## Identity and traceability

1. **Every spec gets an ID before it gets a file.** Format `<domain>-<sequence>`; the ID is
   assigned at `/propose`, not at `/specs` — prevents orphaned proposals with no join key.
2. **The ID is the worktree name, the branch name, and the folder name — never three different
   strings for one spec.** Prevents the traceability chain breaking at the filesystem boundary.
3. **Acceptance criteria get sub-IDs (`<id>-3`), assigned in `spec.md`'s criteria, never elsewhere.**
   Tasks reference criterion IDs; they don't mint new ones — prevents two ID sequences drifting
   out of sync.
4. **Nothing merges without at least one `log.ndjson` line carrying its `spec_ref`.** If a change
   has no traceable ID, treat it as out-of-process work, not a gap in the log.

## Gates

5. **A gate is a check a plugin or a human performs, never a sentence in a command's prompt.**
   "Please only edit in scope" in a command body is not a gate — it's a request an agent can miss
   under pressure. If it must hold, it needs `scope-guard.ts` or equivalent, not phrasing.
6. **`/implement` refuses to start without `spec.md` status = `approved`.** Enforced by
   `spec-link.ts`, checked before the first tool call, not after.
7. **`/review` refuses to render "ship" if any acceptance criterion lacks a test reference.**
   The verdict floor from the constitution is a hard stop, not a recommendation in the reviewer's
   prompt. The only way past it is an explicit waiver: the ID listed under `waived:` (with
   reasoning) or `deferred:` (with a follow-up) in `review.md` frontmatter, enforced by
   `lpwr-verdict-gate.ts` — unlisted gaps never ship, and a silent skip is a miss, not a waiver.
8. **Only `/release` may trigger deploy, and only on a recorded "ship."** No other command path,
   including manual runs of the builder agent, should have deploy permission.

## Placement (which of the six pieces something belongs in)

9. **If removing it would still leave the rule true, it's not an instruction — write it as a
   skill or a gate instead.** `AGENTS.md` and `constitution.md` should shrink over time as things
   graduate into enforced mechanisms, not grow indefinitely.
10. **A correction you've made more than once is a missing skill, not a note to remember next
    time.** Write the skill the first time the correction repeats, not the third.
11. **A command over ~40 lines has a skill hiding inside it.** Extract the procedure, leave the
    command as intent + template + skill reference.
12. **A role that needs a different permission set or a different context than another role gets
    its own agent file.** Don't simulate three agents with one prompt and three headings — the
    triage agents' value depends on genuinely separate context windows.
13. **An output with a required shape gets a template before it gets a command.** Write
    `spec.md`'s frontmatter and acceptance table before writing `/specs` itself, so the command
    has something concrete to fill in.

## Agents and permissions

14. **Read-only agents (`planner`, `neutral`, `deep-expert`, `applied-judge`, `reviewer`, `scout`)
    get `edit: deny` in `opencode.json` — not "instructed not to write."** Config, not prompt
    discipline, is what makes a role actually read-only. Everyone but the `orchestrator`
    additionally gets `task: deny` — only the orchestrator may invoke subagents, so no seat
    or worker can fan out on its own.
15. **`builder` is the only agent with `edit: allow`, and its `bash` permission is `ask`, not
    `allow`.** Shell access stays a checkpoint even for the one agent that's allowed to write.
    Authoring commands (`lpwr-specs`, `lpwr-tasks`, `lpwr-review`, `lpwr-onboard`, `lpwr-amend`)
    run on the `orchestrator`, which delegates the write to `scribe` — whose spawned session
    carries `edit: ask`, so the human confirms each file write and the scribe never approves
    what it writes.
16. **Ephemeral agents (`scout`) return summaries, never raw retrieved content, to the caller.**
    Keeps context economy real instead of aspirational.

## Templates and answerability

17. **Every template needs a slot for what changed, why it was safe, and what happens if it's
    wrong.** If a template has no such slot, it's a note, not a record — don't let it stand in
    for `review.md` or `lesson.md`.
18. **`spec.md`'s acceptance table starts with an empty test-reference column — filling it is
    Execute's job, not Specify's.** Don't pre-fill it with placeholder text; an empty cell is the
    honest state until a test exists.
19. **`docs/state.md` has exactly one writer (`/commit`).** Any other command that's tempted to
    update it should append to `docs/audit.md` instead (the project append-only trail — not the
    per-spec security `docs/specs/<id>/audit.md`) and let `/commit` reconcile.

## A2A and logging

20. **`payload` is always a pointer, never inline content.** A message with a diff or a full file
    pasted into `payload.value` violates pass-by-reference and bloats every downstream agent's
    context.
21. **The intent tag vocabulary is closed at six values.** Don't add a seventh ad hoc — if a
    handoff doesn't fit `frame | specify | execute | verify | retain | govern`, that's a sign the
    handoff is doing two things and should be split.
22. **Log handoffs, not every tool call.** One line per meaningful transition between domains;
    logging every file edit turns the audit trail into noise nobody reads at review time.
23. **Compaction may prune tool output and scratchpad content. It may never prune diff, tests,
    logs, or the "why."** Those four live in `log.ndjson`, outside the compactable window, by
    construction — verify this holds before shipping `guard-compaction.ts`, not after.

## Constitution and governance

24. **Non-functional floors go in `constitution.md` as ubiquitous EARS statements, not in a
    separate security or performance doc.** One syntax, one place, so `/specs` and `/review` both
    check the same file.
25. **Constitution amendments go through `/propose` → `/review`, same as a feature.** No side
    channel for governance changes — if it's important enough to bind every spec, it's important
    enough to survive a verdict.
26. **Banned substitutes in `glossary.md` are enforced at `/specs` time (reject the term), not
    corrected after the fact.** Catching "ticket" instead of "spec" in review is a miss, not a
    save.

## Traps and thresholds

27. **Trap detection stays mechanical (patch count, elapsed time) and never expands into judging
    reasoning quality.** `flag-traps.ts` warns on a threshold crossing; it doesn't grade whether
    an edit was a good idea.
28. **The patch counter resets on commit, not on file close.** A file touched across three
    separate short sessions still counts toward the achievement-trap threshold if none of those
    sessions ended in a commit.
29. **Concurrent worktrees per person start capped at 2** — configurable per project
    (`LPWR_MAX_WORKTREES` env var, or `"lpwr": { "max_worktrees": N }` in `opencode.json`;
    never by editing the harness). The cap is resolved on every check, so changing either
    source takes effect from the next command — no restart. Raise it only after the team
    reports the cap is the actual bottleneck — don't raise it preemptively because the
    tooling allows more. When the cap blocks, the in-band recovery is: resume an open
    spec's session, run `lpwr-worktree-prune` (closes shipped or pending-cleanup worktrees),
    or mark a shipped spec `Done` in `docs/state.md` so the next `lpwr-propose` prunes it.
    Last resort by hand:
    `git worktree remove <path> && git branch -D <id>`.

## Sequencing

30. **Build the constitution before writing the first real spec.** Every downstream gate
    (verdict floor, standards enforcement) reads from it; specs written before it exists will
    need retrofitting.
31. **Wire `spec-link.ts` and `scope-guard.ts` before onboarding a second person onto the
    harness.**
    The gates matter most exactly when more than one person is producing diffs against the same
    repo.
32. **Don't automate `/improve`'s discovery step until it has run manually and proven a query is
    worth repeating.** A scheduled job with no proven signal is noise with a cron trigger.

33. **`lpwr-setup` never gets a spec ID and writes no spec file; its one `docs/` write is the
    append-only `docs/audit.md` suggestion log.** It configures a machine, not a project — keep
    it outside the traceability scheme except for `setup-suggestion` entries, which the human
    marks applied (not `lpwr-commit`, and never as a spec artifact).
34. **`lpwr-guide` is read-only by construction — enforced mechanically by the permission
    matrix: it runs on the `orchestrator`, whose `edit` and `bash` are `deny` in `opencode.json`
    (any `planner` consultation it delegates is equally read-only).** Config,
    not prompt discipline, is what makes a role read-only (same standard as rule 14).
35. **`lpwr-onboard` may run in a repo with no code yet.** Its sections are allowed to come back
    thin on a greenfield project — don't treat a sparse `context.md` as a failure, treat an
    *unrun* `lpwr-onboard` as the failure.
36. **The `lpwr-` prefix is not applied to agents, templates, or the traceability ID** (see the
    prefix table in the v3 guide). Don't "complete the pattern" by prefixing these later; the
    exceptions are deliberate, not oversights.
37. **A command's flat name still declares its stage in its own body (frontmatter or an opening
    line), even though the directory no longer does.** Losing the path-based stage signal from
    the earlier nested layout means the stage now has to be stated explicitly inside each command
    file instead of implied by its folder.

38. **Amend an approved spec only through `lpwr-amend`: status returns to `draft`, `review.md`
    is deleted (the old verdict no longer describes the spec, and the missing review blocks
    commit/release mechanically), the Tasks section reconciles by criterion ID with test refs
    cleared on reworded rows.** Post-ship changes are not amendments — they go through a new
    spec naming the old ID in `supersedes:`.

39. **`risk_tier` is set human-confirmed at `lpwr-specs` time and re-confirmed against the
    actual diff at `lpwr-review` time; `high` requires `threat-review.md` before `lpwr-release`,
    enforced by `lpwr-verdict-gate.ts` — which also enforces the carry-over (review tier must
    equal spec tier; a mismatch blocks commit and release, and a tier change travels through
    `lpwr-amend`).** The scan (`lpwr-security-scan.ts`) runs on every spec
    regardless of tier — proportional review weight, zero exceptions to the floor.

40. **Motion never re-runs triage's evaluation.** If a motion step asks the same three seats the
    same question they already answered, it's doing triage's job with different packaging —
    that's the shallowness signal, and the fix is narrowing motion's scope, not deepening it.
41. **Motion is the one point in Frame that gets logged.** The triage debate that precedes it
    stays out of `log.ndjson`, per the existing "log handoffs, not internal reasoning" rule —
    motion is what that rule was missing a concrete anchor for in this domain.
42. **A motion with nothing to report is the expected case, not an incomplete one.** Don't pad
    the constitution-check or dissent sections with restated triage reasoning to make the artifact
    look more thorough — an honest "no conflict, no dissent" is the correct output most of the
    time.

43. **Every agent shares one voice — differs by permission and domain knowledge, never by tone
    or personality.** If two agents' messages read as having different "characters" once the
    identifiers are stripped out, the persona has drifted; fix the wording, not the role.
    (Numbered 43 — the guide's 41 was taken by the motion rules.)

44. **`lpwr-design` settles one decision before the spec locks in — it is not a second proposal
    step.** If it starts re-litigating what Frame's motion already decided, it has drifted into
    Frame's job; its scope is narrower: given what to build, decide the one open technical
    question standing in the way of writing criteria against a stable structure.

45. **`lpwr-explore`'s draft can only be approved on accuracy, never on desirability.** If a
    reviewer starts editing the draft to describe what the module *should* do instead of what it
    *does*, that's Frame's job — stop, and route through `lpwr-propose` instead.

46. **Full-pass commands coexist with granular ones; tasks live in `spec.md`.** `lpwr-specify`
    runs criteria, design, and tasks in one run while `lpwr-specs` / `lpwr-tasks` / `lpwr-design`
    cover partial states — same pattern as `lpwr-onboard` versus its granular Govern commands.
    Criterion-to-task binding and the declared surface live in the Tasks section, not a
    separate file, so neither can drift from the other.

47. **Install materializes, setup prepares, onboard fills.** `lpwr-install` copies templates to
    missing `docs/` files without overwriting; `lpwr-setup` makes the machine ready; only
    `lpwr-onboard` writes project truth. No domain command runs without `docs/context.md` and
    `docs/constitution.md` — enforced by `lpwr-guard-bootstrap.ts`, with `lpwr-setup`,
    `lpwr-onboard`, `lpwr-guide`, and `lpwr-install` itself exempt.

48. **Built-in and MCP tools are granted per phase via the agent matrix; omitted tools default
    allow, so the matrix names every known builtin.** `mcp_*` defaults `deny` until
    `lpwr-setup` evaluates the enabled servers and the human applies a phase-slot allow —
    setup reports suggested keys only, never patches `opencode.json`. Structured human picks
    (risk tier, design review, verdict, option selection, interview rounds) go through the
    `question` tool; Execute seeds `todowrite` from the Tasks checklist (and Bootstrap from
    setup's steps) but never journals `todo.updated` (rule 22).
49. **`docs/state.md` never enters a spec's branch diff.** It is trunk-owned, gitignored, and
    shared into each worktree by link — written only by `lpwr-commit`, after the merge (single
    writer, same as always). A merge conflict naming `state.md` means a branch carried its own
    copy: unwind that as a process violation, don't resolve it as a diff.
50. **Surface overlap between in-flight specs is caught at `lpwr-tasks`, not at merge time.**
    The worktree guard compares declared surfaces across open worktrees and flags shared paths
    before tasks finalize; a merge conflict on source files between two specs' branches means the
    flag was skipped or overridden — treat it as a process gap to fix, not just a diff to
    resolve.
    (Numbered 49-50 — the worktree guide proposed 45-47; 45-48 were taken and its 46
    restated rule 2.)

51. **Only tracked `docs/specs/<id>/log.ndjson` tails may sit dirty on trunk at the
    squash-merge — nothing else, and never an untracked copy.** Tails are appended to trunk by
    `lpwr-release` / `lpwr-teach` after their own commits; `lpwr-commit` step 6 stages them
    into the next spec's squash so trunk goes clean. They are allowed because the alternative
    is worse: any other dirty file either blocks the merge forever (git tolerates unstaged and
    untracked changes, so nothing else ever clears them) or silently rides an unrelated file
    into an ID-tagged commit (staged files travel with the squash). Untracked files under
    `docs/specs/` — stale phantom journal copies — block by design. The allowed set is data,
    not prose: `TAIL_ALLOWED` in `.opencode/lib/worktree.ts` declares exactly these patterns,
    and `lpwr-worktree-guard`'s squash preflight enforces that list (adding a new tail-riding
    file means adding an entry here and one there — the contract and the gate cannot drift).

52. **Worktree cleanup is self-service, never deferred to a future command.** `lpwr-commit`
    marks its worktree pending cleanup in `.loop-worktrees/manifest.json` (trunk-owned,
    gitignored) once `docs/state.md` records `Done`; `lpwr-worktree-prune` closes worktrees
    that are shipped or pending-cleanup and clean — directly, while dirty or in-flight ones
    require `force`, which always raises a human permission confirmation naming the path. A
    session never prunes the worktree it runs from; the next `lpwr-propose` prunes the same
    eligible set opportunistically before its cap check (rule 29).

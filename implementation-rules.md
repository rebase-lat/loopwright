# Loopwright — Implementation Rules

A flat checklist to run against while building, not a re-explanation of the design. Each rule
names the failure it prevents.

## Identity and traceability

1. **Every spec gets an ID before it gets a file.** Format `<domain>-<sequence>`; the ID is
   assigned at `/propose`, not at `/specs` — prevents orphaned proposals with no join key.
2. **The ID is the worktree name, the branch name, and the folder name — never three different
   strings for one spec.** Prevents the traceability chain breaking at the filesystem boundary.
3. **Acceptance criteria get sub-IDs (`<id>-3`), assigned in `spec.md`, never in `tasks.md`.**
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
   including manual runs of the build agent, should have deploy permission.

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

14. **Read-only agents (`plan`, `neutral`, `deep-expert`, `applied-judge`, `reviewer`, `scout`)
    get `write: deny` in `opencode.json` — not "instructed not to write."** Config, not prompt
    discipline, is what makes a role actually read-only. Leaf roles additionally get
    `task: deny` — only orchestrators (`plan`, `build`) may invoke subagents, so triage
    seats can't fan out on their own.
15. **`build` is the only agent with `write: allow`, and its `bash` permission is `ask`, not
    `allow`.** Shell access stays a checkpoint even for the one agent that's allowed to write.
    Authoring commands (`lpwr-specs`, `lpwr-tasks`, `lpwr-review`, `lpwr-onboard`, `lpwr-amend`)
    run on the `scribe` agent with `write: ask` — the human confirms each file write, and the
    scribe never approves what it writes.
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
    update it should append to the audit log instead and let `/commit` reconcile.

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
29. **Concurrent worktrees per person start capped at 2.** Raise it only after the team reports
    the cap is the actual bottleneck — don't raise it preemptively because the tooling allows more.

## Sequencing

30. **Build the constitution before writing the first real spec.** Every downstream gate
    (verdict floor, standards enforcement) reads from it; specs written before it exists will
    need retrofitting.
31. **Wire `spec-link.ts` and `scope-guard.ts` before onboarding a second person onto `build`.**
    The gates matter most exactly when more than one person is producing diffs against the same
    repo.
32. **Don't automate `/improve`'s discovery step until it has run manually and proven a query is
    worth repeating.** A scheduled job with no proven signal is noise with a cron trigger.

38. **Amend an approved spec only through `lpwr-amend`: status returns to `draft`, `review.md`
    is deleted (the old verdict no longer describes the spec, and the missing review blocks
    commit/release mechanically), `tasks.md` reconciles by criterion ID with test refs cleared
    on reworded rows.** Post-ship changes are not amendments — they go through a new spec
    naming the old ID in `supersedes:`.

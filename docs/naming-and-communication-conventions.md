# Naming and Communication Conventions

General-purpose rules for any implementation of this kind of agent harness — not tied to a
specific project's domain names or ID scheme. Same format as before: each rule names the failure
it prevents.

## Naming — files, paths, identifiers

1. **Pick one casing convention per artifact class and never mix it.** Kebab-case for files and
   directories, snake_case for schema/JSON fields, camelCase or PascalCase only inside code,
   matching that language's own convention. Mixing casing inside one class is what makes grep
   and tooling unreliable.
2. **One identifier scheme, reused everywhere that thing is referenced.** Whatever forms the
   unit-of-work ID (a ticket key, a spec slug, a run ID), that exact string is the branch name,
   the folder name, the log key, and the commit trailer — never a second, "friendlier" version
   of it anywhere downstream.
3. **IDs are stable once assigned and never reused after deletion or supersession.** A stale
   reference to a dead ID should fail loudly, not silently resolve to a newer thing that reused
   the slot.
4. **No version numbers or dates in filenames.** `spec.md` with a `status`/`supersedes` field in
   frontmatter beats `spec-v2-final.md` — versioning belongs in metadata and git history, not in
   the name, or old and new both stay discoverable under the same path.
5. **Commands are verb-first and as short as the verb allows.** `/review`, not `/do-review` or
   `/run-the-reviewer`. If two commands would otherwise share a verb, disambiguate with the
   object (`/spec-review` vs `/code-review`), not with filler words.
6. **A skill's name describes the procedure; its description field describes the trigger.**
   Don't fold "when to use this" into the name — that's what the description is for, and the
   model matches on description text, not on the name string.
7. **Plugins are named `verb-noun` for what they enforce, not for their mechanism.**
   `scope-guard`, `spec-link` — not `hook-1`, `pre-commit-check`. A reader should know what a
   plugin blocks from its name alone, without opening the file.
8. **Agents are named by role, never by model, vendor, or personality.** `reviewer`, `planner`,
   `builder` — not `claude-critic` or `the-skeptic`. Swapping the underlying model should never
   require renaming the role.
9. **Templates share the exact filename of the artifact they produce.** A template that produces
   `review.md` is itself named `review.md` (in the templates directory) — no `review-template.md`
   suffix to keep in sync by hand.
10. **One name per concept, enforced by a single glossary, everywhere in the system.** If the
    glossary calls it a "verdict," no command, skill, or log field may call it an "approval," a
    "sign-off," or a "decision" instead — pick one term and ban the synonyms explicitly.
11. **Don't reuse the same name for two different pieces.** A skill and a command should never
    share a bare name ("review") where context alone disambiguates which one is meant — prefix
    or namespace them (`skill: diff-review`, `command: /review`) if a collision is possible.
12. **Boolean and permission fields read the same direction everywhere.** Pick `allow`/`deny` or
    `true`/`false` and use it consistently; don't let one config file invert the polarity of a
    flag another file uses the plain way.

## Communication — human-facing

13. **Disclose before acting, for anything consequential or hard to undo.** State what's about to
    happen before doing it, not after — a summary after the fact is a report, not a disclosure.
14. **Lead with the outcome; hold the process in reserve for when it's asked for.** The default
    answer is "what happened and what it means," with the step-by-step trace available on
    request, not delivered unprompted.
15. **State confidence as a real signal, not a hedge.** "High confidence, based on a passing test
    for this exact case" and "low confidence, this is inferred from adjacent code" are both
    useful; a reflexive "I think this should work" attached to everything is not.
16. **Match claims to evidence.** Don't say a change "fixes" something without a passing check
    behind it — say what was verified and what wasn't, plainly.
17. **Keep internal identifiers out of human-facing messages unless the human is working with
    them directly.** A person reading a summary doesn't need the raw ID string; a person
    debugging a specific run does — write for whichever one is actually reading.
18. **Never silently narrow or widen scope.** If the actual change ends up bigger or smaller than
    what was asked, say so explicitly rather than letting the diff speak for itself.
19. **State limits and unknowns as plainly as results.** "This covers the common case; the edge
    case around X is untested" is more useful than silence on the gap.

## Communication — agent-to-agent

20. **Structured messages between agents, plain language only in the human-facing layer.**
    A handoff between two roles is a schema with fixed fields; a message to the person is
    prose — don't make a human parse a JSON blob, and don't let inter-agent messages drift into
    free text that the next agent has to interpret.
21. **Every handoff carries an explicit intent from a closed, small vocabulary.** An open-ended
    "type" field that grows ad hoc reintroduces the ambiguity structured messages exist to
    remove — add a new intent value deliberately, not as a one-off.
22. **Payloads are pointers, not inline content.** A handoff references where the content lives
    (a file path, a diff range, a run ID) rather than embedding the content itself — keeps
    messages small and avoids two copies of the same artifact drifting apart.
23. **Every handoff carries a confidence or status field, not just content.** The receiving agent
    should be able to tell "this is settled" from "this is a first draft" without inspecting the
    payload.
24. **Log handoffs, not internal reasoning.** The audit trail records what was passed between
    roles and when — not a transcript of each agent's intermediate thinking, which bloats the log
    without adding answerability.

## Communication — errors and escalation

25. **An error names what failed, why, and what would resolve it — never just "failed" or
    "blocked."** "Blocked: criterion 3 has no passing test" is actionable; "validation error" is
    not.
26. **An escalation names the specific decision needed and who can make it, not just that help is
    needed.** "Needs a call on X, requires role Y" beats "stuck, please advise."
27. **A refusal states the boundary, not the detection mechanism.** Say what the constraint is,
    not exactly what pattern in the input tripped it — the same rule that governs safety refusals
    applies to any enforced boundary: state the principle, not the trigger logic, so the reason
    is clear without teaching evasion.
28. **Repeated failures escalate with escalating specificity, not escalating volume.** The third
    retry's message should contain more diagnostic detail than the first, not just a louder
    restatement of the same message.

## Terminology discipline

29. **Don't let a term's meaning drift across domains.** If "draft" means "not yet reviewed" in
    one artifact type, it can't mean "work in progress, might change again" in another — pick one
    meaning per term, system-wide.
30. **New terminology needs a glossary entry before it needs a second user.** The moment a second
    command or skill needs the same concept, name it once, centrally, rather than letting each
    piece coin its own phrase for the same thing.

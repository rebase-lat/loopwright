# Principles

Loopwright treats AI coding as a governed loop: agents supply **capability**
(investigate, implement, test, report); humans keep **agency** (decide,
verify, approve, own). Specs, mechanical gates, and external evidence make
that work answerable — never a model's say-so.

## Spec & lifecycle

- Spec first: no Execute without an approved `spec.md`; behavior changes amend
  the spec before code — never the reverse.
- The spec lives in the repo as the single source of truth and evolves with
  the code; specs outside the repo rot.
- One spec ID (`<domain>-<sequence>`) joins worktree, branch, folder, commits,
  and log lines.
- Specs state behavior and constraints (EARS), not implementation details;
  non-functional floors live as ubiquitous EARS in the constitution.
- Flow maps to stages: Frame → Specify → Execute → Verify → Retain, plus
  Bootstrap and Govern; full-pass `lpwr-specify` coexists with granular
  commands; tasks live in `spec.md`.
- Human checkpoints at propose, specs, and review — don't vibe code.
- Waivers and deferrals are explicit in review frontmatter with justification;
  unlisted gaps never ship.

## The loop, verdict & answerability

- Quality → verdict → answerability: investigate, implement, verify, repeat;
  independent evidence decides "done."
- Gates provide independent evidence; the **human owns** `ship | block |
  redirect` — nothing routes around a recorded verdict.
- Every record answers: what changed, why it was safe, what happens if it's
  wrong.
- Agent = capability; engineer = agency. Loop boundary is evidence (diff,
  tests, logs, why); constraints and lessons feed the next run.
- State and memory live outside the conversation: `state.md` (one writer),
  `log.ndjson`, `docs/lessons/`.
- Watch the hidden costs: cognitive surrender (blind accept), cognitive debt
  (eroded understanding), orchestration tax (managing many agents) —
  prioritize attention with worktrees, scopes, and evidence.

## Metacognition & skill retention

- Eight traps, named: forming, dislodging, assumption, location, achievement,
  progression, interruption, mislead.
- Countermeasures stay mechanical where possible: compare options before
  committing; 15-minute time-box then stash and reset; acceptance criteria
  before code; audit boundaries before "almost done"; more than three patches
  on one file → root-cause refactor; explain-back before accepting a patch;
  inline completion off; verify generated claims against primary sources.
- Hypothesis before prompt; ask why; read the diff in full; record the single
  highest-value lesson — specific, not everything suspected.
- Keep **deep expertise** (what should happen) and **applied judgement** (what
  would convince you it happened); delegate the rest to the inner loop.
- Four human skills: decide what deserves to exist, specify the outcome,
  steer mid-flight, verify the evidence.

## Communication & context economy

- Human↔agent: disclose consequential or non-reversible actions before
  executing; outcome first, traces on request; state limits and escalate
  cleanly instead of guessing.
- One voice for every agent (`lpwr-voice`): flat register, no filler — agents
  differ by permission and knowledge, never tone. Say exact things exactly;
  say explanatory things once.
- Agent↔agent: structured payloads; closed intents
  `frame|specify|execute|verify|retain|govern`; no same-intent re-delegation;
  bounded context transfer (IDs, verified artifacts — never raw conversation).
- Pass-by-reference: artifact pointers, never inline content.
- Scouts and other sub-agents return minimal consolidated results, not raw
  dumps.
- Compaction prunes scratchpads and tool output only — never diff, tests,
  logs, or why.

## Harness design

- Every repeated correction becomes a harness piece — skill, gate, or
  instruction — written the first time it repeats; harness changes are
  reviewed like code (`lpwr-propose` → `lpwr-review`).
- Prose advises; plugins enforce; agents isolate by permission. A gate that
  must hold is a mechanism, not a sentence in a prompt.
- Permissions live in config (`opencode.json`), not prompt discipline;
  only `builder` writes unconditionally; `scribe` authors with ask-level
  confirmation and never approves what it writes.
- Placement tests: command longer than ~40 lines → extract a skill; required
  output shape → template first; different permission/context → own agent
  file; removable-but-still-true → not an instruction.
- Worktrees per spec ID (see below); only the `orchestrator` spawns;
  `state.md` has one writer.
- Bootstrap is split on purpose: `lpwr-setup` prepares the machine,
  `lpwr-install` materializes, `lpwr-onboard` fills.

## Worktree lifecycle

One flow, four explicit stops — mint → work → commit → prune; nothing waits
on a future command to clean up after itself:

- **Mint** (trunk): `lpwr-propose` / `lpwr-explore` journal the frame/specify
  handoff, then call `worktree_mint` — branch + worktree `../<id>` beside the
  project (name = branch = folder, rule 2), foundation files symlinked in,
  spec folder moved out of trunk. The human restarts opencode in the
  reported path.
- **Work** (the spec's worktree): every work-stage command is gated to that
  session; trunk mints specs, it never works them.
- **Commit**: `lpwr-commit` squash-merges one ID-tagged commit onto trunk and
  marks the worktree pending cleanup (`.loop-worktrees/manifest.json`, written
  only after `state.md` records `Done`) — the session cannot delete the
  directory it runs from.
- **Prune**: `lpwr-worktree-prune` closes worktrees that are shipped (a `Done`
  entry in `state.md`) or pending cleanup, when clean; dirty or in-flight
  ones only via `force`, which always raises a human confirmation naming the
  path. The next `lpwr-propose` prunes the same eligible set opportunistically
  before its cap check. A session never prunes its own worktree.
- **Cap**: 2 open worktrees by default; raise per project with
  `LPWR_MAX_WORKTREES` or `"lpwr": { "max_worktrees": N }` in `opencode.json`
  (rule 29). At the cap, resume an open session, prune, or mark a spec
  `Done`; last resort by hand: `git worktree remove <path> && git branch -D
  <id>`.

## Code quality

- SOLID, DRY, KISS; names carry purpose; consistent formatting, clear
  comments, proper error handling, tests at unit and integration levels.
- Clean code is a mindset enforced as constitution floors — not a checklist
  re-litigated per spec.
- Specs avoid prescribing implementation; the constitution carries the
  ubiquitous quality rules.

## Open tensions

- Independent check vs human-owned verdict: this resume reads them as
  *gates supply evidence, human owns the final verdict* — confirm that split
  stays canonical.
- Spec-driven four phases (Specify → Plan → Tasks → Implement) vs the
  six-domain + Bootstrap stage model — which is canonical in prose?
- Zero-trust identity-bound A2A tokens (MCP/ACP): goal or out of scope?
  Today's handoffs are logged JSON lines without identity tokens.

## Sources

- Synthesized from the former `docs/principles/` essays (spec-driven
  development, process map, metacognitive traps, loop engineering, agent
  skill decay, effective communication, clean code) — those files were
  retired into this resume at 1.0.0.
- Enforcing layer (mechanism, not intent): `harness/AGENTS.md`,
  `harness/docs/conventions.md`, `harness/docs/implementation-rules.md`.

# Changelog

All notable changes to this project, grouped by git tag. See the commit
history for per-change detail.

## [1.4.3] — 2026-09-26

- Verification follow-ups to the 1.4.2 worktree rework: a full re-check of
  the shipped code (17 item checks + 6 cross-cutting regressions) found one
  outright miss and three soft gaps — all closed:
  - **`.env` failure is visible** (W5): a failed `.env` write now raises a
    TUI toast alongside the structured log — the single check that failed
    outright, previously a warning buried in `logWarn`.
  - **Stale pending-cleanup marks can't strand**: `lpwr-worktree-prune`
    sweeps marks whose worktree no longer exists (removed outside the
    service) via a strict `git worktree list` — a git failure skips the
    sweep instead of misreading every key — and only the mutating prune
    path writes the manifest, so `lpwr-guide` stays read-only (rule 34).
    `clearPending` runs immediately after `git worktree remove`, so a
    branch-delete failure no longer leaves a key behind.
  - **Cap resolution documented** (rule 29): `LPWR_MAX_WORKTREES` /
    `opencode.json` `"lpwr": { "max_worktrees": N }` are resolved on every
    check — edits take effect from the next command, no restart.
  - **Fixtures**: invalid `LPWR_MAX_WORKTREES` values (`abc`, `0`) fall
    through to the config value instead of disabling the cap through
    NaN/0 comparisons; the integration cycle injects a phantom `auth-999`
    mark and proves the sweep clears it — 32 tests total.

## [1.4.2] — 2026-09-26

- Worktree lifecycle rework — the 17-fix audit plan (workarounds W1–W9,
  drift D1–D7, traps T1–T7), landed in phases:
  - **Worktree service**: new `.opencode/lib/worktree.ts` owns minting,
    foundation provisioning, status, the cap, pruning, and the
    pending-cleanup manifest; `lpwr-worktree-guard` shrinks to a thin
    adapter (command gates, three tools, the `lpwr-commit` completion
    event, squash preflight). Decision logic (`pruneDecision`,
    `capBlocked`, `statusReport`, `mergeBlockingFiles`, `resolveCap`,
    `stateHasEntry`) is exported pure so fixtures test the enforced code
    (D1, D5).
  - **Explicit minting** (W1): the `tool.execute.after` coupling to
    `journal_handoff` is gone — `lpwr-propose` step 7 and `lpwr-explore`
    call the new `worktree_mint` tool right after journaling, so creation
    is a deterministic call instead of a side effect of journal args.
  - **Self-service pruning** (W7, W8, D3): new `lpwr-worktree-prune`
    (status → human pick → `worktree_prune`) closes shipped or
    pending-cleanup worktrees; dirty or in-flight ones only via `force`,
    which always raises a human permission confirmation naming the path
    (`worktree_prune.force` defaults to ask). A session never prunes the
    worktree it runs from. Cap errors, guide steps 0/18, and
    prune advisories now name the command instead of `git worktree remove`.
  - **Pending-cleanup manifest** (W7, D2): `lpwr-commit` records its
    worktree in `.loop-worktrees/manifest.json` (gitignored; written only
    after `state.md` Done lands — rule 52), so cleanup no longer waits for
    a future `lpwr-propose`; the prune command reads the manifest, and the
    next propose still prunes the same eligible set opportunistically.
  - **Configurable cap** (T4): `LPWR_MAX_WORKTREES` env → `opencode.json`
    `"lpwr": { "max_worktrees": N }` → 2. opencode ignores unknown config
    keys (`onExcessProperty: "ignore"`), so the service parses the raw
    JSONC itself; rule 29 documents the knob and the in-band recovery.
  - **Provisioning honesty** (W2–W4, T7): silent catches replaced with
    `logInfo`/`logWarn`/`logError` plus one aggregated gap toast; missing
    link targets name `lpwr-install` / `lpwr-setup`; the guard no longer
    `mkdir`s `docs/memos` (lpwr-install owns it), and `docs/memos` joins
    `EXPECTED` so `lpwr-check-setup` and the TUI sidebar surface the gap
    instead of hidden state.
  - **Merge-tail contract** (W9, T3, D6): `TAIL_ALLOWED` declares which
    trunk-dirty files may ride the squash — documented as rule 51, enforced
    from that data by the preflight (tails of tracked
    `docs/specs/*/log.ndjson` pass; untracked phantom copies and everything
    else block).
  - **Flag-safe argument parsing** (T2): `specIdArgument` finds the first
    spec-ID token — `lpwr-commit --amend auth-014` now keys on `auth-014`,
    used by wrongTree, the surface-overlap advisory, and the commit event.
  - **Terminology + lifecycle docs** (D-section): glossary gains canonical
    Trunk / Worktree / Mint / Prune / Shipped / Open rows; strings
    normalised ("Worktree cap reached (max: N)", "restart opencode in the
    trunk worktree (…)", no more "close by hand"); AGENTS.md protocol line
    13, a PRINCIPLES "Worktree lifecycle" section (mint → work → commit →
    prune, cap, prune conditions, manual last resort), and
    conventions/guide/lpwr-commit/README updated to match; new read-only
    `lpwr-worktree-status` command (27 commands total).
  - Tests: `test/worktree.test.ts` (mocked porcelain output, prune
    decisions, cap resolution, tail contract, manifest, `specIdArgument`) +
    `test/worktree-integration.test.ts` (real temp repo: mint → work →
    squash-merge → mark → prune with no orphans, cap block, force
    confirmation, own-worktree protection) — 32 tests total.

## [1.4.1] — 2026-09-26

- Third workflow simulation (Round 6) fixes — findings table and wave record
  in `integration-analysis.md` (9 new findings fixed; all 7 open Round 5
  items closed):
  - **Order-independent journaling**: `lpwr-log-handoffs` writes its
    backstop auto-line from opencode's `command.executed` event —
    published only after every `command.execute.before` gate passed and
    the command ran — so a blocked command never journals, whatever order
    the install loads its plugins in (directory-scan order is
    filesystem-dependent; two `opencode debug config` captures proved two
    installs of the same harness disagree). The spec folder resolves
    through the session root plus every registered worktree; a
    spec-shaped ref with no folder anywhere is refused instead of
    `mkdir`-ing a phantom — that phantom later blocked `git merge
    --squash` with an untracked-collision abort (reproduced).
    `lpwr-commit` keeps no auto-line: its step-5 retain line rides the
    merge, and an end-of-command line would dirty the worktree the next
    propose must prune.
  - **`shared.ts` moves from `plugins/` to `lib/`**: opencode requires
    every plugin export to be a function, so its RegExps/arrays made
    discovery throw `Plugin export is not a function` on every startup —
    the 1.0.0 "no-op default loads safely" claim never held. New
    `test/plugin-shape.test.ts` keeps plugin entry modules
    default-export-only, and `lpwr-spec-link` now diagnoses missing
    foundation / worktree-resident spec / unknown ID itself instead of
    trusting which hook runs first.
  - **Squash-merge preflight**: `lpwr-worktree-guard` gates
    `git … merge --squash` on pending trunk changes — journal tails
    (`docs/specs/*/log.ndjson` left by `lpwr-release` / `lpwr-teach`)
    ride the squash (commit step 6 stages them), staged strangers are
    blocked (git would silently absorb them into the ID-tagged commit),
    and everything else names its recovery; harness-subpath aware for
    nested layouts. The staged-secret scan and this gate follow the
    command's `-C` target or a leading `cd <dir>`.
  - **In-flight = worktrees**: guide and the TUI sidebar derive the
    active spec from the session `.env` → state `In flight` → open
    worktrees (reading status/verdict from the owning worktree);
    `templates/state.md` ships empty sections so the sidebar never
    renders placeholder `blocked:` lines; guide step 6 conditions on
    "no active spec" instead of the always-empty state section; redirect
    verdicts name manual worktree closure (only shipped specs prune).
  - **Memos join FOUNDATION**: `docs/memos/` is gitignored, trunk-owned,
    and symlinked into spec worktrees like `state.md` (rule 49);
    `.gitkeep` is untracked, `lpwr-install` materializes the dir, and
    release tarballs exclude it. Existing installs run `git rm --cached
    docs/memos/.gitkeep` once — the Round 6 migration note.
  - Round 5 leftovers + prose alignments: guide step 11 flags
    template-placeholder tasks; `lpwr-specify` shares `lpwr-specs`'
    resume rule; `.opencode/package.json` gains `"type": "module"`;
    `lpwr-review` collects the verdict through the `question` tool (rule
    48's claim now true); builder's journal artifact matches implement
    (criterion id); guide step 3 drops the `lpwr-constitution` misroute;
    `lpwr-amend`'s Next names the `lpwr-specs` re-approval hop.
  - Tests: `specDirNames` + plugin-shape fixtures — 20 tests total.

## [1.4.0] — 2026-09-26

- Harness distribution via `loopwright.sh` (shell-first installer):
  - `install` stages a release tarball (`gh`/`GITHUB_TOKEN`, or
    `--source local`), copies `harness/` into the project root, and merges
    into existing files with JSONC comment preservation: the matrix wins in
    `opencode.json` (project keys outside it survive, `instructions`
    unions), `.gitignore` line-unions, and a pre-existing `AGENTS.md` is
    kept while the protocol lands in `AGENTS.lpwr.md`. Colliding files
    require `--yes`; every pre-write backup lands in `.loopwright/backups/`;
    a checksummed `.loopwright/manifest.json` plus payload cache record
    what was installed.
  - `update` 3-way merges from the cached base — `git merge-file` for plain
    files, JSONC-aware merge for configs — so local edits and upstream
    changes both land. Real conflicts keep markers and set manifest state
    `conflict`: `doctor` flags them until the human resolves and `fix`
    records the resolution; upstream-removed files are pruned only when
    untouched.
  - `doctor`/`fix`/`status`/`uninstall`/`--dry-run`: payload integrity vs
    manifest, JSONC validation, dependency-layout checks
    (`@opencode-ai/plugin`, `solid-js`, `@opentui/solid`), `opencode agent
    list` smoke, gitignore/secrets hygiene — mechanical problems are
    repaired (restore from cache, `npm install`, re-inject harness config
    keys), workflow-state gaps only point at `lpwr-install`/`lpwr-onboard`/
    `lpwr-domain`. Exit codes: 0 clean, 1 findings, 2 not installed.
  - `harness/.opencode/package.json` is now tracked as the payload's
    dependency manifest (plugins value-import `@opencode-ai/plugin`, the
    TUI imports `solid-js`), with `@opentui/solid`/`solid-js` pins;
    `.opencode/lib/installer-lib.mjs` ships the JSONC merge/manifest/report
    engine the script drives.
  - Tests: `test/install.test.mjs` covers the lifecycle (guards, 3-way
    merge, conflict bookkeeping, fix restores/heals, uninstall restore) —
    18 tests total.

## [1.3.3] — 2026-09-25

- Second workflow simulation (Round 5) fixes — the three proven findings:
  - `lpwr-scope-guard` containment now matches from the project directory
    (`plugin.directory`), the same anchor the surface patterns
    (`docs/specs/<id>/**`, `RETAIN_PATHS`, Tasks backticks) are written
    from — a harness in a git subdirectory no longer blocks every
    harness-internal write on a spec branch. Root and nested layouts behave
    alike; Round 4's "nested not supported" exclusion is retired.
  - The worktree cap block (rule 29) and the guide's injected worktree
    status now name every recovery: resume an open spec's session, mark a
    shipped spec Done so `lpwr-propose` prunes it, or remove one by hand
    (`git worktree remove <path>` + `git branch -D <id>`); guide step 0
    branches on shipped vs none-Done instead of dead-looping on
    `lpwr-propose` when its prune would be a no-op.
  - The harness ships `harness/.gitignore` (generated foundation,
    secrets, dependencies) and `lpwr-check-setup`'s `EXPECTED` list checks
    it — a root install no longer carries untracked foundation files that
    defeat the shipped-worktree prune or get staged by `git add -A`.
  - `integration-analysis.md` gains the Round 5 findings table (3 fixed,
    7 open).

## [1.3.2] — 2026-09-25

- Runtime simulation fixes (end-to-end workflow dry-run):
  - `lpwr-worktree-guard` no longer throws on `frame`/`specify` handoffs made
    inside a spec worktree — minting only happens in the trunk session and a
    worktree journal is a no-op. Its mint note now reports the worktree's
    project-root directory (where opencode must be restarted) rather than the
    bare worktree path.
  - `lpwr-scope-guard` reads the spec and declared surface from the project
    directory (the same anchor as `lpwr-spec-link`), not the git root, so the
    spec resolves whether the harness sits at the project root or in a
    repository subdirectory. The declared-surface parser moves to
    `lib/gates.ts` and is shared with `lpwr-worktree-guard`'s rule-50 overlap
    check — one parser instead of two divergent ones.
  - `lpwr-guard-bootstrap` logs an advisory when `docs/constitution.md` is
    still `status: draft`, so install-then-skip-onboard is visible. It stays a
    warning, not a gate, so a greenfield constitution keeping honest
    "nothing found" placeholders is never trapped.
  - `lpwr-propose` / `lpwr-explore` prose points at the guard-reported restart
    path instead of the hardcoded `../<id>/harness`; `lpwr-explore` routes to
    `lpwr-tasks` first (implement is blocked without a declared surface);
    `lpwr-guide` step 0 notes that `lpwr-propose` prunes shipped worktrees.
  - Tests: `declaredSurfaceFrom` fixture added (10 fixtures total).

## [1.3.1] — 2026-09-25

- Consistency pass (Round 3 Wave C): `conventions.md` cites the right
  AGENTS.md rules; README plugin count and repo layout document the root
  `opencode.json` developer MCP config (distinct from the shipped matrix);
  `templates/audit-per-spec.md` gives the per-spec security trace a real
  contract, referenced from `lpwr-security-scan`, the review security axis,
  and `templates/audit.md`; the TUI pulse reads handoff `confidence` as the
  string enum the journal writes (it read a number and never rendered),
  handles `waived: []` empty markers, and lists open spec worktrees with
  shipped/in-flight state; `lpwr-voice` is named by every agent; the
  constitution template comment matches the onboard approval path; and
  `integration-analysis.md` gains the Round 3 pass plus a Round 2 close-out.
- Committed gate-fixture harness: the pure gate predicates (`parseWaived`,
  `parseDeferred`, `tableComplete`, `verdictCheck`, `securityAxisComplete`,
  `threatAccepted`, `templateLeftovers`, `receiptIncomplete`, `overlaps`)
  move to `harness/.opencode/lib/gates.ts` and are imported by the
  enforcing plugins — the tested logic is the enforced logic, never a copy.
  `node:test` fixtures under `test/` run via `npm test`; `tsconfig.json`
  gains the `lib`/`test` includes and `allowImportingTsExtensions`.

## [1.3.0] — 2026-09-25

- Single orchestrator: new `orchestrator` agent is the only interactive
  primary (builtin `build`/`plan` disabled, `default_agent` switched);
  all 25 commands repin `agent: orchestrator`, 20 of them gaining an
  explicit `Delegation:` line. Builder demoted to subagent and every
  other agent takes `task: deny` — workers never spawn; they end with a
  complete report (did / needs / artifact pointers) even when blocked,
  and the orchestrator acknowledges, re-delegates, and resumes them
  until the command completes. Permission matrix, conventions, and
  implementation-rules updated to match.
- Audit trail shape moved to `harness/templates/audit.md`;
  `lpwr-install` materializes `docs/audit.md` from it (missing-only,
  never overwrites), `lpwr-setup` seeds it, and the generated file joins
  the gitignored foundation set.
- TUI workflow-pulse sidebar: `harness/tui.json` loads
  `.opencode/tui/lpwr-tui.tsx` via relative path (no build step),
  rendering a read-only session-view sidebar — active spec frontmatter
  (status, risk tier, design review), verdict tick, waived/deferred
  counts, in-flight/blocked, open audit entries, last journal handoff,
  and foundation gaps. Refresh via the `Refresh Loopwright sidebar`
  palette command or a debounced file-watcher reload on `docs/**`,
  `AGENTS.md`, `opencode.json`, and `tui.json`. The `EXPECTED` setup
  list moves to `plugins/shared.ts` so the setup gate and the sidebar
  gap view share one source; root `tsconfig.json` gains the JSX/solid
  settings and fmt globs cover the new `.tsx`/`tui.json`.
- Branch-per-spec worktrees: new `lpwr-worktree-guard` plugin mints
  `git worktree add -b <id> ../<id>` from trunk on the first
  `journal_handoff` (frame/specify), moves `docs/specs/<id>/` into it,
  and links the gitignored foundation files (state/context/constitution/
  audit) plus plugin deps from trunk — one physical `state.md` (rule 49).
  The cap of 2 (rule 29) blocks at `lpwr-propose`/`lpwr-explore` after a
  prune pass for shipped+clean trees; work-stage commands are blocked
  outside their spec's worktree; `lpwr-tasks` gets declared-surface
  overlap warnings across in-flight worktrees (rule 50); `lpwr-guide`
  leads with worktree status. `lpwr-review` rebases `--autostash` onto
  trunk first; `lpwr-commit` now writes the lesson and retain line on the
  branch, squash-merges to trunk (one ID-tagged commit), writes state
  through the shared link, and defers worktree cleanup to the next
  propose. Conventions split mint-on-trunk from work-in-worktree.
- Round 3 review fixes (mechanism correctness): `lpwr-scope-guard` now
  always allows the harness bookkeeping paths (`docs/lessons/**`,
  `docs/state.md`, `docs/audit.md`, `docs/memos/**`) so the Retain writes
  `lpwr-commit` makes on the spec branch are not blocked by the declared
  surface; `lpwr-threat-review` and keyed `lpwr-diagnose` join the
  worktree-contained stage set and `lpwr-threat-review` routes to
  `lpwr-commit` (commit precedes release); `lpwr-review` derives trunk
  from the main worktree instead of hardcoding `develop` (shared
  `trunkBranch`), and mint reuses it; `lpwr-commit` reconciles any open
  `release-ref`, not only its own id — release appends after commit, so
  the narrower rule never fired.
- Round 3 review fixes (contradictions): rule 33 names `docs/audit.md` as
  `lpwr-setup`'s one `docs/` write; `lpwr-stack` says implement/diagnose
  *prefer* the recorded tools (the `question` checkpoint is the gate, no
  plugin enforces choice); `lpwr-amend` deletes `review.md` when it voids
  the review; `lpwr-improve`, `lpwr-interview`, and `lpwr-propose` carry
  the explicit `Delegation:` line.

## [1.2.0] — 2026-09-23

- Integration analysis (`integration-analysis.md`, repo root): 40-finding
  cross-phase audit (Wired/Prose/Gap/Ephemeral) plus the three-wave plan that
  landed with this release.
- Wave 1: `lpwr-setup` diffs the Stack section of `context.md` and the guide
  gains a stack-drift step; `lpwr-domain` refreshes the Domain section;
  propose reads topic memos (`Memos:` line in the proposal template); open
  questions must resolve to criterion/non-goal/struck before approval;
  threat findings must be fixed or bound to a criterion ID at review.
- Waves 2–3: append-only `docs/audit.md` (setup-suggestion, improve-candidate,
  release-ref) with commit-step reconcile into `state.md` Done; onboard owns
  the constitution's first approval (amendments-only thereafter);
  `question` checkpoint for unlisted bash binaries in implement/diagnose;
  threat-review reads the ADR; diagnose names criterion IDs as regression
  targets; implement reads the diagnose memo; commit/teach prefer
  explain-back insights; guide branches block→diagnose and redirect→memo
  grounding (21-step decision path).
- Verdict-gate strips inline frontmatter `# …` comments from `waived:` /
  `deferred:` values so format-hint comments no longer become phantom waiver
  IDs or deferred-entry errors.
- Guide/ledger fixes: Next chain, bootstrap order, rule refs, phase profile
  across all commands.

## [1.1.1] — 2026-09-23

- Permission matrix names every known builtin on all eight agents (omitted
  tools default allow); global `mcp_*` and `websearch` deny, `doom_loop` /
  `external_directory` ask; `lsp` allow only on builder, `websearch` allow
  only on deep-expert; `question` denied on triage leaves.
- Structured human picks go through the `question` tool (risk tier, design
  review, verdict, option selection, interview rounds); Execute and Bootstrap
  seed `todowrite` from their checklists without journaling `todo.updated`
  (rule 48 + conventions).
- `lpwr-setup` step 4 evaluates the tool surface and MCP servers report-only —
  flags rule-16 gaps and emits copy-pasteable permission keys; never patches
  `opencode.json`. Env flags (`OPENCODE_ENABLE_EXA`/`_PARALLEL`,
  `OPENCODE_EXPERIMENTAL_LSP_TOOL`) documented, not flipped.
- `apply_patch` handled across gates: scope-guard parses `*** … File:` marker
  paths, secret scan pre-writes pending `patchText`, flag-traps counts edits
  when a real `filePath` is present.
- Advisories replace `console.warn` with `logWarn` (`client.app.log`) and a
  shared one-shot `toastWarning`; permission denials and setup gaps log
  structured warns (setup aggregates one toast).
- Verdict-gate strips inline comments and code spans before the
  template-leftover check so format hints no longer false-positive;
  `templates/review.md` deferred hint de-bracketed.
- Execute handoff artifact is the criterion id (never a commit SHA — SHAs
  appear only on the `retain` handoff after `lpwr-commit`).

## [1.0.0] — 2026-09-22

First stable release.

- Alignment passes across the harness: commands end with a canonical `Output:`
  line; skills use one skeleton (H1 + intro + bullets, no `Output:`/`$ARGUMENTS`);
  agents use `## Persona / Permission / Responsibilities / Skills / Limits` with
  true stage claims; templates stripped of persisting instruction prose and
  frontmatter-normalized; plugins share `shared.ts` helpers.
- `lpwr-codebase` removed (sole glossary writer is `lpwr-domain`); orphaned
  `templates/audit.md` and `harness/docs/standards/` deleted; audit shape
  owned by `lpwr-security-scan`.
- Commit gate 2 mechanized (non-retain `log.ndjson` line required);
  `lpwr-specify` added to the journal hook map; security-scan anchors to
  `plugin.directory` with spec-ID path validation.
- Agents renamed off built-in collisions: `build` → `builder`, `plan` →
  `planner`; `shared.ts` carries a no-op default Plugin export for discovery.
- Root `docs/` retired: design history removed; `implementation-rules.md` moved
  to `harness/docs/`; principles essays synthesized into root `PRINCIPLES.md`.
- MIT `LICENSE` added; `package.json` version 1.0.0.

## [0.7.1]

- Waiver tags go inline (`waived:` / `deferred:` single-line values) so they
  no longer scan as pending tasks; empty markers (`none`, `[]`) and the
  legacy list form both validate.
- Lifecycle status unified on `approved` across proposal, spec, and ADR.

## [0.7.0]

- Verdict gate hardened: Verdict section parsed with exactly-one-of
  Ship/Block/Redirect required, placeholder test references rejected,
  threat-review needs a real "Acceptable to proceed" tick, state.md Blocked
  checked on commit/release, post-ship `lpwr-amend` refused (state Done or
  matching commit subject), and a raw `git commit` gated on spec-shaped
  branches under the same checks as `/lpwr-commit`.
- Secret scanning pre-write (pending edit/write content) and on staged
  diffs at commit; obvious fixture values (`test`, `changeme`, `dummy`,
  `placeholder`, `xxx…`) no longer count as secrets; oversized files warn
  instead of skipping silently.
- Plugins anchor all file reads to their own directory (spec-link, scope-guard,
  guard-bootstrap, log-handoffs) and normalize CRLF before frontmatter
  parsing — subdirectory cwd and Windows-authored files no longer bypass gates.
- Handoff lines written from command hooks carry `origin: "hook"` (no
  `command.execute.after` exists to tag completion); release journals its
  spec folder rather than a phantom `review.md` pointer; journal resolution
  prefers an existing spec folder before stripping trailing sequence digits.
- Permissions: scribe gains ask-level bash/webfetch (review git history,
  research primary sources, onboard MCP list — each human-confirmed),
  reviewer gains ask-level bash; conventions document that the matrix only
  enumerates known tools and that Blocked entries are human escalations.
- Review runs against the uncommitted change (`git diff HEAD`), not
  `HEAD~1..HEAD`; template `diff_ref` and the diff-reading skill match.
- Diagnose aligns with implement: repro, hypotheses, fix plan — the patch
  itself runs through `lpwr-implement`, diagnosis grounds `lpwr-propose`
  when no spec fits; teach drafts lessons for a human/scribe to file.
- Guide decision path: missing `state.md` → install first, Blocked surfaced
  early as a human stop, folder-derived resume when nothing is In flight.
- Specs resumes existing `status: draft` files instead of refusing;
  commit requires a non-`retain` log line; foundation files
  (`harness/docs/{constitution,context,state}.md`) gitignored as generated.
- Bootstrap/docs consistency: README plugin count 10 → 11, constitution
  template ships `status: draft`, ADR template drops unused `risk_tier`,
  rules 33–37 moved into `implementation-rules.md` (rule 34 updated to the
  permission-matrix enforcement), v3 guide banner marks its inventories
  historical, setup installs `.opencode/package.json` deps and notes the
  re-run after onboard, check-setup expects `state.md`.

## [0.6.1]

- Improve completeness: full candidate blocks required, no foreign verdicts
  from other domains.
- Tasks journals its specify handoff like every other spec artifact write.
- Scribe confirmations show exact contents with sources and next step;
  onboard resolves contradictions from ground truth instead of punting
  alternatives to the human.
- Stale Phase-5 model TODOs reworded to name the real trigger; propose
  journal step deduplicated.
- Standards placeholders renamed Code Principles / Project Specifics /
  Business Rules, filled by onboard from discovery.
- Pure boilerplate: live constitution/context moved to root, empty state
  dropped; `harness/` ships no prefilled project info.
- Bootstrap gate (`lpwr-guard-bootstrap`) plus `lpwr-install`: install
  materializes from templates, setup prepares, onboard fills.

## [0.6.0]

- Design review checkpoint: risk-gated ADR co-located in the spec folder,
  with specs-side refusal and `lpwr-spec-link` enforcement.
- Explore entry into Specify: observed-basis specs with an accuracy (not
  desirability) approval gate.
- Blocked specs refused via `docs/state.md`, with the tool-hook attribution
  limit documented in conventions.
- Plugin audit pass: amend journaling, blocked-ID boundary fix, standalone
  file notes.
- Case-consistent gates: liberal frontmatter reads, strict lowercase IDs.
- Guides and design docs moved to root `docs/`; repository standards
  (gitkeep coverage, editorconfig, gitattributes, node version).
- Frontmatter values documented across all templates; `audit.md` carries a
  `spec_ref` header.
- Constitution ships `draft` until onboard-approved; onboard re-runs refresh
  without clobbering and treat placeholder content as unapproved.

## [0.5.0]

- Motion narrowed to pin / memory-check / dissent capture — no more
  move/second/scrutiny/vote machinery; proposal template follows the
  motion-step guide (rules 40–42).
- New templates: `improve.md` (per-candidate `lpwr-propose` lines),
  `audit.md` (plugin output shape), `memo.md` (research output shape).
- Agent corrections: research to scribe, teach to plan-only (conversational),
  propose delegates its file write to a scribe subagent.
- Orphan skills and templates wired into commands and agents — nothing
  write-only remains.
- Shared voice persona: `lpwr-voice` skill, protocol line, rule 43.
- Audit findings warn-and-trace to `audit.md` instead of blocking implement.

## [0.4.0]

- Flat `lpwr-*` command set (v3 phases A–D); nested `commands/<domain>/`
  superseded; `lpwr-` prefix on commands, skills, plugins.
- New commands: `lpwr-setup` (Bootstrap), `lpwr-onboard` (Govern front door),
  `lpwr-guide` (read-only next-step helper); `docs/context.md` +
  `templates/context.md`; `docs/stack.md` folded away.
- Security layer: constitution floors, `risk_tier`, always-on secret scan,
  `lpwr-threat-review` for high tier, third review axis, `security-gap`
  bucket; audit gated then made constitution-declared and multi-stack.
- Deferred/waived criteria: frontmatter lists with enforced follow-ups;
  guide, goal, commit, and verdict gate all waiver-aware.
- `lpwr-amend` update path with review voiding and task reconciliation;
  scribe authoring agent (`edit: ask`).
- Naming conventions applied (verb-noun plugins, verdict language, glossary
  terms, dateless lessons); root-relative paths for project-root installs.
- TUI toasts on gate blockages and trap crossings; warning toasts once
  per cycle.
- API integrations: branch-derived spec IDs, `journal_handoff` tool, denial
  audit, setup check, branch-cache invalidation, session-error toasts.
- oxlint + oxfmt via ultracite; `tsc --strict`; root README.

## [0.3.1]

- Least privilege: `task: deny` on leaf subagents (only plan/build
  orchestrate); doc-authoring commands moved to scribe.
- Isolation conventions recorded; exact-once communication rule.

## [0.3.0]

- Deferred/waived criteria system and motion ratification (v1) in Frame.
- `lpwr-amend`, scribe agent, root-relative install paths.
- Case-consistent gates; TUI toasts; API-opportunity plugins; event hooks.
- Version 0.3.0 with 9 plugins.

## [0.2.0]

- Full harness scaffold through phases 0–5 (Govern foundation, Frame +
  Specify, Execute, Verify + Retain, hardening) plus root README.

## [0.1.0]

- Initial harness layout: six domains, traceability IDs, A2A schema,
  templates, permission matrix, five enforcing plugins.
- Naming conventions and implementation-rules gap closure.

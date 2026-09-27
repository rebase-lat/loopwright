# fixes.md — worktree-lifecycle fixing plan (1.4.3 → 1.4.4), closed

Every item below shipped. `lib/worktree.ts`, `plugins/lpwr-worktree-guard.ts`,
`test/worktree.test.ts`, and `test/worktree-integration.test.ts` cite these IDs
(`// fixes.md P0-2 acceptance: …`); this file is what those citations resolve to.

**Provenance:** the working copy was never committed — the same fate as
`analysis.md` and `verification.md` — and was lost after the 1.4.4 release
(flagged by the 1.4.4 review). Reconstructed 2026-09-26 from what did land:
CHANGELOG 1.4.2–1.4.4 (its 1.4.4 entry is this plan, "Verification-derived
fixing plan (P0–P3)"), the shipped code, the fixtures, and the application
session's record. IDs, outcomes, and the three decisions are as they were;
the wording is the reconstruction's.

## Scope and companion documents

Worktree lifecycle only: the gaps a source re-check of the 1.4.2 rework
(`lib/worktree.ts` service + `lpwr-worktree-guard` adapter) left open, in
priority order P0 → P3, Phase 0 first.

Two companion working documents of the same exercise are gone the same way
and are not reconstructed here:

- `analysis.md` §5 — the 17-item audit behind 1.4.2 (workarounds W1–W9,
  drift D1–D7, traps T1–T7); its outcome is CHANGELOG 1.4.2.
- `verification.md` — the 1.4.3 re-check (17 item checks + 6 cross-cutting
  regressions); its outcome is CHANGELOG 1.4.3.

## Phase 0 — premises verified before fixing

- V1 true: the `.env` write failure reached only `logWarn` (the toast arrived
  later, under W5 in 1.4.3).
- V2 true: the `lpwr-commit` event reaches `markPendingCleanup`; the
  `manifest-corrupt` path there is added by P0-1.
- V3 true: `resolveCap` already guards its inputs; *matrix* completeness is
  P3-1.
- Two plan premises false: P0-2's "no pre-check guarantee" — `linkIfMissing`
  already tests `exists(target)` before symlinking — and the
  `lpwr-worktree-status --audit` flag the plan referenced twice: it never
  existed (→ P0-2 ships always-on, decision 3).

## Items

### P0-1 — Corrupt manifests surface, never swallow

- **Problem:** `readManifest` turned a malformed
  `.loop-worktrees/manifest.json` into `{}` — a truncated or hand-edited file
  looked exactly like "nothing pending". The silent-swallow pattern (the W2
  class) in the one file whose loss strands worktrees.
- **Change:** `readManifest` returns `ManifestState { marks, corrupt, error }`
  behind `isManifestShape` — truncated and shape-mismatched files flagged like
  parse failures. A corrupt file is never overwritten: `markPendingCleanup`
  returns `MarkResult` (`marked | already | invalid | manifest-corrupt |
  not-shipped`) and the commit event toasts + logs instead of writing;
  `lpwr-worktree-prune` appends a "manifest unreadable" notice *after* its
  results so a lost-mark run never reads as an unqualified success;
  `statusReport` renders `manifest: unreadable`; `clearPending` and
  `sweepStaleMarks` skip the file.
- **Verification:** unit fixture proves the file is untouched after mark and
  sweep attempts; the integration stub asserts the notice reaches both the
  structured log and the toast; `statusReport` render test.
- **Cited as:** `fixes.md P0-1` in `lib/worktree.ts` (ManifestState, prune
  notices) and `plugins/lpwr-worktree-guard.ts` (commit event).

### P0-2 — Status carries an always-on audit

- **Problem:** foundation link gaps were visible only in the mint-time toast
  (gone within a scroll), and provisioning plus any future report each kept
  its own link list — free to drift apart.
- **Change:** `CapStatus` gains `gaps`, `manifestCorrupt`, `manifestStale`;
  `statusReport` renders them, so one report drives `lpwr-worktree-status`,
  the guide injection, and prune context. `foundationGaps` and `provision`
  share one inventory (`HARNESS_LINK_RELS` + `ROOT_LINK_RELS`) — provisioning
  and the report can never disagree. Always-on, no `--audit` flag (decision 3).
- **Verification:** a `find -type l ! -exec test -e` fixture proves
  provisioning leaves no dangling symlink; a gap line is asserted in
  `statusReport`; the mint-time gap log is asserted.
- **Cited as:** `fixes.md P0-2` in `lib/worktree.ts` (CapStatus, link
  inventory, `linkGap`, `foundationGaps`) and
  `test/worktree-integration.test.ts` (acceptance comment).

### P1-1 — Mint refuses bad IDs

- **Problem:** `worktree_mint` accepted any string that reached it. A shipped
  ID (Done in `state.md`, rule 1) branched from trunk over merged history and
  clobbered it; a leftover branch from an interrupted cleanup failed deep
  inside `git worktree add -b` with git's raw error.
- **Change:** `mint` rejects malformed IDs before any git write, then shipped
  IDs (`stateHasEntry(…, "done", …)`), then leftover branches
  (`git branch --list`) with the named recovery — before the trunk / detached
  HEAD / cap checks. `lpwr-explore` gained the matching validation step before
  it assigns an ID.
- **Adaptation:** the plan's `if (specExists) throw` would break the happy
  path — propose/explore write `docs/specs/<id>/` on trunk *before* minting,
  so a pre-existing folder is the normal state, not a taken signal. The real
  taken signals are state-Done and a leftover branch.
- **Verification:** bad ID and taken ID both refuse with no worktree and no
  branch created; the full-cycle test opens with the malformed-ID refusal.
- **Cited as:** `fixes.md P1-1` in `lib/worktree.ts` (mint).

### P1-2 — Resumable prune with a dry run

- **Problem:** prune had no way to show its plan without executing it, and
  whether a failure part-way through a multi-worktree run left the failing
  worktree's mark behind was undecided.
- **Change:** `worktree_prune` gained `dry_run` — plans only: `would prune` /
  `would skip` lines, no removals, no manifest sweep, no confirmation prompts.
  The driver delegates each entry to `pruneEntry`, so a failure at entry N
  leaves its mark in place and the loop continues to N+1; re-running converges.
- **Verification:** three pending worktrees → `git worktree lock` fails the
  second removal mid-list → report shows pruned / failed / pruned with only
  the failed one's mark kept → unlock → re-run reaches zero residue.
- **Cited as:** `fixes.md P1-2` in `lib/worktree.ts` (`PruneOptions`,
  `pruneEntry`).

### P1-3 — manifest.json documented where it is used

- **Change:** `.loop-worktrees/manifest.json` documented in `lpwr-commit`
  step 10 (with the `lpwr-worktree-status` pointer), `lpwr-worktree-prune`,
  and AGENTS rule 13.
- **Verification:** grep acceptance — all three name the file.

### P2-1 — prune ↔ status cross-references

- **Change:** `lpwr-worktree-prune` names `lpwr-worktree-status` (step 1 and
  `Next:`) and previews `dry_run`; `lpwr-worktree-status` and the cap/gap
  notes name `lpwr-worktree-prune`.

### P2-2 — README worktree-cap paragraph

- **Change:** README documents the resolution order (env > config > default),
  invalid values falling through instead of disabling the cap, and that both
  sources are re-read on every check (rule 29).

### P2-3 — banned-substitute re-grep

- **Change:** re-grep of the harness for glossary-banned terms. Outcome: no
  genuine misuse; every remaining hit is a justified one (the glossary's ban
  cells, Trunk/Open definitions, `lpwr-review`'s git-positional phrasing).
- **Cited as:** `fixes.md P2-3` — settled by decision 2.

### P3-1 — cap resolution matrix

- **Change:** `resolveCap` keeps only a positive-integer env value, else a
  positive-integer config value, else `DEFAULT_CAP`; no NaN/0 reliance in any
  comparison. (1.4.3 had already covered the env fall-through; this item
  completed the matrix.)
- **Verification:** 28 cases — env {unset, "", `abc`, `0`, `-1`, `1`, `10`} ×
  config {unset, `0`, `5` (JSONC with comments and a trailing comma),
  unparsable}.
- **Cited as:** `fixes.md P3-1` in `test/worktree.test.ts`.

### P3-2 — full-lifecycle integration fixture

- **Change:** `test/worktree-integration.test.ts` runs the whole cycle
  against a real temp repo — malformed-ID refusal → mint → foundation gaps +
  zero dangling symlinks → work → squash → mark → stale-audit → prune →
  taken-ID refusal, corrupt manifest, dry run, and resumable-prune stages.
  Carries `analysis.md` §5 item 17 forward into the shipped suite.
- **Cited as:** `fixes.md P3-2` in `test/worktree-integration.test.ts`.

## Decisions taken while applying (human-confirmed)

1. **SPEC_ID unchanged** — the plan's `\d{3}` sequence regex was
   illustrative; `auth-14` stays valid under the current
   `/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/`.
2. **P2-3 "zero hits" means justified hits stay** — ban cells and
   definitional uses are the enforcement surface, not misuse; a literal zero
   would gut the ban list.
3. **Manifest audit always-on in status** — no `--audit` flag (the plan
   referenced one that never existed).

## Release gate and outcome

Gate: every P0/P1/P2 item merged, P3 fixtures green. Result: 1.4.4 shipped
P0–P3 — oxlint 0, `tsc` clean, 35/35 tests — as `8c8d27a`, after the
terminology/voice pass of the same release.

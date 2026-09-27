Based on my analysis of the `loopwright` repository, particularly the worktree implementation in `lpwr-worktree-guard.ts` and its surrounding commands, I've identified several classes of issues: workarounds disguised as fixes, inconsistent terminology, workflow drift, and traps. Below are my findings and a phased fixing plan.

---

## 1. Workarounds Dressed as Fixes

| # | Location | Workaround | Why it's a problem |
|---|----------|-----------|-------------------|
| W1 | `lpwr-worktree-guard.ts` lines 16–17 | `// there is no command.execute.after hook to read a command result from` — the guard hooks `tool.execute.after` on `journal_handoff` to infer when a worktree should be created. | The worktree lifecycle is coupled to a tool's side‑effect rather than an explicit lifecycle event. If the journal tool changes its args or ordering, worktree creation silently breaks. This is a workaround for a missing command‑completion hook. |
| W2 | Lines 63–64 | `catch { // Raced or unsupported FS — lpwr-install/lpwr-setup remain the fallback. }` | Symlink failures are swallowed. The "fallback" (install/setup) is not invoked here; the user is left with a broken worktree until they happen to run another command. |
| W3 | Lines 82 | Empty catch after trying to copy `.opencode/.gitignore`. | The comment says "Trunk has no local .gitignore to copy", but if the file exists and the copy fails for another reason, the error is lost. This masks real filesystem issues. |
| W4 | Lines 92–95 | Manually materializing `docs/memos` on trunk because a "pre‑memos‑foundation install never ran lpwr-install". | This is a patch for missing installation steps. It creates a directory that should have been created by a proper setup command, introducing hidden state. |
| W5 | Lines 101–102 | If `.env` cannot be written, it logs a warning and falls back to branch‑derived spec ID. | The `.env` file is a convenience, not a requirement. The fallback is acceptable, but the warning is buried in `logWarn` and may be missed in headless runs. |
| W6 | Lines 108–109 | If the copied spec folder is empty, it logs a warning and leaves the source in place. | This creates a partial state: the worktree exists but the spec folder is still on trunk. The user must manually reconcile. |
| W7 | Lines 113–114 | `lpwr-commit` cannot remove the worktree its own session is running from; cleanup is deferred to the next `lpwr-propose`. | This is a fundamental limitation being treated as a design choice. It means worktrees accumulate until the next propose, and if that command is never run, they leak. |
| W8 | Lines 135–136 | The cap‑blocked error message is the "sole in‑band recovery path" for a full worktree cap. | Error messages should not be the primary recovery mechanism. The system should provide a command or self‑service path to prune. |
| W9 | Lines 164–170 | Special handling for `log.ndjson` tails: "empirically confirmed" that staged files ride the squash, so they are filtered out. | This is a fragile heuristic based on observed git behavior, not a documented contract. A git update could break it. |

---

## 2. Inconsistent Re‑wording and Terminology

| Term | Inconsistent variants | Impact |
|------|----------------------|--------|
| **Primary branch** | "trunk", "main branch", "main worktree", "trunk session" | Users may not realise "trunk" is just the branch checked out in the main worktree. The code resolves it dynamically but docs sometimes imply a fixed name. |
| **Worktree creation** | "mint", "create", "add", "mint the ID" | "Mint" is used for creating the spec ID and the worktree, but "create" and "add" are also used. The command names (`lpwr-propose`/`lpwr-explore`) "mint" the ID, while the guard "creates" the branch+worktree. |
| **Worktree cleanup** | "prune", "remove", "delete", "close" | `pruneShipped` removes clean worktrees; the cap message says "close one by hand"; the guide says "prune". This variation obscures the fact that they are the same operation. |
| **Worktree state** | "shipped", "Done", "closed", "clean", "dirty" | "Shipped" and "Done" are used interchangeably, but "Done" refers to a `state.md` section while "shipped" is a derived condition. "Clean" and "dirty" are git terms but are not consistently paired with the state check. |
| **Work‑stage commands** | "work‑stage", "work stage", "WORK_STAGE", "workstage" | Minor, but the hyphenation varies across comments and identifiers. |
| **Cap** | "cap", "CAP", "2‑worktree cap" | The constant is `CAP = 2`, but the error says "2‑worktree cap" and the guide says "Cap reached". Consistent casing would help. |
| **Spec ID** | "spec ID", "traceability ID", "spec ID (`-`)" | The placeholder `-` is sometimes shown as `auth-014` and sometimes as `<spec-id>`. |
| **Worktree session** | "worktree session", "worktree's session", "session in the worktree" | The phrase "restart opencode in the worktree session" appears in multiple forms. |

---

## 3. Workflow Drift

| # | Drift | Evidence |
|---|-------|----------|
| D1 | **Worktree lifecycle is scattered across three commands.** | `lpwr-propose`/`lpwr-explore` mint the ID; the guard creates the worktree on `journal_handoff`; `lpwr-commit` defers cleanup; the next `lpwr-propose` prunes. There is no single "worktree lifecycle" module or state machine. |
| D2 | **Cleanup depends on a future command.** | `lpwr-commit` cannot delete its own worktree. The user must remember to run `lpwr-propose` later, or the worktree leaks. The guide warns about this, but it is a workflow trap. |
| D3 | **The cap is a hard block with no self‑service escape.** | When `open >= CAP`, the only ways out are: resume an open session, mark a spec Done in `state.md`, or manually run `git worktree remove`. There is no `lpwr-worktree-prune` command. |
| D4 | **`surfaceOverlap` scans all worktrees but is only triggered by `lpwr-tasks`.** | The overlap check reads every worktree's spec folder, which is O(n) in the number of worktrees and may be slow. It is also advisory‑only (pushes a text part), not a gate. |
| D5 | **`guideStatus` duplicates logic from `pruneShipped` and `capBlocked`.** | The guide independently computes open worktrees, shipped status, and cap notes. If the pruning logic changes, the guide can fall out of sync. |
| D6 | **`mergeBlockingFiles` has a special case for `log.ndjson` that is not documented in the command's contract.** | `lpwr-commit.md` step 6 mentions staging journal tails, but the guard's filter logic (lines 170–182) is the actual enforcement. This is a hidden coupling. |
| D7 | **`provision` creates symlinks for foundation files, but the worktree is expected to have its own copy of `.opencode/.gitignore`.** | The copy of `.gitignore` is a special case that is not covered by the symlink logic. It is easy to miss when adding new foundation files. |

---

## 4. Traps

| # | Trap | Why it bites |
|---|------|-------------|
| T1 | **`mintGate` blocks minting from a worktree session and tells the user to "restart opencode in ${mainHarness}".** | If the user is already in a worktree session, the message says to restart in the main harness, but the actual path is the trunk worktree, not the harness directory inside it. The phrasing is misleading. |
| T2 | **`wrongTree` uses `firstArgument(args)` to extract the spec ID.** | If the command is invoked with flags before the spec ID (e.g. `lpwr-commit --amend auth-014`), `firstArgument` returns `--amend`, which fails the `SPEC_ID` test, and the wrong‑tree check is skipped. |
| T3 | **`mergeBlockingFiles` treats untracked `docs/specs/*/log.ndjson` as non‑blocking only if the state is `??` or ` M` with the tail pattern.** | Any other untracked file in `docs/specs/` will block the merge. This can trap users who have stale phantom journal copies. |
| T4 | **The `CAP` is hardcoded to 2.** | There is no configuration option. In a large project with many parallel specs, 2 may be too low, but the user has no way to raise it without editing the source. |
| T5 | **`pruneShipped` only prunes worktrees whose spec is in the `Done` section of `state.md`.** | If the state file is out of sync (e.g. the human forgot to mark Done), the worktree will never be pruned, and the cap will be hit. |
| T6 | **The `.env` file is written with `OPENCODE_SPEC_ID`, but the guard does not verify that the environment variable is actually loaded.** | The fallback is branch‑derived, so it may work, but the intent is unclear. |
| T7 | **`provision` creates symlinks to `mainHarness/.opencode/node_modules` etc., but if the main harness has no `node_modules`, the link target does not exist and the symlink is skipped.** | This silently leaves the worktree without dependencies, and the user may only discover it when a command fails. |

---

## 5. Fixing Plan

### Phase 1 — Stabilise the Worktree Lifecycle (High Priority)

1. **Introduce a `worktree` service module.**
   - Move all worktree‑related logic (`listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, `ensureWorktree`, `provision`) into a dedicated `lib/worktree.ts`.
   - Expose a small API: `mint(specId)`, `prune(specId)`, `listOpen()`, `capStatus()`.
   - The guard plugin becomes a thin adapter that calls this service from hooks.

2. **Replace the `journal_handoff` hook with an explicit minting command.**
   - Add a dedicated `lpwr-worktree-mint` command (or make `lpwr-propose` call the service explicitly after it has the spec ID).
   - Remove the `tool.execute.after` hook for `journal_handoff`. This eliminates the W1 workaround and makes the flow deterministic.

3. **Add a self‑service prune command.**
   - Introduce `lpwr-worktree-prune` that lists open worktrees and lets the human prune shipped+clean ones, or force‑remove dirty ones after confirmation.
   - Update the cap error message to point to this command instead of manual `git worktree remove`.

4. **Make `CAP` configurable.**
   - Read the cap from `opencode.json` or an environment variable (e.g. `LPWR_MAX_WORKTREES`), defaulting to 2.

### Phase 2 — Eliminate Workarounds

5. **Replace silent catches with structured warnings.**
   - In `provision`, if a symlink fails, log a warning with the target and link path, and record it in the audit log. Do not silently skip.
   - In the `.gitignore` copy, if the file is missing on trunk, log an informational message; if the copy fails, log an error.

6. **Remove the manual `docs/memos` creation.**
   - Move the `docs/memos` creation into `lpwr-install` (or a dedicated `lpwr-setup` step) so that the guard does not have to patch missing state.

7. **Decouple cleanup from the next `lpwr-propose`.**
   - Allow `lpwr-commit` to mark the worktree as "pending cleanup" in a manifest (e.g. `.loop-worktrees/manifest.json`).
   - A separate `lpwr-worktree-gc` command (or the prune command from step 3) can read the manifest and prune without requiring a propose.

8. **Document the `log.ndjson` tail contract.**
   - Add a section to `PRINCIPLES.md` or `implementation-rules.md` that explicitly states which trunk‑dirty files are allowed to ride the squash merge, and why. The guard's filter should reference this rule by number.

### Phase 3 — Unify Terminology

9. **Create a glossary.**
   - Add a `docs/glossary.md` (or extend the existing one) with canonical terms:
     - **Trunk** — the branch checked out in the main worktree; resolved dynamically, never hardcoded.
     - **Worktree** — a linked working tree created for a spec.
     - **Mint** — the act of creating a spec ID and its worktree.
     - **Prune** — the act of removing a shipped and clean worktree.
     - **Shipped** — a spec that has a `Done` entry in `state.md`.
     - **Open** — a worktree that is not the main worktree.
   - Use these terms consistently in all commands, comments, and error messages.

10. **Normalise error and advisory strings.**
    - Replace "close one by hand" with "prune it with `lpwr-worktree-prune`".
    - Replace "restart opencode in ${mainHarness}" with "restart opencode in the trunk worktree (${mainHarness})".
    - Replace "Cap reached" with "Worktree cap reached (max: N)".

### Phase 4 — Fix Traps

11. **Fix `wrongTree` argument parsing.**
    - Use a proper argument parser that skips flags. For example, find the first argument that matches `SPEC_ID`, not just the first token.

12. **Make `mergeBlockingFiles` configurable.**
    - Instead of a hardcoded `TAIL_LOG` regex, allow the command contract to declare which files are tail‑allowed. This can be derived from the spec's `log.ndjson` path.

13. **Ensure `provision` verifies link targets.**
    - Before creating a symlink, check that the target exists. If not, log a warning and record the gap in the TUI sidebar (the same mechanism used for foundation gaps).

14. **Add a `lpwr-worktree-status` command.**
    - Expose the same status that the guide prints, but as a standalone command. This makes the worktree state inspectable without running a full guide.

### Phase 5 — Documentation and Tests

15. **Update `AGENTS.md` and `PRINCIPLES.md`.**
    - Add a "Worktree Lifecycle" section that describes the full flow: mint → work → commit → prune.
    - Document the cap, the prune conditions, and the manual recovery path.

16. **Add unit tests for the worktree service.**
    - Test `listWorktrees`, `findWorktree`, `pruneShipped`, and `capBlocked` with mocked git output.
    - Test the argument parser for `wrongTree`.

17. **Add an integration test for the mint–commit–prune cycle.**
    - Use a temporary git repository to verify that a worktree is created, committed, and pruned without leaving orphans.

---

## Summary

The worktree implementation is functional but carries significant technical debt: it relies on a fragile tool‑hook for creation (W1), silently swallows filesystem failures (W2–W4), and scatters lifecycle logic across commands (D1). The terminology is inconsistent, which makes the workflow harder to reason about, and several traps (T2, T5) can leave users stuck. The fixing plan above addresses these in phases, starting with a stable lifecycle service and moving through workaround removal, terminology unification, trap fixes, and finally documentation and tests.

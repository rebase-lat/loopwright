# Verification
---

## How to verify each fix (and the "fake fix" patterns to watch for)

### Phase 1 — Lifecycle

**F1. `lib/worktree.ts` service module exists and owns all lifecycle logic**
- ✅ Pass: `listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, `ensureWorktree`, `provision` are all in the new module; the guard plugin imports from it and contains no duplicated git parsing.
- ⚠️ Fake fix: a `lib/worktree.ts` is created but the guard still contains a second copy of `listWorktrees` "for convenience". Grep for `git worktree list` in the guard — it should appear **zero** times after the refactor.
- ⚠️ Fake fix: the service exists but `guideStatus` still recomputes cap/overlap locally (D5 not resolved).

**F2. Explicit minting, no `tool.execute.after` hook on `journal_handoff`**
- ✅ Pass: grep for `journal_handoff` in the guard — the worktree creation path should not reference it. A new `lpwr-worktree-mint` command or an explicit call inside `lpwr-propose`/`lpwr-explore` should be the trigger.
- ⚠️ Fake fix: the hook is renamed but still fires on a tool side‑effect. Check what event triggers minting.
- ⚠️ Regression risk: minting now happens *before* the spec folder is written, causing an empty worktree. Verify ordering.

**F3. `lpwr-worktree-prune` command exists and cap error points to it**
- ✅ Pass: the cap error message text contains `lpwr-worktree-prune` (or the equivalent command name), and the command is registered in `opencode.json` / the command directory.
- ⚠️ Fake fix: the command is registered but delegates to `git worktree remove` without the shipped+clean gate — that reintroduces the "leak" trap in reverse (data loss).
- ⚠️ Fake fix: the message says "use the prune command" but the command is not discoverable via `--help`.

**F4. `CAP` is configurable**
- ✅ Pass: `CAP` reads from a config source with a default of 2. Check the schema — is it typed? Is there a validation range?
- ⚠️ Fake fix: env var is read but not documented, or read as a string without `parseInt`/`Number()` guard (so `LPWR_MAX_WORKTREES=abc` silently becomes `NaN` and every comparison is false → cap never blocks, or always blocks).

---

### Phase 2 — Workarounds

**F5. Silent catches replaced with structured warnings**
- ✅ Pass: every `catch {}` in `provision` / `ensureWorktree` logs a warning with the operation, target, and error. Bonus if it's also recorded in the audit log.
- ⚠️ Fake fix: the catch is now `catch (e) { logWarn(String(e)) }` — technically not silent, but loses the target/link path. Look for the actual context in the message.
- ⚠️ Fake fix: warnings are emitted but the function still returns success, so callers can't branch on partial failure.

**F6. `docs/memos` creation moved to install/setup**
- ✅ Pass: grep for `memos` in the guard — if it still appears in `provision`, the workaround is still there. It should only appear in install/setup.
- ⚠️ Fake fix: the directory is created in both places "just in case" — that's still hidden state.

**F7. Cleanup decoupled from next `lpwr-propose`**
- ✅ Pass: a manifest (e.g. `.loop-worktrees/manifest.json`) or equivalent marker records "pending cleanup", and `lpwr-worktree-prune` / `lpwr-worktree-gc` reads it.
- ⚠️ Fake fix: `lpwr-commit` now calls `prune` directly on itself — this reintroduces W7 (you can't remove the worktree your session is in). Verify the commit command does **not** attempt to remove its own worktree.
- ⚠️ Fake fix: manifest is written but nothing reads it → orphans still leak.

**F8. `log.ndjson` tail contract documented**
- ✅ Pass: a numbered rule in `PRINCIPLES.md` or `implementation-rules.md` and a comment in the guard referencing that rule number.
- ⚠️ Fake fix: the regex is now a named constant but the doc doesn't exist — the hidden coupling (D6) remains.

---

### Phase 3 — Terminology

**F9. Glossary exists and is referenced**
- ✅ Pass: `docs/glossary.md` (or equivalent) defines trunk, worktree, mint, prune, shipped, open. Commands link to it.
- ⚠️ Fake fix: glossary exists but error strings still say "close one by hand" / "Cap reached" / "main branch". Grep for those exact strings.

**F10. Normalised strings**
- Run these greps and confirm zero hits (or justified hits):
  - `close one by hand`
  - `Cap reached`
  - `restart opencode in` (followed by a harness path without "trunk worktree")
  - `main branch`, `main worktree` (should be `trunk worktree` or `trunk`)
  - `mint the ID` vs `create the ID` — pick one verb per concept.

---

### Phase 4 — Traps

**F11. `wrongTree` argument parsing**
- ✅ Pass: uses a parser that skips flags; a spec‑id‑shaped token is found even with `--amend` / `-m msg` before it.
- ⚠️ Fake fix: `firstArgument` renamed to `firstSpecLikeArgument` but still returns token[0] if no match — verify the fallback.
- Test case to run manually: `lpwr-commit --amend auth-014` → should still detect the correct worktree.

**F12. `mergeBlockingFiles` configurable**
- ✅ Pass: tail‑allowed files come from the spec's declared journal path, not a hardcoded regex.
- ⚠️ Fake fix: regex moved to a constant at top of file — still hardcoded, still a hidden coupling.

**F13. `provision` verifies link targets**
- ✅ Pass: `fs.existsSync(target)` (or `fs.access`) is checked before `symlink`. Missing targets produce a warning and appear in the sidebar gap list.
- ⚠️ Fake fix: check is done with `try { symlink } catch { warn }` — that still leaves a broken symlink on some filesystems (the symlink may be created pointing to a nonexistent target). You need an explicit pre‑check.

**F14. `lpwr-worktree-status` command exists**
- ✅ Pass: registered, and its output matches the guide's worktree section (ideally by calling the same service function — otherwise D5 reappears).
- ⚠️ Fake fix: the command shells out to `git worktree list` and re‑implements status.

---

### Phase 5 — Docs & Tests

**F15. `AGENTS.md` / `PRINCIPLES.md` updated**
- Look for a "Worktree Lifecycle" section describing: mint → work → commit → prune, the cap, and the manual recovery path.

**F16. Unit tests for the service**
- `listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, and the argument parser. Confirm they mock git output rather than hitting a real repo.

**F17. Integration test for mint–commit–prune**
- Runs against a temp git repo; asserts no orphan worktrees after prune. This is the single best regression guard against W7/D2.

---

## Common cross‑cutting regressions to check when you paste the code

1. **Circular imports** — if `lib/worktree.ts` imports from the guard and the guard imports from the service, you'll get load‑order bugs. Check the dependency direction: service → guard, never the reverse.
2. **Two sources of truth for "shipped"** — `pruneShipped` and `guideStatus` must call the same `isShipped(state)` helper. If either parses `state.md` independently, D5 is back.
3. **Cap read timing** — if `CAP` is read at module load, changing it in `opencode.json` mid‑session won't take effect. Decide and document.
4. **The new prune command's failure mode** — if it fails halfway through a multi‑worktree prune, is it idempotent? Can it resume?
5. **Backwards compatibility** — existing users may have worktrees created by the old hook with no manifest entry. Does `lpwr-worktree-prune` still find them? If not, document a migration.
6. **`.env` fallback** — W5 was a warning buried in `logWarn`. Confirm the new version surfaces it visibly (TUI notice, not just a log line) or removes the fallback entirely.

# Loopwright 1.4.4 Fixing Plan (as written, pre-implementation)

> **Read this before citing an item.** This is the plan as it was written, not
> a record of what shipped. The `P0-1…P3-2` IDs are what the code comments in
> `lib/worktree.ts`, `plugins/lpwr-worktree-guard.ts`, and both worktree tests
> resolve to; the as-built outcomes and the three human decisions taken while
> applying it live in `CHANGELOG.md` 1.4.4. Two details below never shipped as
> written: `lpwr-worktree-status --audit` (see Phase 0 and P0-1/P1-3) never
> existed — the audit shipped always-on in `lpwr-worktree-status`; and P1-1's
> `\d{3}` / `auth-14 is a bad shape` example was decided against — `SPEC_ID`
> stayed `/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/`. The companion review of this
> plan's output is `loopwright-1.4.4-review.md`.

Derived from the v1.4.3 verification pass. Items are ordered by risk: P0 = data-loss/stranding risk, P1 = workflow correctness, P2 = discoverability/docs, P3 = hygiene. Each item includes the exact target, the change, the test, and the acceptance criterion so it can be ticked off without re-litigating scope.

A short **Phase 0** precedes the fixes: three of the P0/P1 items were identified from the changelog and markdown, not from direct code inspection (tool access was limited during the review). Those must be confirmed against the actual source before patching, otherwise the plan is chasing ghosts.

---

## Phase 0 — Verify Before Patching

| # | Claim to confirm | Where to look | If false |
|---|---|---|---|
| V1 | `.env` write failure raises a TUI toast, not just `logWarn` | `lib/worktree.ts` → `provision` / `writeEnv` path | Downgrade to P1 and add the toast as part of item P0-2's pattern |
| V2 | `lpwr-commit` writes the manifest via `command.executed` → `markPendingCleanup` | `lpwr-worktree-guard.ts` event handler + `lib/worktree.ts` | Item P1-3 becomes a real code change, not just docs |
| V3 | `resolveCap` handles `abc`, `0`, `-1`, and unset correctly | `lib/worktree.ts` → `resolveCap` + tests | Item P0-1 expands to cover cap resolution too |

**Deliverable:** a one-line note in the PR description confirming each, with a file:line reference. No code changes in this phase.

---

## P0 — Correctness / Data-Loss Risk

### P0-1. `readManifest` must not silently swallow a malformed manifest

**Problem.** A corrupted or truncated `.loop-worktrees/manifest.json` returns `{}`. Every pending-cleanup mark is lost, so `lpwr-worktree-prune` reports "nothing to prune" and the worktrees leak until the cap is hit. This is the same silent-catch pattern (W2) that 1.4.3 removed elsewhere, reappearing in the one place where losing state is worst.

**Target.** `lib/worktree.ts` → `readManifest`.

**Fix.**
```ts
export function readManifest(root: string): Manifest {
  const file = manifestPath(root);
  if (!existsSync(file)) return { pendingCleanup: {} };
  const raw = readFileSync(file, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!isManifestShape(parsed)) {
      throw new Error("manifest shape mismatch");
    }
    return parsed;
  } catch (err) {
    // Do not lose marks. Surface and continue with an empty manifest
    // so the caller can still enumerate worktrees by git, but tell the human.
    toast({
      level: "warn",
      message:
        "Pending-cleanup manifest could not be read; some shipped worktrees may not be prunable. " +
        "Run `lpwr-worktree-status --audit` to reconcile.",
    });
    logWarn("worktree.manifest.read_failed", { file, error: String(err) });
    return { pendingCleanup: {}, _corrupt: true };
  }
}
```

Add `isManifestShape` as a small type guard. Add a `_corrupt` flag (or a separate return channel) so `worktreePrune` can refuse to claim "clean" when the manifest is unreadable.

**Test.** Fixture: manifest containing `{"pendingCleanup": {` (truncated). Assert: (a) a warning is emitted, (b) `worktreePrune` does not report "nothing pending" silently, (c) the process exits non-zero if invoked with `--strict`.

**Acceptance.** A corrupted manifest produces a visible warning and a non-ambiguous prune result. No path returns an empty manifest without a side-channel signal.

---

### P0-2. `provision` must not leave broken symlinks

**Problem.** From the 1.4.2 audit (T7 / W2). If `provision` creates a symlink to a non-existent target (e.g. `mainHarness/.opencode/node_modules` missing), some filesystems still create the link, and the worktree is broken until a command fails mysteriously. The 1.4.3 changelog claims this was addressed, but the pattern of "try symlink, catch, warn" does not guarantee a pre-check.

**Target.** `lib/worktree.ts` → `provision`.

**Fix.** Pre-check every link target with `fs.existsSync(target)` **before** `symlink`. On miss, append to the same foundation-gap list the sidebar already renders.

```ts
for (const link of FOUNDATION_LINKS) {
  const target = join(mainHarness, link.rel);
  const dst = join(worktree, link.rel);
  if (!existsSync(target)) {
    gaps.push({ rel: link.rel, reason: "missing on trunk" });
    continue; // do not create a dangling symlink
  }
  try { symlinkSync(target, dst); }
  catch (err) { gaps.push({ rel: link.rel, reason: String(err) }); }
}
if (gaps.length) emitFoundationGaps(gaps); // same channel as existing gap UI
```

**Test.** Fixture repo where `mainHarness/.opencode/node_modules` does not exist. Assert: (a) `node_modules` symlink is **not** created in the worktree, (b) a gap entry is emitted, (c) the gap is visible in `lpwr-worktree-status`.

**Acceptance.** `find <worktree> -type l ! -exec test -e {} \; -print` returns empty after provisioning any worktree.

---

## P1 — Workflow Correctness

### P1-1. Validate spec ID in `lpwr-explore` before `worktree_mint`

**Problem.** `lpwr-explore.md` instructs the agent to "assign the traceability ID now" then mint, without a validation gate. If the agent assigns a malformed ID (or an ID that collides with an existing spec), the worktree is created against a bad key, and the wrong-tree checks downstream compare against a value that no longer matches the branch.

**Target.** `lpwr-explore.md` + `lib/worktree.ts` → `worktreeMint` (or the guard's mint handler).

**Fix.** Two layers:

1. **Command layer.** Add an explicit step in `lpwr-explore.md`:
   > Before calling `worktree_mint`, confirm the assigned ID matches `^[a-z][a-z0-9-]*-\d{3}$` and does not already exist in `docs/specs/` or the worktree list. If it does, re-derive from the module name and a fresh counter.

2. **Service layer.** `worktreeMint` validates `SPEC_ID` and rejects collisions with an actionable error:
   ```ts
   if (!SPEC_ID.test(specId)) throw new Error(`invalid spec id: ${specId}`);
   if (await specExists(specId)) throw new Error(`spec id already exists: ${specId}`);
   ```

**Test.** Call `worktreeMint("auth-14")` (bad shape) and `worktreeMint("auth-001")` when that spec exists. Both must throw before any git worktree command runs. Assert no `.git/worktrees/` entry is created.

**Acceptance.** `lpwr-explore` on a module whose derived ID is malformed fails at the command layer with a human-readable message; `worktreeMint` refuses bad IDs at the service layer even when called directly.

---

### P1-2. Make `worktreePrune` idempotent and resumable

**Problem.** From the 1.4.3 audit (item: "New prune command failure mode"). If `worktreePrune` is invoked on N worktrees and fails at the 3rd, the manifest still lists all N. Re-running must not double-remove or skip the un-pruned tail.

**Target.** `lib/worktree.ts` → `worktreePrune` and the manifest writer.

**Fix.**
- Remove the manifest entry **per worktree**, immediately after a successful `git worktree remove`. Do not batch the manifest write at the end.
- If `git worktree remove` fails, keep the entry and continue to the next; collect failures and exit non-zero if any.
- Add `--dry-run` that prints the plan without mutating.

```ts
for (const id of candidates) {
  const res = await removeWorktree(id);
  if (res.ok) deleteManifestEntry(root, id);   // durable per-item
  else failures.push({ id, reason: res.reason });
}
return { failures, removed: candidates.length - failures.length };
```

**Test.** Fixture with 3 pending worktrees; stub `removeWorktree` to fail on the 2nd. Assert: after the call, manifest contains only the 2nd; re-running prunes the 2nd and reports success; no worktree removed twice.

**Acceptance.** A prune interrupted at any index can be re-run and converges to zero pending entries.

---

### P1-3. Document the manifest write in `lpwr-commit.md`

**Problem.** The manifest write is a side-effect of the commit flow. An agent or human reading `lpwr-commit.md` has no reason to know it exists, so debugging "why didn't my worktree prune" starts from a wrong assumption.

**Target.** `lpwr-commit.md`.

**Fix.** Add a short subsection after the Done-landing step:

> **Pending cleanup.** On successful commit, this command records the worktree in `.loop-worktrees/manifest.json` (gitignored) as *pending cleanup*. The next `lpwr-worktree-prune` will offer to remove it. If the file is corrupted or missing, `lpwr-worktree-status --audit` reconciles against git's worktree list.

**Test.** Doc-only; add a link from `lpwr-worktree-prune.md` back to this section.

**Acceptance.** Grep for `manifest.json` in `docs/` returns `lpwr-commit.md`, `lpwr-worktree-prune.md`, and the worktree section of `AGENTS.md`.

---

## P2 — Discoverability

### P2-1. Cross-reference `lpwr-worktree-status` from prune

**Target.** `lpwr-worktree-prune.md` → `Next:` footer and step 1.

**Fix.** In the `Next:` footer, add: "To inspect without pruning, run `lpwr-worktree-status`." In step 1, name the status command explicitly rather than only the underlying `worktree_status` tool call.

**Acceptance.** A reader who lands on the prune command knows the read-only sibling exists within one screen.

---

### P2-2. Surface `LPWR_MAX_WORKTREES` and `lpwr.max_worktrees` in the quickstart

**Target.** `README.md` quickstart section, or a dedicated "Worktree cap" note linked from it.

**Fix.** One paragraph:

> The open-worktree cap defaults to 2. Raise it for the session with `LPWR_MAX_WORKTREES=4`, or persistently in `opencode.json`:
> ```json
> { "lpwr": { "max_worktrees": 4 } }
> ```
> The env var wins; invalid values fall through to config; if both are absent, the default applies.

**Acceptance.** A user hitting the cap message can find the override without opening `PRINCIPLES.md`.

---

### P2-3. Normalise remaining terminology drift

**Target.** Grep across `docs/` and command markdown for the banned variants from the 1.4.2 glossary plan:

- `main branch`, `main worktree` → `trunk`
- `Cap reached` → `Worktree cap reached (max: N)`
- `close one by hand` → `prune with lpwr-worktree-prune`
- `mint the ID` / `create the ID` → pick **mint** for ID, **create** for worktree

**Acceptance.** Grep returns zero hits for the banned strings. Add a `docs/glossary.md` if not present, defining trunk / worktree / mint / prune / shipped / open.

---

## P3 — Hygiene

### P3-1. Confirm test coverage for the invalid-cap matrix

**Target.** `lib/worktree.test.ts` (or equivalent).

**Fix.** Ensure the fixture set covers `LPWR_MAX_WORKTREES` ∈ {unset, `""`, `"abc"`, `"0"`, `"-1"`, `"1"`, `"10"`} × {config unset, config `0`, config `5`}. Expected: only positive integers win; everything else falls through per `resolveCap`'s documented precedence.

**Acceptance.** The matrix is a single `describe.each` with explicit expected outputs; no case relies on `NaN` coercion.

---

### P3-2. Add a mint→commit→prune integration test

**Target.** `test/integration/worktree-lifecycle.test.ts`.

**Fix.** Against a temp git repo:
1. `worktreeMint("auth-001")` → assert worktree exists, `.env` written, foundation links present (or gaps recorded).
2. `markPendingCleanup("auth-001")` → assert manifest entry.
3. `worktreePrune()` → assert worktree removed, manifest entry gone, no orphan in `git worktree list`.

**Acceptance.** The test runs in CI and fails if any of the three stages leaves residue.

---

## Sequencing and Estimated Effort

| Order | Item | Effort | Blocking |
|---|---|---|---|
| 1 | Phase 0 verification (V1–V3) | S | all P0 |
| 2 | P0-1 malformed manifest | S | — |
| 3 | P0-2 broken symlinks | S | — |
| 4 | P1-1 explore ID validation | S | — |
| 5 | P1-2 prune idempotency | M | — |
| 6 | P1-3 commit docs | XS | — |
| 7 | P2-1…P2-3 discoverability + terms | S | — |
| 8 | P3-1 cap matrix | S | — |
| 9 | P3-2 integration test | M | after P1-2 |

**Release gate for 1.4.4:** all P0 and P1 merged; P2 merged; P3-1 and P3-2 green in CI. Nothing in this plan changes a public command name, so 1.4.4 is a drop-in patch.

---

## Summary

The plan closes the one genuine data-loss risk introduced in 1.4.3 (`readManifest` swallowing corruption), hardens provisioning against dangling symlinks, adds the missing validation gate to `lpwr-explore`, makes prune resumable, and finishes the terminology and discoverability work that 1.4.3 started. Phase 0 exists because three of the findings were inferred from the changelog rather than the source — confirm those first, and the rest of the plan can proceed without rework.

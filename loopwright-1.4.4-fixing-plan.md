# Loopwright 1.4.4 — Fixing Plan

Verified empirically, not just read: dependencies installed, `npm run typecheck` (clean),
`npm run lint` (0 warnings/errors, 26 files), `npm test` (35/35 passing). The worktree lifecycle
rework in 1.4.2–1.4.4 is solid on its own technical merits. What follows are the gaps that survive
that — two carried over untouched from the last review, and one new to this pass.

---

## 1. Carried over, still open: `docs/glossary.md` excluded from `FOUNDATION`

**Where:** `harness/.opencode/lib/worktree.ts:728` — `FOUNDATION = ["state", "context",
"constitution", "audit"]`

This array physically moved during the 1.4.2 rework (`lpwr-worktree-guard.ts` → the new
`worktree.ts` service) but its membership didn't change. Flagged last time as a mitigation
(a clearer error message when it goes wrong) standing in for a fix (the worktree still can't see
glossary edits at all). The rework touched this exact array and every other foundation-visibility
concern around it (P0-2's "always-on audit," the dangling-symlink fixture) without anyone
revisiting whether glossary belongs in it — worth a five-minute look now that the surrounding
code is fresh in mind, one way or the other.

## 2. Carried over, still open: `builder.md` still claims Verify

**Where:** `harness/.opencode/agents/builder.md:2` — unchanged: "Write-isolated builder for
Bootstrap, Execute, Verify, and Retain."

`scribe.md` independently and correctly claims Verify's writes, and the permission matrix backs
that up (`scribe`: `edit: ask`, matching "every write needs human confirmation" — the right tier
for `review.md`; `builder`: `edit: allow`, the wrong tier for the same job). Untouched by the
1.4.2–1.4.4 work, which was scoped to worktree lifecycle rather than agent personas — reasonable
that it wasn't in scope, but it's a trivial fix whenever someone's next in that file.

## 3. New this pass: `fixes.md` is cited four times, exists nowhere

**Where:** `harness/.opencode/lib/worktree.ts`, `harness/.opencode/plugins/lpwr-worktree-guard.ts`,
`test/worktree.test.ts`, `test/worktree-integration.test.ts` — all reference specific items by
name: `fixes.md P0-1`, `P0-2`, `P1-1`, `P1-2`, `P3-1`, etc. The changelog for 1.4.2–1.4.4
describes this as a genuine, substantial audit (W1–W9 workarounds, D1–D7 drift, T1–T7 traps,
17 items total) that drove real, verified fixes — the same kind of exercise as the plan I wrote
last round. But the document itself was never committed to the repository.

This matters because `integration-analysis.md` — the project's own established audit trail,
carefully maintained through six rounds — stops at Round 6 (post-1.4.0). The actual work that
produced 1.4.2 through 1.4.4 happened entirely outside that record, in a document that's now
gone. Anyone reading `worktree.ts` six months from now and hitting a comment like `// fixes.md
P0-2 acceptance: every symlink in the worktree resolves` has no way to find out what P0-2 was, why
it mattered, or what else was in the same plan. The fix landed; the reasoning behind it didn't.

**Fix:** either commit `fixes.md` to the repo (even as a closed/historical record, the way
`integration-analysis.md` keeps its Round 5 table "as-found" rather than deleting it), or fold its
content into `integration-analysis.md` as the Round 7 entry that's currently missing. Either way,
the four dangling citations should point at something a reader can actually open.

---

## What I checked and didn't flag

- **The symlink write-through concern from last round** is not directly round-trip tested by
  name, but the new integration test does verify something adjacent and real — no dangling
  symlinks survive provisioning, checked via a `find`-based fixture against a live temp repo. The
  changelog states this premise was reviewed and judged already sound (Node's `fs.writeFile`
  following symlinks is standard platform behavior, not project-specific risk). That's a
  defensible call, not a dodge — I'm downgrading this from "open" to "reasonably settled."
- **The custom tools (`worktree_mint`, `worktree_prune`, `worktree_status`)** aren't named
  anywhere in `opencode.json`'s permission matrix, which looked suspicious at first — but the
  orchestrator's `edit`/`bash`/`webfetch` are all `deny` while these clearly work (35 passing
  tests exercise them), so they're evidently registered as first-class tool calls outside the
  file-edit/shell permission surface, the same way `journal_handoff` and `question` already work.
  Not a bug.
- **PRINCIPLES.md's new "Worktree lifecycle" section** — read it against the actual command
  names and behavior in `worktree.ts`. Consistent throughout: mint/work/commit/prune, the cap
  resolution order, the "session never prunes its own worktree" rule. No drift found.

---

## Priority

Items 1 and 2 are each a few minutes of work whenever someone's next in those files — neither is
urgent, both have been sitting for one review cycle already. Item 3 is worth doing before the next
round of fixes happens the same way — otherwise this pattern repeats: real work, real verification,
and a growing pile of comments citing a document nobody committed.

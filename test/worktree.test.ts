import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseWorktreeList,
  specIdArgument,
} from "../harness/.opencode/lib/shared.ts";
import type {
  CapStatus,
  OpenWorktree,
  WorktreeInfo,
} from "../harness/.opencode/lib/worktree.ts";
import {
  DEFAULT_CAP,
  TAIL_ALLOWED,
  capBlocked,
  findWorktree,
  markPendingCleanup,
  mergeBlockingFiles,
  pruneDecision,
  readManifest,
  resolveCap,
  specIdOfWorktree,
  stateHasEntry,
  statusReport,
} from "../harness/.opencode/lib/worktree.ts";

// Round 6 D1/Phase 5 (analysis §5 items 16): the worktree service's decision
// logic runs against fixtures — mocked `git worktree list --porcelain` output,
// temp state.md/manifest files, and env/config cap inputs — so a regression
// fails a named fixture instead of a live session.

const temps: string[] = [];
const tempDir = (label: string): string => {
  const dir = mkdtempSync(path.join(tmpdir(), `lpwr-wt-${label}-`));
  temps.push(dir);
  return dir;
};

test.after(() => {
  for (const dir of temps) {
    rmSync(dir, { force: true, recursive: true });
  }
});

const PORCELAIN = [
  "worktree /repo",
  "HEAD 1111111",
  "branch refs/heads/main",
  "",
  "worktree /repo/auth-014",
  "HEAD 2222222",
  "branch refs/heads/auth-014",
  "",
  "worktree /repo/auth-020",
  "HEAD 3333333",
  "branch refs/heads/feature/plain",
  "",
  "worktree /repo/detached",
  "HEAD 4444444",
  "detached",
  "",
  "worktree /bare.git",
  "bare",
  "",
].join("\n");

test("listWorktrees: parses porcelain output, skips bare/malformed", () => {
  const parsed = parseWorktreeList(PORCELAIN);
  assert.deepEqual(
    parsed.map((wt) => wt.path),
    ["/repo", "/repo/auth-014", "/repo/auth-020", "/repo/detached"]
  );
  assert.deepEqual(
    parsed.map((wt) => wt.branch),
    ["main", "auth-014", "feature/plain", null]
  );
  // Chunk without a worktree line is dropped, not thrown on.
  assert.deepEqual(parseWorktreeList("bare\ngitdir: /somewhere"), []);
  assert.deepEqual(parseWorktreeList(""), []);
});

test("findWorktree: by branch, by directory name, or not at all", () => {
  const parsed = parseWorktreeList(PORCELAIN);
  assert.equal(findWorktree(parsed, "auth-014")?.path, "/repo/auth-014");
  // Non-spec branch falls back to the directory name (rule 2 shape).
  assert.equal(findWorktree(parsed, "auth-020")?.path, "/repo/auth-020");
  assert.equal(findWorktree(parsed, "auth-099"), null);
  assert.equal(specIdOfWorktree(parsed[0] as WorktreeInfo), null);
  assert.equal(specIdOfWorktree(parsed[1] as WorktreeInfo), "auth-014");
  assert.equal(specIdOfWorktree(parsed[2] as WorktreeInfo), "auth-020");
});

const entry = (over: Partial<OpenWorktree> = {}): OpenWorktree => ({
  branch: "auth-014",
  dirty: false,
  id: "auth-014",
  own: false,
  path: "/repo/auth-014",
  pending: false,
  shipped: false,
  ...over,
});

test("pruneShipped decisions: eligible, force, own, and dirty paths", () => {
  // Shipped + clean closes without confirmation (the propose-time prune).
  assert.deepEqual(pruneDecision(entry({ shipped: true })), {
    action: "remove",
    reason: "shipped",
  });
  // Pending cleanup alone is enough once lpwr-commit marked it.
  assert.equal(pruneDecision(entry({ pending: true })).action, "remove");
  // In-flight and unmarked never closes on its own.
  const ineligible = pruneDecision(entry());
  assert.equal(ineligible.action, "skip");
  assert.match(ineligible.reason, /force after confirmation/u);
  // Dirty shipped needs force (analysis W2/T5 class).
  const dirty = pruneDecision(entry({ dirty: true, shipped: true }));
  assert.equal(dirty.action, "skip");
  assert.equal(dirty.needsForce, true);
  // Force overrides eligibility and dirt; the confirmation gate lives in prune.
  assert.equal(
    pruneDecision(entry({ dirty: true }), { force: true }).action,
    "remove"
  );
  // A session never prunes the worktree it runs from — not even with force.
  assert.equal(
    pruneDecision(entry({ own: true }), { force: true }).action,
    "skip"
  );
  // Shipped + pending reads as both.
  assert.equal(
    pruneDecision(entry({ pending: true, shipped: true })).reason,
    "shipped + pending cleanup"
  );
});

test("capBlocked names the prune command, not manual git surgery", () => {
  const message = capBlocked(2, 2);
  assert.match(message, /2 worktrees already open \(cap 2, rule 29\)/u);
  assert.match(message, /lpwr-worktree-prune/u);
  assert.match(message, /docs\/state\.md/u);
  // The in-band recovery path must not be `git worktree remove` (item 3).
  assert.doesNotMatch(message, /git worktree remove/u);
});

test("statusReport: listing, cap wording, and prunable vs stuck", () => {
  const base: CapStatus = {
    atCap: true,
    cap: DEFAULT_CAP,
    entries: [
      entry({ dirty: false, shipped: true }),
      entry({ branch: "auth-015", id: "auth-015", path: "/repo/auth-015" }),
    ],
    open: 2,
  };
  const open = statusReport(base);
  assert.match(open, /^Worktree status: 2\/2 open — /u);
  assert.match(open, /auth-014 — shipped, clean, prunable/u);
  assert.match(open, /auth-015 — in flight, clean/u);
  assert.match(open, /Worktree cap reached \(max: 2\)/u);
  assert.match(open, /lpwr-worktree-prune/u);

  // Nothing prunable: the note must point at resuming or marking Done, not
  // pretend the prune will help.
  const stuck = statusReport({
    ...base,
    entries: [entry({ dirty: true })],
    open: 1,
  });
  assert.match(stuck, /1\/2 open/u);
  assert.match(stuck, /none are prunable/u);

  const idle = statusReport({
    atCap: false,
    cap: DEFAULT_CAP,
    entries: [],
    open: 0,
  });
  assert.equal(idle, "Worktree status: 0/2 open.");
});

test("resolveCap: default, opencode.json lpwr.max_worktrees, env override", async () => {
  const dir = tempDir("cap");
  assert.equal(await resolveCap(dir), DEFAULT_CAP);

  // JSONC: comments, trailing commas, and a `//` inside a URL string must
  // all survive parsing (harness opencode.json carries comments).
  writeFileSync(
    path.join(dir, "opencode.json"),
    [
      "{",
      '  // raise the cap for this project',
      '  "$schema": "https://opencode.ai/config.json",',
      '  "lpwr": { "max_worktrees": 5, },',
      "}",
    ].join("\n")
  );
  assert.equal(await resolveCap(dir), 5);

  const previous = process.env.LPWR_MAX_WORKTREES;
  const restoreEnv = () => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "LPWR_MAX_WORKTREES");
    } else {
      process.env.LPWR_MAX_WORKTREES = previous;
    }
  };
  process.env.LPWR_MAX_WORKTREES = "3";
  try {
    assert.equal(await resolveCap(dir), 3, "env wins over config");
    // Malformed or non-positive values must fall through to the config value,
    // never become NaN/0 and silently disable the cap in either direction.
    process.env.LPWR_MAX_WORKTREES = "abc";
    assert.equal(
      await resolveCap(dir),
      5,
      "invalid env falls through to config"
    );
    process.env.LPWR_MAX_WORKTREES = "0";
    assert.equal(await resolveCap(dir), 5, "zero env falls through to config");
  } finally {
    restoreEnv();
  }

  // Unreadable config falls back to the default, never throws.
  writeFileSync(path.join(dir, "opencode.json"), "{ not json");
  assert.equal(await resolveCap(dir), DEFAULT_CAP);
});

test("stateHasEntry: Done section membership, case-insensitive", async () => {
  const harness = tempDir("state");
  mkdirSync(path.join(harness, "docs"), { recursive: true });
  writeFileSync(
    path.join(harness, "docs/state.md"),
    "# State\n\n## Done\n- auth-014: shipped 2026-09-26\n\n## Next\n- auth-015: later\n"
  );
  assert.equal(await stateHasEntry(harness, "done", "auth-014"), true);
  assert.equal(await stateHasEntry(harness, "done", "auth-015"), false);
  assert.equal(await stateHasEntry(harness, "next", "auth-015"), true);
  assert.equal(await stateHasEntry(harness, "done", "auth-099"), false);
  assert.equal(
    await stateHasEntry(tempDir("state-missing"), "done", "auth-014"),
    false
  );
});

test("markPendingCleanup: only after Done, idempotent, manifest round-trips", async () => {
  const harness = tempDir("manifest");
  mkdirSync(path.join(harness, "docs"), { recursive: true });

  // Not Done yet — a failed commit must not mark its worktree closable.
  assert.equal(await markPendingCleanup(harness, "auth-014"), false);
  assert.deepEqual(await readManifest(harness), {});

  writeFileSync(
    path.join(harness, "docs/state.md"),
    "## Done\n- auth-014: shipped\n"
  );
  assert.equal(await markPendingCleanup(harness, "auth-014"), true);
  const pending = await readManifest(harness);
  assert.ok(pending["auth-014"], "manifest records the mark");
  // Second mark is a no-op, not a duplicate write.
  assert.equal(await markPendingCleanup(harness, "auth-014"), false);
  // Invalid IDs never mark.
  assert.equal(await markPendingCleanup(harness, "../etc"), false);

  // Corrupt manifest degrades to empty, never throws.
  writeFileSync(path.join(harness, ".loop-worktrees/manifest.json"), "{ nope");
  assert.deepEqual(await readManifest(harness), {});
});

test("mergeBlockingFiles: rule-51 tails ride, everything else blocks", () => {
  const status = [
    " M docs/specs/auth-014/log.ndjson",
    "M  docs/specs/auth-015/log.ndjson",
    "?? docs/specs/auth-014/log.ndjson",
    " M src/auth/login.ts",
    "?? scratch.tmp",
    "",
  ].join("\n");
  assert.deepEqual(mergeBlockingFiles(status, ""), [
    "?? docs/specs/auth-014/log.ndjson",
    " M src/auth/login.ts",
    "?? scratch.tmp",
  ]);
  // Nested harness: the prefix is stripped before matching (Round 5 S5-01).
  assert.deepEqual(
    mergeBlockingFiles(" M harness/docs/specs/auth-014/log.ndjson", "harness"),
    []
  );
  // The allowance set is data, not a hardcoded regex (item 12): swap it and
  // the same tail blocks while the custom pattern rides.
  const custom = [{ note: "fixture", pattern: /^notes\.md$/u }];
  assert.deepEqual(mergeBlockingFiles(" M notes.md", "", custom), []);
  assert.deepEqual(
    mergeBlockingFiles(" M docs/specs/auth-014/log.ndjson", "", custom),
    [" M docs/specs/auth-014/log.ndjson"]
  );
  assert.equal(TAIL_ALLOWED.length, 1);
});

test("specIdArgument: skips flags, finds the first traceability ID", () => {
  assert.equal(specIdArgument("auth-014"), "auth-014");
  assert.equal(specIdArgument("--amend auth-014"), "auth-014");
  assert.equal(specIdArgument("auth-014 --amend"), "auth-014");
  assert.equal(specIdArgument("  --force  auth-014  "), "auth-014");
  assert.equal(specIdArgument("--amend --force"), undefined);
  assert.equal(specIdArgument(""), undefined);
  // A flag-shaped token is never mistaken for an ID.
  assert.equal(specIdArgument("-auth-014"), undefined);
  // `firstArgument` would have returned `--amend` here (T2).
  assert.notEqual(specIdArgument("--amend auth-014"), "--amend");
});

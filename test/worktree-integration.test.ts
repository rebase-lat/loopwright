import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createWorktreeService,
  harnessDirs,
  markPendingCleanup,
  readManifest,
} from "../harness/.opencode/lib/worktree.ts";

// Phase 5 (analysis §5 item 17): the full mint → work → commit → prune cycle
// against a real temporary git repository, so the service's git invocations,
// symlink provisioning, manifest bookkeeping, and orphan-freedom are proven
// end to end, not just unit-pure.

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();

const gitOk = (cwd: string, ...args: string[]): boolean =>
  spawnSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).status === 0;

// The plugin type comes from the harness' own @opencode-ai/plugin copy —
// derive it from the factory so the root/harness duplicates never mix.
type ServicePlugin = Parameters<typeof createWorktreeService>[0];

const pluginStub = (directory: string): ServicePlugin =>
  ({
    client: {
      app: { log: () => Promise.resolve() },
      tui: { showToast: () => Promise.resolve() },
    },
    directory,
  }) as unknown as ServicePlugin;

const STATE = `# State

## Done

## In flight

## Blocked

## Next
`;

const STATE_DONE_001 = `# State

## Done
- auth-001: shipped

## In flight

## Blocked

## Next
`;

// Flat layout (harness at the project root): worktrees land as siblings of
// the repo, inside this fixture's base dir so cleanup takes them with it.
const makeRepo = (): { base: string; root: string } => {
  const base = mkdtempSync(path.join(tmpdir(), "lpwr-cycle-"));
  const root = path.join(base, "repo");
  mkdirSync(root, { recursive: true });
  git(root, "init", "-q");
  git(root, "config", "user.email", "lpwr@test.local");
  git(root, "config", "user.name", "lpwr");
  // Same ignore contract as harness/.gitignore: foundation + memos + .env +
  // the pending-cleanup manifest are trunk-owned and never diffed.
  writeFileSync(
    path.join(root, ".gitignore"),
    [
      "docs/constitution.md",
      "docs/context.md",
      "docs/state.md",
      "docs/audit.md",
      "docs/memos",
      ".env",
      "node_modules/",
      ".loop-worktrees/",
      "",
    ].join("\n")
  );
  mkdirSync(path.join(root, ".opencode"), { recursive: true });
  writeFileSync(path.join(root, ".opencode/.gitignore"), "node_modules\n");
  mkdirSync(path.join(root, "docs/memos"), { recursive: true });
  for (const file of ["constitution", "context", "audit"]) {
    writeFileSync(path.join(root, `docs/${file}.md`), `# ${file}\n`);
  }
  writeFileSync(path.join(root, "docs/state.md"), STATE);
  writeFileSync(path.join(root, "opencode.json"), "{}\n");
  writeFileSync(path.join(root, "AGENTS.md"), "# protocol\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  return { base, root };
};

const worktreeRootOf = (base: string, specId: string): string =>
  path.join(base, specId);

const worktreeCount = (root: string): number =>
  git(root, "worktree", "list", "--porcelain")
    .split("\n")
    .filter((line) => line.startsWith("worktree ")).length;

test("mint → work → commit → prune cycle leaves no orphans", async () => {
  const { base, root } = makeRepo();
  try {
    const service = createWorktreeService(pluginStub(root), root);
    const wt = worktreeRootOf(base, "auth-001");

    // Proposal written on trunk, untracked — the state lpwr-propose leaves.
    mkdirSync(path.join(root, "docs/specs/auth-001"), { recursive: true });
    writeFileSync(path.join(root, "docs/specs/auth-001/proposal.md"), "# p\n");

    const created = await service.mint("auth-001");
    assert.equal(created, wt, "mint returns the harness dir to restart in");
    assert.ok(existsSync(path.join(wt, "docs/specs/auth-001/proposal.md")), "spec folder moved");
    assert.ok(!existsSync(path.join(root, "docs/specs/auth-001")), "trunk keeps no copy");
    assert.ok(gitOk(root, "show-ref", "--verify", "--quiet", "refs/heads/auth-001"), "branch created");
    assert.ok(lstatSync(path.join(wt, "docs/state.md")).isSymbolicLink(), "state.md linked");
    assert.ok(lstatSync(path.join(wt, "docs/memos")).isSymbolicLink(), "memos linked");
    assert.match(
      readFileSync(path.join(wt, ".env"), "utf-8"),
      /OPENCODE_SPEC_ID=auth-001/u
    );
    assert.equal(git(root, "status", "--porcelain"), "", "trunk clean after mint");
    // Idempotent: a second mint is a no-op, not a second worktree.
    assert.equal(await service.mint("auth-001"), "");

    const open = await service.listOpen();
    assert.equal(open.length, 1);
    assert.equal(open[0]?.id, "auth-001");
    assert.equal(open[0]?.shipped, false);
    assert.equal(open[0]?.pending, false);
    assert.equal(open[0]?.own, false);

    // Order is deterministic: trunk's harness first, then each open worktree.
    assert.deepEqual(
      await harnessDirs(root),
      [root, wt],
      "rule-50 scan spans trunk and the worktree"
    );

    // Work in the worktree session, then the lpwr-commit squash (step 6).
    writeFileSync(path.join(wt, "docs/specs/auth-001/spec.md"), "status: approved\n");
    git(wt, "add", "-A");
    git(wt, "commit", "-q", "-m", "auth-001: work");
    git(root, "merge", "--squash", "auth-001");
    git(root, "commit", "-q", "-m", "auth-001: squash");
    assert.equal(git(root, "status", "--porcelain"), "", "trunk clean after squash");
    assert.ok(existsSync(path.join(root, "docs/specs/auth-001/spec.md")));

    // state.md Done (commit step 8), then the pending-cleanup mark (rule 52).
    writeFileSync(path.join(root, "docs/state.md"), STATE_DONE_001);
    assert.equal(await markPendingCleanup(root, "auth-001"), true);
    const marked = await readManifest(root);
    assert.ok(marked["auth-001"], "manifest marked");
    assert.equal(git(root, "status", "--porcelain"), "", "manifest gitignored");

    // Prune closes worktree + branch and clears the mark.
    const report = await service.prune("auth-001");
    assert.match(report, /pruned auth-001 \(shipped \+ pending cleanup\)/u);
    assert.ok(!existsSync(wt), "worktree dir removed");
    assert.ok(!gitOk(root, "show-ref", "--verify", "--quiet", "refs/heads/auth-001"), "branch removed");
    assert.deepEqual(await service.listOpen(), []);
    assert.deepEqual(await readManifest(root), {}, "mark cleared");
    assert.equal(worktreeCount(root), 1, "only the main worktree remains");
  } finally {
    rmSync(base, { force: true, recursive: true });
  }
});

test("cap blocks at the max; force prune needs confirmation; own worktree never prunes", async () => {
  const { base, root } = makeRepo();
  const previous = process.env.LPWR_MAX_WORKTREES;
  try {
    const service = createWorktreeService(pluginStub(root), root);
    await service.mint("auth-001");
    await service.mint("auth-002");

    // Default cap 2 (rule 29): the third mint is blocked in-band, naming
    // the self-service recovery rather than manual git surgery.
    await assert.rejects(() => service.mint("auth-003"), /lpwr-worktree-prune/u);

    // Env override raises it without touching code.
    process.env.LPWR_MAX_WORKTREES = "3";
    const third = await service.mint("auth-003");
    assert.ok(third.endsWith("auth-003"));

    // Nothing is shipped or pending — a bare prune closes nothing.
    const idle = await service.prune();
    assert.match(idle, /skipped auth-001: neither shipped/u);
    assert.equal(worktreeCount(root), 4, "all three spec worktrees remain");

    // Force without confirmation refuses to touch the worktree.
    const declined = await service.prune("auth-001", {
      confirm: () => Promise.resolve(false),
      force: true,
    });
    assert.match(declined, /force-removal not confirmed/u);
    assert.ok(existsSync(worktreeRootOf(base, "auth-001")));

    // Force + confirmation removes a dirty worktree (proposal still untracked).
    writeFileSync(path.join(worktreeRootOf(base, "auth-001"), "scratch.txt"), "x\n");
    const removed = await service.prune("auth-001", {
      confirm: () => Promise.resolve(true),
      force: true,
    });
    assert.match(removed, /pruned auth-001 \(force \(human-confirmed\)\)/u);
    assert.ok(!existsSync(worktreeRootOf(base, "auth-001")));
    assert.ok(!gitOk(root, "show-ref", "--verify", "--quiet", "refs/heads/auth-001"));

    // A session inside auth-002 never prunes its own worktree — not even
    // with force (W7 stays a hard invariant).
    const wt2 = worktreeRootOf(base, "auth-002");
    const inSession = createWorktreeService(pluginStub(wt2), wt2);
    const own = await inSession.prune("auth-002", {
      confirm: () => Promise.resolve(true),
      force: true,
    });
    assert.match(own, /skipped auth-002: this session runs from it/u);
    assert.ok(existsSync(wt2));
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "LPWR_MAX_WORKTREES");
    } else {
      process.env.LPWR_MAX_WORKTREES = previous;
    }
    rmSync(base, { force: true, recursive: true });
  }
});

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
  statusReport,
} from "../harness/.opencode/lib/worktree.ts";

// The full mint → work → commit → prune cycle against a real temporary git
// repository (analysis §5 item 17 / fixes.md P3-2), extended with the 1.4.4
// stages: foundation-gap visibility and zero dangling symlinks (P0-2),
// invalid/taken-ID refusals (P1-1), corrupt-manifest honesty (P0-1), and a
// resumable prune that converges after a mid-list failure (P1-2).

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();

const gitOk = (cwd: string, ...args: string[]): boolean =>
  spawnSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).status === 0;

// The plugin type comes from the harness' own @opencode-ai/plugin copy —
// derive it from the factory so the root/harness duplicates never mix.
type ServicePlugin = Parameters<typeof createWorktreeService>[0];

// Recording stub: structured logs and toasts are captured so fixtures can
// assert that warnings actually reach the human-facing channels (P0-1/P0-2).
interface PluginStub {
  logs: string[];
  plugin: ServicePlugin;
  toasts: string[];
}

const pluginStub = (directory: string): PluginStub => {
  const logs: string[] = [];
  const toasts: string[] = [];
  const plugin = {
    client: {
      app: {
        log: (input: { body: { level: string; message: string } }) => {
          logs.push(`${input.body.level}: ${input.body.message}`);
          return Promise.resolve();
        },
      },
      tui: {
        showToast: (input: { body: { message: string } }) => {
          toasts.push(input.body.message);
          return Promise.resolve();
        },
      },
    },
    directory,
  } as unknown as ServicePlugin;
  return { logs, plugin, toasts };
};

const STATE = `# State

## Done

## In flight

## Blocked

## Next
`;

const stateDone = (...ids: string[]): string =>
  `# State\n\n## Done\n${ids
    .map((id) => `- ${id}: shipped\n`)
    .join("")}\n## In flight\n\n## Blocked\n\n## Next\n`;

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

// fixes.md P0-2 acceptance: every symlink in the worktree resolves.
const danglingLinks = (target: string): string =>
  spawnSync(
    "find",
    [target, "-type", "l", "!", "-exec", "test", "-e", "{}", ";", "-print"],
    { encoding: "utf-8" }
  ).stdout.trim();

test("mint → work → commit → prune cycle leaves no orphans", async () => {
  const { base, root } = makeRepo();
  try {
    const stub = pluginStub(root);
    const service = createWorktreeService(stub.plugin, root);
    const wt = worktreeRootOf(base, "auth-001");

    // P1-1: a malformed ID refuses before any git write.
    await assert.rejects(
      () => service.mint("NOT AN ID"),
      /not a traceability ID/u
    );
    assert.equal(worktreeCount(root), 1, "bad ID creates no worktree");

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

    // P0-2: no dangling symlinks after provisioning (fixture has no
    // node_modules / .opencode package files — targets are simply absent,
    // so no link may exist pointing at them), and the gaps are visible in
    // the status the same way the guide and lpwr-worktree-status render it.
    assert.equal(danglingLinks(wt), "", "no dangling symlinks after provisioning");
    assert.ok(
      !existsSync(path.join(wt, ".opencode/node_modules")),
      "missing target never becomes a link"
    );
    const status = await service.capStatus();
    assert.ok(
      status.gaps.some((gap) =>
        gap.startsWith("auth-001 .opencode/node_modules")
      ),
      "gap listed in capStatus"
    );
    assert.match(
      statusReport(status),
      /foundation gaps: auth-001 \.opencode\/node_modules: missing on trunk \(run lpwr-setup\)/u,
      "gap visible in the status report (P0-2 acceptance c)"
    );
    assert.ok(
      stub.logs.some((line) => line.includes("missing link target")),
      "mint-time gap recorded in the structured log"
    );

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
    writeFileSync(path.join(root, "docs/state.md"), stateDone("auth-001"));
    assert.equal(await markPendingCleanup(root, "auth-001"), "marked");
    const marked = await readManifest(root);
    assert.ok(marked.marks["auth-001"], "manifest marked");
    assert.equal(marked.corrupt, false);
    assert.equal(git(root, "status", "--porcelain"), "", "manifest gitignored");

    // A mark whose worktree no longer exists (removed outside the service)
    // must be swept by the next prune instead of lingering as an orphan.
    const manifestFile = path.join(root, ".loop-worktrees", "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf-8")) as {
      pending: Record<string, string>;
    };
    manifest.pending["auth-999"] = "2026-01-01T00:00:00.000Z";
    writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    const markedStatus = await service.capStatus();
    assert.ok(
      markedStatus.manifestStale.includes("auth-999"),
      "stale mark visible in the audit surface"
    );

    // Prune closes worktree + branch and clears the mark.
    const report = await service.prune("auth-001");
    assert.match(report, /pruned auth-001 \(shipped \+ pending cleanup\)/u);
    assert.ok(!existsSync(wt), "worktree dir removed");
    assert.ok(!gitOk(root, "show-ref", "--verify", "--quiet", "refs/heads/auth-001"), "branch removed");
    assert.deepEqual(await service.listOpen(), []);
    assert.deepEqual(
      await readManifest(root),
      { corrupt: false, marks: {} },
      "mark cleared, stale mark swept"
    );
    assert.equal(worktreeCount(root), 1, "only the main worktree remains");

    // P1-1: the merged spec folder now lives on trunk with no worktree —
    // minting that taken ID must refuse instead of adopting its history.
    await assert.rejects(
      () => service.mint("auth-001"),
      /already exists/u,
      "taken traceability ID refused"
    );
    assert.equal(worktreeCount(root), 1, "refused mint creates no worktree");
    assert.ok(
      !gitOk(root, "show-ref", "--verify", "--quiet", "refs/heads/auth-001"),
      "refused mint recreates no branch"
    );
  } finally {
    rmSync(base, { force: true, recursive: true });
  }
});

test("cap blocks at the max; force prune needs confirmation; own worktree never prunes", async () => {
  const { base, root } = makeRepo();
  const previous = process.env.LPWR_MAX_WORKTREES;
  try {
    const service = createWorktreeService(pluginStub(root).plugin, root);
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
    const ownService = createWorktreeService(pluginStub(wt2).plugin, wt2);
    const own = await ownService.prune("auth-002", {
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

test("corrupt manifest: prune reports it loudly and never clobbers it (P0-1)", async () => {
  const { base, root } = makeRepo();
  try {
    const stub = pluginStub(root);
    const service = createWorktreeService(stub.plugin, root);
    await service.mint("auth-001");
    writeFileSync(path.join(root, "docs/state.md"), stateDone("auth-001"));
    assert.equal(await markPendingCleanup(root, "auth-001"), "marked");

    const manifestFile = path.join(root, ".loop-worktrees", "manifest.json");
    const garbage = '{"pending": {"auth-001": "2026-09';
    writeFileSync(manifestFile, garbage);

    // The audit surface (status + guide) flags it — always-on, no flag needed.
    const status = await service.capStatus();
    assert.equal(status.manifestCorrupt, true);
    assert.match(statusReport(status), /manifest: unreadable — repair or delete/u);

    // Prune stays explicit: the shipped path still closes the worktree, the
    // report can't read as an unqualified "nothing pending", the warning
    // reaches both channels, and the file is left for repair.
    const report = await service.prune("auth-001");
    assert.match(report, /pruned auth-001 \(shipped\)/u);
    assert.match(report, /pending-cleanup manifest unreadable/u);
    assert.ok(
      stub.logs.some((line) => line.includes("manifest unreadable")),
      "structured warning recorded"
    );
    assert.ok(
      stub.toasts.some((message) => message.includes("manifest unreadable")),
      "toast raised"
    );
    assert.equal(
      readFileSync(manifestFile, "utf-8"),
      garbage,
      "corrupt file never overwritten"
    );
    assert.ok(!existsSync(worktreeRootOf(base, "auth-001")));
  } finally {
    rmSync(base, { force: true, recursive: true });
  }
});

test("prune is resumable: mid-list failure keeps its mark, re-runs converge (P1-2)", async () => {
  const { base, root } = makeRepo();
  const previous = process.env.LPWR_MAX_WORKTREES;
  try {
    process.env.LPWR_MAX_WORKTREES = "4";
    const service = createWorktreeService(pluginStub(root).plugin, root);
    const wt1 = worktreeRootOf(base, "auth-001");
    const wt2 = worktreeRootOf(base, "auth-002");
    const wt3 = worktreeRootOf(base, "auth-003");

    // Three pending worktrees (clean — no spec folders, everything else
    // gitignored), each marked after a shared Done landing.
    await service.mint("auth-001");
    await service.mint("auth-002");
    await service.mint("auth-003");
    writeFileSync(
      path.join(root, "docs/state.md"),
      stateDone("auth-001", "auth-002", "auth-003")
    );
    assert.equal(await markPendingCleanup(root, "auth-001"), "marked");
    assert.equal(await markPendingCleanup(root, "auth-002"), "marked");
    assert.equal(await markPendingCleanup(root, "auth-003"), "marked");

    // dry_run plans without mutating: same decisions, nothing removed,
    // nothing written to the manifest.
    const plan = await service.prune(undefined, { dryRun: true });
    assert.match(plan, /^would prune auth-001 \(/mu);
    assert.match(plan, /^would prune auth-002 \(/mu);
    assert.match(plan, /^would prune auth-003 \(/mu);
    assert.equal(worktreeCount(root), 4, "dry run removes nothing");
    const planned = await readManifest(root);
    assert.equal(
      Object.keys(planned.marks).length,
      3,
      "dry run writes nothing"
    );

    // Lock auth-002 → its removal fails mid-list; auth-001/auth-003 still go.
    git(root, "worktree", "lock", wt2);
    const first = await service.prune();
    assert.match(first, /pruned auth-001/u);
    assert.match(first, /failed auth-002/u);
    assert.match(first, /pruned auth-003/u);
    assert.ok(!existsSync(wt1), "first entry removed");
    assert.ok(existsSync(wt2), "failed entry keeps its worktree");
    assert.ok(!existsSync(wt3), "entries after the failure still process");
    const afterFailure = await readManifest(root);
    assert.deepEqual(
      Object.keys(afterFailure.marks),
      ["auth-002"],
      "only the failed entry keeps its mark — durable per item, not batched"
    );

    // Re-run converges: unlock, prune again, zero residue.
    git(root, "worktree", "unlock", wt2);
    const second = await service.prune();
    assert.match(second, /pruned auth-002/u);
    assert.ok(!existsSync(wt2));
    assert.deepEqual(
      await readManifest(root),
      { corrupt: false, marks: {} },
      "manifest empty after convergence"
    );
    assert.equal(worktreeCount(root), 1, "no orphan worktrees");
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "LPWR_MAX_WORKTREES");
    } else {
      process.env.LPWR_MAX_WORKTREES = previous;
    }
    rmSync(base, { force: true, recursive: true });
  }
});

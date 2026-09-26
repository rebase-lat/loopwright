import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { declaredSurfaceFrom, overlaps } from "../lib/gates.js";
import {
  SPEC_ID,
  block,
  commandName,
  escapeRegExp,
  firstArgument,
  gitCommandDir,
  logWarn,
  looksLikeGitMergeSquash,
  toastWarning,
  trunkBranch,
} from "../lib/shared.js";

// Per-spec worktree lifecycle (implementation-rules 2/29/49/50). Minting an
// ID in the trunk session creates branch + worktree at `dirname(mainRoot)/<id>`
// (a sibling of the main worktree), provisions the shared foundation links,
// and moves `docs/specs/<id>/` into it; work-stage commands are blocked while
// the session sits outside that worktree; shipped + clean worktrees are pruned
// at the next lpwr-propose, before the 2-worktree cap check. The spec ID itself
// comes from journal_handoff's spec_ref — there is no command.execute.after
// hook to read a command result from.

const execFileAsync = promisify(execFile);

const CAP = 2;
const SERVICE = "lpwr-worktree-guard";
const MINT_COMMANDS = new Set(["lpwr-propose", "lpwr-explore"]);
// Stages that operate on one spec's worktree — only meaningful inside it once
// a worktree exists (rules whose session is trunk stay off this list).
const WORK_STAGE = new Set([
  "lpwr-specify",
  "lpwr-specs",
  "lpwr-tasks",
  "lpwr-design",
  "lpwr-implement",
  "lpwr-diagnose",
  "lpwr-review",
  "lpwr-threat-review",
  "lpwr-commit",
  "lpwr-amend",
  "lpwr-goal",
]);
// Gitignored trunk files shared into every worktree — one physical copy each
// so state.md's single-writer rule (lpwr-commit) survives parallel specs.
// docs/memos (no extension) is linked the same way further down: trunk-owned,
// one physical copy, never part of a branch diff (rule 49 pattern).
const FOUNDATION = ["state", "context", "constitution", "audit"];

interface WorktreeInfo {
  path: string;
  branch: string | null;
}

const git = async (cwd: string, args: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
    timeout: 15_000,
  });
  return stdout.trim();
};

const listWorktrees = async (cwd: string): Promise<WorktreeInfo[]> => {
  const raw = await git(cwd, ["worktree", "list", "--porcelain"]);
  const out: WorktreeInfo[] = [];
  for (const chunk of raw.split(/\n{2,}/u)) {
    const lines = chunk.split("\n");
    const wtLine = lines.find((line) => line.startsWith("worktree "));
    if (!wtLine || lines.some((line) => line.startsWith("bare"))) {
      continue;
    }
    const branchLine = lines.find((line) => line.startsWith("branch "));
    out.push({
      branch: branchLine
        ? branchLine.slice("branch ".length).replace(/^refs\/heads\//u, "")
        : null,
      path: wtLine.slice("worktree ".length),
    });
  }
  return out;
};

const gitRoot = async (cwd: string): Promise<string> =>
  path.resolve(await git(cwd, ["rev-parse", "--show-toplevel"]));

// The main worktree always owns .git as a directory; --git-common-dir points
// at it from any linked worktree (relative to cwd or absolute).
const mainRootOf = async (cwd: string): Promise<string> =>
  path.dirname(
    path.resolve(cwd, await git(cwd, ["rev-parse", "--git-common-dir"]))
  );

const specIdOfWorktree = (wt: WorktreeInfo): string | null => {
  if (wt.branch && SPEC_ID.test(wt.branch)) {
    return wt.branch;
  }
  const base = path.basename(wt.path);
  return SPEC_ID.test(base) ? base : null;
};

const findWorktree = (
  worktrees: WorktreeInfo[],
  specId: string
): WorktreeInfo | null =>
  worktrees.find((wt) => specIdOfWorktree(wt) === specId) ?? null;

const exists = async (target: string): Promise<boolean> => {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
};

// state.md section membership (Done closures) — same shape as
// lpwr-verdict-gate's check; section is matched case-insensitively.
const stateHasEntry = async (
  harnessDir: string,
  section: string,
  specId: string
): Promise<boolean> => {
  let state: string;
  try {
    state = await readFile(path.join(harnessDir, "docs/state.md"), "utf-8");
  } catch {
    return false;
  }
  let inside = false;
  for (const line of state.split("\n")) {
    if (new RegExp(`^##\\s+${section}\\b`, "iu").test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (
      inside &&
      new RegExp(`^- ${escapeRegExp(specId)}(?=[:\\s]|$)`, "u").test(
        line.trim()
      )
    ) {
      return true;
    }
  }
  return false;
};

const linkIfMissing = async (
  target: string,
  linkPath: string
): Promise<void> => {
  if (!(await exists(target)) || (await exists(linkPath))) {
    return;
  }
  await mkdir(path.dirname(linkPath), { recursive: true });
  try {
    await symlink(target, linkPath);
  } catch {
    // Raced or unsupported FS — lpwr-install/lpwr-setup remain the fallback.
  }
};

const copyDir = async (src: string, dst: string): Promise<void> => {
  await mkdir(dst, { recursive: true });
  // oxlint-disable-next-line no-await-in-loop -- recursive copy descends depth-first by design
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      // oxlint-disable-next-line no-await-in-loop -- subtree copies in order, one directory at a time
      await copyDir(from, to);
    } else if (entry.isFile()) {
      // oxlint-disable-next-line no-await-in-loop -- writes are bounded by the spec folder size
      await copyFile(from, to);
    }
  }
};

const provision = async (
  plugin: PluginInput,
  options: {
    mainRoot: string;
    mainHarness: string;
    worktreeRoot: string;
    worktreeHarness: string;
    specId: string;
  }
): Promise<void> => {
  const { mainRoot, mainHarness, worktreeRoot, worktreeHarness, specId } =
    options;
  // .opencode/.gitignore carries the node_modules/package.json ignore rules
  // and is itself untracked — without it the provisioning links below would
  // show up as untracked files in the spec's diff grouping.
  try {
    await mkdir(path.join(worktreeHarness, ".opencode"), { recursive: true });
    await copyFile(
      path.join(mainHarness, ".opencode/.gitignore"),
      path.join(worktreeHarness, ".opencode/.gitignore")
    );
  } catch {
    // Trunk has no local .gitignore to copy.
  }
  const links: [string, string][] = [
    [
      path.join(mainHarness, ".opencode/node_modules"),
      path.join(worktreeHarness, ".opencode/node_modules"),
    ],
    [
      path.join(mainHarness, ".opencode/package.json"),
      path.join(worktreeHarness, ".opencode/package.json"),
    ],
    [
      path.join(mainHarness, ".opencode/package-lock.json"),
      path.join(worktreeHarness, ".opencode/package-lock.json"),
    ],
    [
      path.join(mainRoot, "node_modules"),
      path.join(worktreeRoot, "node_modules"),
    ],
    [
      path.join(mainHarness, "docs/memos"),
      path.join(worktreeHarness, "docs/memos"),
    ],
    ...FOUNDATION.map(
      (name) =>
        [
          path.join(mainHarness, `docs/${name}.md`),
          path.join(worktreeHarness, `docs/${name}.md`),
        ] as [string, string]
    ),
  ];
  // docs/memos is gitignored (unlike the tracked dirs it used to ride on a
  // .gitkeep) — materialize it on trunk when a pre-memos-foundation install
  // never ran lpwr-install, so the link above always finds its target.
  try {
    await mkdir(path.join(mainHarness, "docs/memos"), { recursive: true });
  } catch (error) {
    logWarn(
      plugin,
      SERVICE,
      `could not create ${path.join(mainHarness, "docs/memos")}: ${String(error)} — memos stay session-local until lpwr-install creates it`
    );
  }
  await Promise.all(
    links.map(([target, linkPath]) => linkIfMissing(target, linkPath))
  );
  const envPath = path.join(worktreeHarness, ".env");
  if (!(await exists(envPath))) {
    try {
      await writeFile(envPath, `OPENCODE_SPEC_ID=${specId}\n`);
    } catch (error) {
      logWarn(
        plugin,
        SERVICE,
        `could not write ${envPath}: ${String(error)} — branch-derived spec ID still applies`
      );
    }
  }
};

// Proposal/spec files were written in trunk before the journal fired — move
// the folder into the new worktree so trunk never carries a diverging copy.
const moveSpecFolder = async (
  plugin: PluginInput,
  from: string,
  to: string
): Promise<void> => {
  if (!(await exists(from)) || (await exists(to))) {
    return;
  }
  await copyDir(from, to);
  const copied = await readdir(to);
  if (copied.length === 0) {
    logWarn(plugin, SERVICE, `copy of ${from} came up empty — left in place`);
    return;
  }
  await rm(from, { force: true, recursive: true });
};

const openCount = async (mainRoot: string): Promise<number> => {
  const worktrees = await listWorktrees(mainRoot);
  return worktrees.filter((wt) => path.resolve(wt.path) !== mainRoot).length;
};

// Shipped + clean worktrees close themselves at the next mint — lpwr-commit
// cannot remove the worktree its own session is running from. Dirty leftovers
// stay for the human to inspect.
const pruneShipped = async (
  plugin: PluginInput,
  mainRoot: string,
  mainHarness: string
): Promise<void> => {
  const worktrees = await listWorktrees(mainRoot);
  // oxlint-disable-next-line no-await-in-loop -- prunes one worktree at a time so a failure never races the next removal
  for (const wt of worktrees) {
    if (path.resolve(wt.path) === mainRoot) {
      continue;
    }
    const specId = specIdOfWorktree(wt);
    // oxlint-disable-next-line no-await-in-loop -- state check gates this worktree before the next is considered
    if (!specId || !(await stateHasEntry(mainHarness, "done", specId))) {
      continue;
    }
    let dirty = true;
    try {
      // oxlint-disable-next-line no-await-in-loop -- dirty check must settle before removal is attempted
      const status = await git(wt.path, ["status", "--porcelain"]);
      dirty = status.length > 0;
    } catch {
      continue;
    }
    if (dirty) {
      void toastWarning(
        plugin,
        `${specId} is shipped but its worktree has local changes (${wt.path}) — review, then remove it by hand.`
      );
      continue;
    }
    try {
      // oxlint-disable-next-line no-await-in-loop -- remove completes before branch deletion for this worktree
      await git(mainRoot, ["worktree", "remove", wt.path]);
    } catch (error) {
      logWarn(plugin, SERVICE, `could not remove ${wt.path}: ${String(error)}`);
      continue;
    }
    try {
      // oxlint-disable-next-line no-await-in-loop -- branch follows its worktree's removal
      await git(mainRoot, ["branch", "-D", specId]);
    } catch (error) {
      logWarn(
        plugin,
        SERVICE,
        `worktree ${specId} removed but branch deletion failed: ${String(error)}`
      );
    }
  }
};

// Cap block (rule 29). pruneShipped clears only state-Done + clean trees, so
// when nothing is prunable this message is the sole in-band recovery path —
// it must name every way out, or the guide's "run lpwr-propose" advice
// dead-ends at this same block.
const capBlocked = (open: number): string =>
  `Blocked: ${open} worktrees already open (rule 29). Resume an open spec's session, mark a shipped spec Done in docs/state.md so lpwr-propose prunes it, or close one by hand: git worktree remove <path> && git branch -D <id>.`;

const ensureWorktree = async (
  plugin: PluginInput,
  root: string,
  specId: string
): Promise<string> => {
  const sessionRoot = await gitRoot(root);
  const mainRoot = await mainRootOf(root);
  const rel = path.relative(sessionRoot, root);
  const existing = findWorktree(await listWorktrees(mainRoot), specId);
  if (existing) {
    return "";
  }
  // Only the trunk session mints. A worktree session journaling frame/specify
  // is a no-op, never an error — the spec already has its worktree (or the id
  // is unminted and minting belongs to lpwr-propose/lpwr-explore, which
  // `mintGate` already trunk-gates).
  if (sessionRoot !== mainRoot) {
    return "";
  }
  const open = await openCount(mainRoot);
  if (open >= CAP) {
    throw new Error(capBlocked(open));
  }
  const branch = await trunkBranch(root);
  if (!branch) {
    throw new Error(
      "Refused: trunk is on a detached HEAD — check out the main branch before minting a spec."
    );
  }
  const worktreeRoot = path.join(path.dirname(mainRoot), specId);
  await git(mainRoot, ["worktree", "add", "-b", specId, worktreeRoot, branch]);
  const worktreeHarness = path.join(worktreeRoot, rel);
  await provision(plugin, {
    mainHarness: root,
    mainRoot,
    specId,
    worktreeHarness,
    worktreeRoot,
  });
  await moveSpecFolder(
    plugin,
    path.join(root, "docs/specs", specId),
    path.join(worktreeHarness, "docs/specs", specId)
  );
  // Report the harness directory, not the worktree root: that is where
  // opencode must be restarted (harness/ contents sit one level in when the
  // repo carries them in a subdirectory; at the root they coincide).
  return worktreeHarness;
};

const declaredSurface = async (specPath: string): Promise<string[]> => {
  try {
    return declaredSurfaceFrom(await readFile(specPath, "utf-8"));
  } catch {
    return [];
  }
};

// Files allowed to sit dirty on trunk at the squash-merge: journal tails
// (docs/specs/<id>/log.ndjson) appended by lpwr-release / lpwr-teach after
// their own commits — lpwr-commit step 6 stages them into this squash so
// trunk goes clean (Round 6 S6-07). Everything else would either block the
// merge forever (unstaged/untracked — git tolerates them, so nothing else
// ever clears them) or silently ride an unrelated file into an ID-tagged
// commit (staged — empirically confirmed) — both are process gaps (S5-06).
const TAIL_LOG = /^docs\/specs\/[^/]+\/log\.ndjson$/u;

// `status --porcelain` reports repo-root-relative paths; the harness may sit
// in a subdirectory (nested dev layout), so strip the harness prefix before
// matching tails — the same anchor lpwr-scope-guard matches from (Round 5
// S5-01 class). Display keeps the raw paths.
const mergeBlockingFiles = (status: string, harnessRel: string): string[] => {
  const blocking: string[] = [];
  for (const line of status.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const state = line.slice(0, 2);
    const file = line.slice(3);
    const relative =
      harnessRel !== "" && file.startsWith(`${harnessRel}/`)
        ? file.slice(harnessRel.length + 1)
        : file;
    if (state[1] !== " ") {
      if (state === " M" && TAIL_LOG.test(relative)) {
        continue;
      }
      blocking.push(`${state} ${file}`);
      continue;
    }
    if (state !== "??" && TAIL_LOG.test(relative)) {
      continue;
    }
    blocking.push(`${state} ${file}`);
  }
  return blocking;
};

const worktreeGuard = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;

  const mintGate = async (command: string): Promise<void> => {
    let sessionRoot: string;
    let mainRoot: string;
    try {
      sessionRoot = await gitRoot(root);
      mainRoot = await mainRootOf(root);
    } catch (error) {
      logWarn(plugin, SERVICE, `git orientation failed: ${String(error)}`);
      return;
    }
    const mainHarness = path.join(mainRoot, path.relative(sessionRoot, root));
    if (sessionRoot !== mainRoot) {
      block(
        plugin,
        `Blocked: ${command} runs from trunk, not inside a spec worktree (${sessionRoot}) — restart opencode in ${mainHarness} and retry.`
      );
    }
    await pruneShipped(plugin, mainRoot, mainHarness);
    const open = await openCount(mainRoot);
    if (open >= CAP) {
      block(plugin, capBlocked(open));
    }
  };

  const wrongTree = async (command: string, args: string): Promise<void> => {
    const specId = firstArgument(args);
    if (!specId || !SPEC_ID.test(specId)) {
      return;
    }
    let sessionRoot = "";
    let target: WorktreeInfo | null = null;
    try {
      sessionRoot = await gitRoot(root);
      const mainRoot = await mainRootOf(root);
      target = findWorktree(await listWorktrees(mainRoot), specId);
    } catch (error) {
      logWarn(plugin, SERVICE, `worktree check failed: ${String(error)}`);
      return;
    }
    if (!target || path.resolve(target.path) === sessionRoot) {
      return;
    }
    block(
      plugin,
      `Blocked: ${specId} has its own worktree at ${target.path} — quit this session, restart opencode there, and run ${command} ${specId} from that session.`
    );
  };

  const surfaceOverlap = async (
    sessionID: string,
    args: string,
    output: { parts: unknown[] }
  ): Promise<void> => {
    const specId = firstArgument(args);
    if (!specId || !SPEC_ID.test(specId)) {
      return;
    }
    const own = await declaredSurface(
      path.join(root, "docs/specs", specId, "spec.md")
    );
    if (own.length === 0) {
      return;
    }
    let sessionRoot: string;
    let mainRoot: string;
    try {
      sessionRoot = await gitRoot(root);
      mainRoot = await mainRootOf(root);
    } catch {
      return;
    }
    const rel = path.relative(sessionRoot, root);
    const worktrees = await listWorktrees(mainRoot);
    const harnessDirs = [
      path.join(mainRoot, rel),
      ...worktrees
        .filter((wt) => path.resolve(wt.path) !== mainRoot)
        .map((wt) => path.join(wt.path, rel)),
    ];
    const findings: string[] = [];
    const seen = new Set([specId]);
    for (const harnessDir of harnessDirs) {
      let entries: string[];
      try {
        // oxlint-disable-next-line no-await-in-loop -- candidates scan in worktree order so findings read deterministically
        entries = await readdir(path.join(harnessDir, "docs/specs"));
      } catch {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop -- same ordering guarantee for the entries of each worktree
      for (const entry of entries) {
        if (seen.has(entry) || !SPEC_ID.test(entry)) {
          continue;
        }
        seen.add(entry);
        // oxlint-disable-next-line no-await-in-loop -- done-check gates this candidate before the next is read
        if (await stateHasEntry(harnessDir, "done", entry)) {
          continue;
        }
        // oxlint-disable-next-line no-await-in-loop -- surface read follows the done-check for the same candidate
        const theirs = await declaredSurface(
          path.join(harnessDir, "docs/specs", entry, "spec.md")
        );
        for (const mine of own) {
          for (const declared of theirs) {
            if (overlaps(mine, declared)) {
              findings.push(
                `${entry} declares ${declared} (this spec: ${mine})`
              );
            }
          }
        }
      }
    }
    if (findings.length === 0) {
      return;
    }
    output.parts.push({
      messageID: "",
      sessionID,
      text: `Surface overlap (rule 50): ${findings.join("; ")}. Present this to the human via the question tool before finalizing the Tasks section — overlapping in-flight surfaces are a planning-time decision, not a merge-time conflict.`,
      type: "text",
    });
  };

  const guideStatus = async (
    sessionID: string,
    output: { parts: unknown[] }
  ): Promise<void> => {
    let sessionRoot: string;
    let mainRoot: string;
    try {
      sessionRoot = await gitRoot(root);
      mainRoot = await mainRootOf(root);
    } catch {
      return;
    }
    const worktrees = await listWorktrees(mainRoot);
    const open = worktrees.filter((wt) => path.resolve(wt.path) !== mainRoot);
    if (open.length === 0) {
      return;
    }
    const mainHarness = path.join(mainRoot, path.relative(sessionRoot, root));
    const entries = await Promise.all(
      open.map(async (wt) => {
        const id = specIdOfWorktree(wt) ?? path.basename(wt.path);
        return { id, shipped: await stateHasEntry(mainHarness, "done", id) };
      })
    );
    const lines = entries.map(
      ({ id, shipped }) => `${id} — ${shipped ? "shipped" : "in flight"}`
    );
    const atCap = open.length >= CAP;
    // At the cap the guide must not blindly suggest lpwr-propose: it prunes
    // only state-Done + clean trees, so with none Done its prune is a no-op
    // and the cap block fires — name the recovery that actually works.
    let capNote = "";
    if (atCap) {
      capNote = entries.some((entry) => entry.shipped)
        ? " Cap reached (rule 29): run lpwr-propose to prune the shipped + clean worktree(s) before starting anything new."
        : " Cap reached (rule 29): none are Done — resume an open worktree's session, or close one by hand: git worktree remove <path> && git branch -D <id>.";
    }
    output.parts.push({
      messageID: "",
      sessionID,
      text: `Worktree status (lpwr-worktree-guard): ${open.length}/${CAP} open — ${lines.join("; ")}.${capNote}`,
      type: "text",
    });
  };

  return Promise.resolve({
    "command.execute.before": async (input, output) => {
      const name = commandName(input.command);
      if (MINT_COMMANDS.has(name)) {
        await mintGate(name);
        return;
      }
      if (WORK_STAGE.has(name)) {
        // May block; lpwr-tasks falls through to the overlap advisory below.
        await wrongTree(name, input.arguments);
      }
      if (name === "lpwr-tasks") {
        await surfaceOverlap(input.sessionID, input.arguments, output);
        return;
      }
      if (name === "lpwr-guide") {
        await guideStatus(input.sessionID, output);
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "journal_handoff") {
        return;
      }
      const args = input.args as { intent?: unknown; spec_ref?: unknown };
      const intent = args?.intent;
      const specRef = args?.spec_ref;
      if (intent !== "frame" && intent !== "specify") {
        return;
      }
      // frame/specify always journal the spec ID itself — criterion refs
      // (auth-014-1) never name a worktree.
      if (typeof specRef !== "string" || !SPEC_ID.test(specRef)) {
        return;
      }
      const created = await ensureWorktree(plugin, root, specRef);
      if (created === "") {
        return;
      }
      const note = `worktree-guard: branch+worktree ${specRef} created; restart opencode in ${created} to continue.`;
      output.output = `${output.output}\n${note}`;
      void toastWarning(plugin, note);
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") {
        return;
      }
      const command: unknown = output.args.command;
      if (typeof command !== "string" || !looksLikeGitMergeSquash(command)) {
        return;
      }
      const target = gitCommandDir(command, root);
      let status = "";
      let harnessRel = "";
      try {
        status = await git(target, ["status", "--porcelain"]);
        const sessionTop = await git(root, ["rev-parse", "--show-toplevel"]);
        harnessRel = path.relative(sessionTop, root).replaceAll("\\", "/");
      } catch {
        // Not a git worktree (or git unavailable) — the merge will fail on
        // its own with the underlying error.
        return;
      }
      if (status === "") {
        return;
      }
      const blocking = mergeBlockingFiles(status, harnessRel);
      if (blocking.length === 0) {
        return;
      }
      const shown = blocking.slice(0, 6).join("; ");
      const more = blocking.length > 6 ? ` (+${blocking.length - 6} more)` : "";
      block(
        plugin,
        `Blocked: pending changes on trunk before the squash-merge: ` +
          `${shown}${more} — journal tails (docs/specs/*/log.ndjson) are ` +
          `staged by lpwr-commit step 6; commit any other change first as ` +
          `out-of-process work (no spec ID) or stash it; remove stale ` +
          `untracked docs/specs/ files (phantom journal copies).`
      );
    },
  });
};

export default worktreeGuard;

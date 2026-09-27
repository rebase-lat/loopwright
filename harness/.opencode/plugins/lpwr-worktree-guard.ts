import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { tool } from "@opencode-ai/plugin";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { declaredSurfaceFrom, overlaps } from "../lib/gates.ts";
import type { WorktreeInfo } from "../lib/shared.ts";
import {
  SPEC_ID,
  block,
  commandName,
  gitCommandDir,
  logInfo,
  logWarn,
  looksLikeGitMergeSquash,
  specIdArgument,
  toastBlocked,
  toastWarning,
  worktreeList,
} from "../lib/shared.ts";
import type { Orientation } from "../lib/worktree.ts";
import {
  SERVICE,
  capBlocked,
  createWorktreeService,
  findWorktree,
  git,
  harnessDirs,
  markPendingCleanup,
  mergeBlockingFiles,
  orientation,
  stateHasEntry,
  statusReport,
} from "../lib/worktree.ts";

// Per-spec worktree lifecycle (implementation-rules 2/29/49/50/51/52) — the
// thin adapter over lib/worktree.ts, which owns minting, provisioning, the
// cap, pruning, and the pending-cleanup manifest. What lives here: the
// command gates (mint runs from trunk only, work-stage commands run from the
// spec's worktree), the surface-overlap advisory, the guide's status
// injection, the squash-merge trunk-dirt preflight, and three tools trunk
// commands call explicitly — `worktree_mint` (lpwr-propose / lpwr-explore
// after journaling, implementation-rules 2), `worktree_status`,
// `worktree_prune` (confirmation for force removals rides the permission
// ask) — plus one `command.executed` event marking lpwr-commit's worktree
// pending cleanup. No `tool.execute.after` coupling: creation is an explicit
// call, not a side-effect of journaling.

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

const declaredSurface = async (specPath: string): Promise<string[]> => {
  try {
    return declaredSurfaceFrom(await readFile(specPath, "utf-8"));
  } catch {
    return [];
  }
};

const worktreeGuard = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  const service = createWorktreeService(plugin, root);

  const gitOrientation = async (): Promise<Orientation | null> => {
    try {
      return await orientation(root);
    } catch (error) {
      logWarn(plugin, SERVICE, `git orientation failed: ${String(error)}`);
      return null;
    }
  };

  const mintGate = async (command: string): Promise<void> => {
    const o = await gitOrientation();
    if (!o) {
      return;
    }
    if (!o.isTrunk) {
      block(
        plugin,
        `Blocked: ${command} runs from trunk, not inside a spec worktree (${o.sessionRoot}) — restart opencode in the trunk worktree (${o.mainHarness}) and retry.`
      );
    }
    // Opportunistic cleanup before the cap check: shipped or
    // pending-cleanup worktrees close themselves at the next mint
    // (implementation-rules 52).
    await service.prune();
    const status = await service.capStatus();
    if (status.atCap) {
      block(plugin, capBlocked(status.open, status.cap));
    }
  };

  const wrongTree = async (command: string, args: string): Promise<void> => {
    const specId = specIdArgument(args);
    if (!specId) {
      return;
    }
    const o = await gitOrientation();
    if (!o) {
      return;
    }
    let target: WorktreeInfo | null = null;
    try {
      target = findWorktree(await worktreeList(o.mainRoot), specId);
    } catch (error) {
      logWarn(plugin, SERVICE, `worktree check failed: ${String(error)}`);
      return;
    }
    if (!target || path.resolve(target.path) === o.sessionRoot) {
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
    const specId = specIdArgument(args);
    if (!specId) {
      return;
    }
    const own = await declaredSurface(
      path.join(root, "docs/specs", specId, "spec.md")
    );
    if (own.length === 0) {
      return;
    }
    const o = await gitOrientation();
    if (!o) {
      return;
    }
    let harnessDirList: string[];
    try {
      harnessDirList = await harnessDirs(root);
    } catch {
      return;
    }
    const findings: string[] = [];
    const seen = new Set([specId]);
    for (const harnessDir of harnessDirList) {
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
    try {
      const status = await service.capStatus();
      if (status.open === 0) {
        return;
      }
      output.parts.push({
        messageID: "",
        sessionID,
        text: statusReport(status),
        type: "text",
      });
    } catch (error) {
      logWarn(plugin, SERVICE, `worktree status failed: ${String(error)}`);
    }
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
    event: async (input) => {
      if (input.event.type !== "command.executed") {
        return;
      }
      const props = input.event.properties as {
        name?: unknown;
        arguments?: unknown;
      };
      const name = commandName(
        typeof props.name === "string" ? props.name : ""
      );
      if (name !== "lpwr-commit") {
        return;
      }
      const specId = specIdArgument(
        typeof props.arguments === "string" ? props.arguments : ""
      );
      if (!specId) {
        return;
      }
      try {
        const o = await orientation(root);
        const result = await markPendingCleanup(o.mainHarness, specId);
        if (result === "marked") {
          logInfo(
            plugin,
            SERVICE,
            `lpwr-commit completed ${specId} — marked pending cleanup in ${path.join(".loop-worktrees", "manifest.json")}; prune with lpwr-worktree-prune (or the next lpwr-propose)`
          );
        } else if (result === "manifest-corrupt") {
          // The manifest is never overwritten while unreadable — surface it
          // here so the commit flow cannot end silently unmarked (fixes.md
          // P0-1). Shipped status still lets lpwr-worktree-prune close it.
          const message =
            `worktree ${specId}: pending-cleanup manifest is unreadable — ` +
            `mark not written; repair or delete ` +
            `.loop-worktrees/manifest.json (lpwr-worktree-status reports ` +
            `manifest health). The shipped path still lets ` +
            `lpwr-worktree-prune close this worktree.`;
          logWarn(plugin, SERVICE, message);
          void toastWarning(plugin, message);
        }
      } catch (error) {
        logWarn(
          plugin,
          SERVICE,
          `could not mark ${specId} pending cleanup: ${String(error)}`
        );
      }
    },
    tool: {
      // Explicit minting (implementation-rules 2): lpwr-propose /
      // lpwr-explore call this right after journaling, from trunk. Replaces
      // the old `tool.execute.after` coupling to journal_handoff (W1).
      worktree_mint: tool({
        args: { spec_id: tool.schema.string().regex(SPEC_ID) },
        description:
          "Mint the spec's worktree from the trunk session: create branch + worktree beside the project (dir = spec ID), provision the shared foundation links, and move docs/specs/<id>/ into it. Call once from lpwr-propose / lpwr-explore after journaling the frame/specify handoff; never from inside a worktree session. Refuses malformed IDs, shipped IDs (Done in docs/state.md), and leftover branches before touching git.",
        execute: async (args) => {
          try {
            const created = await service.mint(args.spec_id);
            if (created === "") {
              return `Worktree for ${args.spec_id} already exists — nothing to do.`;
            }
            const note = `branch+worktree ${args.spec_id} created; restart opencode in ${created} to continue.`;
            void toastWarning(plugin, note);
            return note;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            void toastBlocked(plugin, message);
            return message;
          }
        },
      }),
      // Self-service pruning (implementation-rules 52): shipped or
      // pending-cleanup + clean close directly; anything else needs force,
      // and every force removal raises the permission confirmation below.
      worktree_prune: tool({
        args: {
          dry_run: tool.schema
            .boolean()
            .optional()
            .describe(
              "Report what would be pruned or skipped without removing anything or writing the manifest."
            ),
          force: tool.schema
            .boolean()
            .optional()
            .describe(
              "Remove the worktree even when it is dirty or neither shipped nor pending cleanup. Every force removal raises a human permission confirmation first."
            ),
          spec_id: tool.schema
            .string()
            .regex(SPEC_ID)
            .optional()
            .describe(
              "Worktree to prune. Omit to prune every eligible worktree (shipped or pending cleanup, clean)."
            ),
        },
        description:
          "Prune spec worktrees: shipped (Done in docs/state.md) or pending-cleanup ones that are clean close directly; dirty or in-flight ones only with force, behind a human confirmation. Never prunes the worktree this session runs from. Use dry_run to preview the plan first.",
        execute: (args, context) =>
          service.prune(args.spec_id, {
            confirm: async (entry) => {
              try {
                await context.ask({
                  always: [],
                  metadata: {
                    force: true,
                    path: entry.path,
                    reason: "dirty or in-flight worktree removal",
                    spec_id: entry.id,
                  },
                  patterns: [entry.path],
                  permission: "worktree_prune.force",
                });
                return true;
              } catch {
                return false;
              }
            },
            dryRun: args.dry_run ?? false,
            force: args.force ?? false,
          }),
      }),
      // Same status lpwr-guide injects, standalone (read-only).
      worktree_status: tool({
        args: {},
        description:
          "List open spec worktrees with shipped/dirty/pending-cleanup state and cap usage. Read-only — the same report lpwr-guide receives.",
        execute: async () => statusReport(await service.capStatus()),
      }),
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
        ({ harnessRel } = await orientation(root));
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
          `staged by lpwr-commit step 6 (rule 51); commit any other change ` +
          `first as out-of-process work (no spec ID) or stash it; remove ` +
          `stale untracked docs/specs/ files (phantom journal copies).`
      );
    },
  });
};

export default worktreeGuard;

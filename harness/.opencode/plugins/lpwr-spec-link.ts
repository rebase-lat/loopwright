import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { receiptIncomplete, stateSectionHasEntry } from "../lib/gates.ts";
import {
  block,
  commandName,
  frontmatterValue,
  specIdArgument,
  worktreeList,
} from "../lib/shared.ts";

// Refuses /lpwr-implement without an approved spec id.
// The spec id is the first token of the command arguments string.
// Frontmatter is parsed for a `status: approved` line (inline `#`
// comments stripped) instead of prefix-matching, so field order
// in spec.md never matters. CRLF is normalized first so the
// `^---\n` fences hold on Windows-authored files.

// Design gate: a spec with design_review: required needs an approved adr.md
// before implement runs — same defense-in-depth shape as the threat-review
// gate on release. Reads the already-loaded spec text plus the ADR file.
const designReviewOpen = async (
  specId: string,
  specRaw: string,
  root: string
): Promise<boolean> => {
  const tier = frontmatterValue(specRaw, "design_review");
  if (tier !== "required") {
    return false;
  }
  let adr = "";
  try {
    adr = await readFile(
      path.join(root, `docs/specs/${specId}/adr.md`),
      "utf-8"
    );
  } catch {
    return true;
  }
  return frontmatterValue(adr, "status") !== "approved";
};

// A spec sitting in docs/state.md's Blocked section is blocked, even when its
// own status reads approved — the state file is the cross-spec escalation
// record, and implement must not route around it. Entries look like
// `- <id>: <reason>`; the boundary check keeps `auth-014` from matching
// `auth-0144` (shared parser in lib/gates.ts).
const isStateBlocked = async (
  specId: string,
  root: string
): Promise<boolean> => {
  let state = "";
  try {
    state = await readFile(path.join(root, "docs/state.md"), "utf-8");
  } catch {
    return false;
  }
  return stateSectionHasEntry(state, "blocked", specId);
};

const specLink = (plugin: PluginInput): Promise<Hooks> => {
  // All reads anchor to the plugin's own directory — cwd may be a subdirectory
  // or another worktree entirely.
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      if (commandName(input.command) !== "lpwr-implement") {
        return;
      }
      // specIdArgument skips flags, so `lpwr-implement --flag auth-014` still
      // keys every gate on auth-014 (analysis T2 / verification F11). It only
      // ever returns a token matching SPEC_ID, so a missing id and a malformed
      // one both land here — one message names the expected shape.
      const specId = specIdArgument(input.arguments);
      if (!specId) {
        block(
          plugin,
          `Blocked: /lpwr-implement requires a traceability ID ` +
            `(<domain>-<sequence>, lowercase, e.g. auth-014).`
        );
      }
      let raw: string;
      try {
        raw = await readFile(
          path.join(root, `docs/specs/${specId}/spec.md`),
          "utf-8"
        );
      } catch {
        // "Not at this path" has three real causes, and which gate reports it
        // first depends on the install's plugin load order (Round 6 S6-03) —
        // so this message diagnoses them itself instead of trusting order:
        // unmaterialized foundation, a spec that lives in its own worktree
        // (restart there — never suggest lpwr-specs, which would mint a
        // divergent copy on trunk), or an unknown ID.
        const foundationMissing = [
          "docs/context.md",
          "docs/constitution.md",
        ].filter((file) => !existsSync(path.join(root, file)));
        if (foundationMissing.length > 0) {
          block(
            plugin,
            `Blocked: missing ${foundationMissing.join(" and ")} — run ` +
              `lpwr-install for a fresh project (foundation before specs), ` +
              `then lpwr-onboard.`
          );
        }
        const worktrees = await worktreeList(root);
        const worktree = worktrees.find(
          (wt) => wt.branch === specId || path.basename(wt.path) === specId
        );
        if (worktree) {
          block(
            plugin,
            `Blocked: ${specId} has its own worktree at ${worktree.path} — ` +
              `quit this session, restart opencode there, and run ` +
              `lpwr-implement ${specId} from that session.`
          );
        }
        block(
          plugin,
          `Blocked: spec ${specId} not found at docs/specs/${specId}/spec.md — ` +
            `check the ID spelling, or create it with lpwr-specs / lpwr-explore.`
        );
      }
      if (frontmatterValue(raw, "status") !== "approved") {
        block(
          plugin,
          `Blocked: spec ${specId} is not approved yet — finish approval ` +
            `with a human verdict via lpwr-specs.`
        );
      }
      if (await isStateBlocked(specId, root)) {
        block(
          plugin,
          `Blocked: spec ${specId} sits in docs/state.md's Blocked section — ` +
            `resolve the escalation before implementing.`
        );
      }
      if (await designReviewOpen(specId, raw, root)) {
        block(
          plugin,
          `Blocked: spec ${specId} requires design review with no approved adr.md — ` +
            `run lpwr-design first.`
        );
      }
      // Memory receipt (A3): basis: observed specs (lpwr-explore) carry no
      // proposal by design — the receipt applies to proposed motions only.
      if (frontmatterValue(raw, "basis") === "observed") {
        return;
      }
      let proposal: string | null;
      try {
        proposal = await readFile(
          path.join(root, `docs/specs/${specId}/proposal.md`),
          "utf-8"
        );
      } catch {
        proposal = null;
      }
      if (proposal === null) {
        block(
          plugin,
          `Blocked: spec ${specId} is basis: proposed but has no ` +
            `docs/specs/${specId}/proposal.md — restore the motion (lpwr-propose).`
        );
      }
      const gap = receiptIncomplete(proposal);
      if (gap) {
        block(
          plugin,
          `Blocked: ${specId}'s proposal.md memory receipt is incomplete ` +
            `(${gap}) — complete the motion's "Checked against memory" ` +
            `(Constitution / Lessons / Memos) before implementing.`
        );
      }
    },
  });
};

export default specLink;

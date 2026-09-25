import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import {
  SPEC_ID,
  block,
  commandName,
  escapeRegExp,
  firstArgument,
  frontmatterValue,
  normalizeEol,
} from "./shared.js";

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

// Memory receipt (Round 2 D6/A3): the motion's "Checked against memory"
// receipt is the observable that implement-time work consulted constitution
// floors, lessons, and memos — the root same-question/same-answer gap. One
// mechanism (presence + fill) enforces all three entries: each line must
// exist, carry content past its label, and hold no unfilled `<...>` template
// placeholder (code spans stripped first so a backticked <id> can't
// false-positive).
const RECEIPT_KEYS = ["Constitution", "Lessons", "Memos"] as const;

const receiptIncomplete = (proposal: string): string | null => {
  const lines = normalizeEol(proposal).split("\n");
  const start = lines.findIndex((line) =>
    /^#{1,6}\s+checked against memory\s*$/iu.test(line.trim())
  );
  if (start === -1) {
    return 'no "Checked against memory" heading';
  }
  const receipt: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/u.test(line)) {
      break;
    }
    receipt.push(line);
  }
  for (const key of RECEIPT_KEYS) {
    const entry = receipt.find((line) =>
      new RegExp(`^\\s*-\\s*${key}\\s*:`, "u").test(line)
    );
    if (entry === undefined) {
      return `missing "${key}:" line`;
    }
    const value = entry.replace(/^[\s-]*[\w-]+\s*:\s*/u, "");
    const cleaned = value.replaceAll(/`[^`\n]*`/gu, "");
    if (!cleaned.trim() || /<[A-Za-z]/u.test(cleaned)) {
      return `the "${key}:" line is empty or still holds a template placeholder`;
    }
  }
  return null;
};

// A spec sitting in docs/state.md's Blocked section is blocked, even when its
// own status reads approved — the state file is the cross-spec escalation
// record, and implement must not route around it. Entries look like
// `- <id>: <reason>`; the boundary check keeps `auth-014` from matching
// `auth-0144`.
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
  const lines = state.split("\n");
  let inside = false;
  for (const line of lines) {
    if (/^##\s+blocked/iu.test(line)) {
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

const specLink = (plugin: PluginInput): Promise<Hooks> => {
  // All reads anchor to the plugin's own directory — cwd may be a subdirectory
  // or another worktree entirely.
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      if (commandName(input.command) !== "lpwr-implement") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        block(plugin, "Blocked: /lpwr-implement requires a spec id.");
      }
      if (!SPEC_ID.test(specId)) {
        block(
          plugin,
          `Blocked: "${specId}" is not a traceability ID ` +
            `(expected <domain>-<sequence>, lowercase, e.g. auth-014).`
        );
      }
      let raw: string;
      try {
        raw = await readFile(
          path.join(root, `docs/specs/${specId}/spec.md`),
          "utf-8"
        );
      } catch {
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

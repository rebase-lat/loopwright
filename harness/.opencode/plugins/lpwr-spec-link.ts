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
    },
  });
};

export default specLink;

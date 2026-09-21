import { readFile } from "node:fs/promises";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Refuses /lpwr-implement without an approved spec id.
// The spec id is the first token of the command arguments string.
// Frontmatter is parsed for a `status: approved` line (inline `#`
// comments stripped) instead of prefix-matching, so field order
// in spec.md never matters.
const frontmatterStatus = (raw: string): string | null => {
  const match = raw.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  const frontmatter = match?.groups?.frontmatter;
  if (!frontmatter) {
    return null;
  }
  const line = frontmatter
    .split("\n")
    .find((candidate) => candidate.trim().toLowerCase().startsWith("status:"));
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim();
};

const frontmatterValue = (raw: string, key: string): string | null => {
  const match = raw.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  const frontmatter = match?.groups?.frontmatter;
  if (!frontmatter) {
    return null;
  }
  const line = frontmatter
    .split("\n")
    .find((candidate) =>
      candidate.trim().toLowerCase().startsWith(`${key}:`)
    );
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim().toLowerCase() || null;
};

// Design gate: a spec with design_review: required needs an accepted adr.md
// before implement runs — same defense-in-depth shape as the threat-review
// gate on release. Reads the already-loaded spec text plus the ADR file.
const designReviewOpen = async (
  specId: string,
  specRaw: string
): Promise<boolean> => {
  const tier = frontmatterValue(specRaw, "design_review");
  if (tier !== "required") {
    return false;
  }
  let adr = "";
  try {
    adr = await readFile(`docs/specs/${specId}/adr.md`, "utf-8");
  } catch {
    return true;
  }
  return frontmatterValue(adr, "status") !== "accepted";
};

const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

// A spec sitting in docs/state.md's Blocked section is blocked, even when its
// own status reads approved — the state file is the cross-spec escalation
// record, and implement must not route around it. Entries look like
// `- <id>: <reason>`; the boundary check keeps `auth-014` from matching
// `auth-0144`.
const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&");

const isStateBlocked = async (specId: string): Promise<boolean> => {
  let state = "";
  try {
    state = await readFile("docs/state.md", "utf-8");
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

// Every blockage raises a TUI toast with the same actionable message as the
// thrown error, then throws. The toast never breaks the gate: with no attached
// TUI (headless runs) the call is a harmless no-op, and any delivery failure is
// swallowed — the error below remains the record.
const toastBlocked = async (
  plugin: PluginInput,
  message: string
): Promise<void> => {
  try {
    await plugin.client.tui.showToast({
      body: { message, title: "Loopwright gate", variant: "error" },
      query: { directory: plugin.directory },
    });
  } catch {
    // Toast delivery is best-effort only.
  }
};

const specLink = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-implement") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        const message = "Blocked: /lpwr-implement requires a spec id.";
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      let raw: string;
      try {
        raw = await readFile(`docs/specs/${specId}/spec.md`, "utf-8");
      } catch {
        const message = `Blocked: spec ${specId} not found at docs/specs/${specId}/spec.md.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (frontmatterStatus(raw)?.toLowerCase() !== "approved") {
        const message = `Blocked: spec ${specId} is not approved yet.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (await isStateBlocked(specId)) {
        const message =
          `Blocked: spec ${specId} sits in docs/state.md's Blocked section — ` +
          `resolve the escalation before implementing.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (await designReviewOpen(specId, raw)) {
        const message =
          `Blocked: spec ${specId} requires design review with no accepted adr.md — ` +
          `run lpwr-design first.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });

export default specLink;

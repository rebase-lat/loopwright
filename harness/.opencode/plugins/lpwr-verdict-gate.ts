import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Mechanical verdict floor (rules 5/7): /lpwr-commit and /lpwr-release cannot run
// without a recorded "ship" whose acceptance table is complete — unless incomplete
// rows are explicitly waived or deferred in the review frontmatter. A prompt sentence
// ("no ship, no commit") is a request an agent can miss under pressure; this plugin
// is the gate that holds whether or not the agent cooperates. Checked before the
// first tool call, not after.
const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

const shipClaimed = (review: string): boolean => /\[x\] *ship/giu.test(review);

const frontmatterBlock = (review: string): string | null => {
  const match = review.match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  return match?.groups?.frontmatter ?? null;
};

// Line-based frontmatter list reader: handles `key: value`, `key: [a, b]`,
// and `- item` lists. Stops at the next key, a blank-line boundary, or `---`.
const sectionEntries = (block: string, key: string): string[] => {
  const entries: string[] = [];
  let inside = false;
  for (const line of block.split("\n")) {
    if (!inside) {
      const header = line.match(new RegExp(`^${key}:\\s*(?<rest>.*)$`, "iu"));
      const rest = header?.groups?.rest.trim() ?? "";
      if (header?.groups) {
        inside = true;
        if (rest && rest !== "[]" && rest !== "null" && rest !== "~") {
          entries.push(rest);
        }
      }
      continue;
    }
    const item = line.match(/^\s*-\s*(?<entry>.+)$/u);
    if (item?.groups) {
      entries.push(item.groups.entry.trim());
      continue;
    }
    if (/^\s*$/u.test(line)) {
      continue;
    }
    break;
  }
  return entries;
};

const stripBrackets = (entry: string): string =>
  entry.replace(/^\[/u, "").replace(/\]$/u, "");

const parseWaived = (block: string): Set<string> => {
  const ids = new Set<string>();
  for (const entry of sectionEntries(block, "waived")) {
    for (const id of stripBrackets(entry).split(/[\s,]+/u)) {
      if (id) {
        ids.add(id);
      }
    }
  }
  return ids;
};

interface Deferred {
  targets: Map<string, string>;
  error?: string;
}

const parseDeferred = (block: string): Deferred => {
  const targets = new Map<string, string>();
  for (const entry of sectionEntries(block, "deferred")) {
    for (const chunk of stripBrackets(entry).split(/,/u)) {
      const trimmed = chunk.trim();
      if (!trimmed) {
        continue;
      }
      const move = trimmed.match(/^(?<id>\S+)\s*->\s*(?<target>\S+)$/u);
      if (!move?.groups?.id || !move.groups.target) {
        return {
          error: `deferred entry "${trimmed}" must be "<criterion-id> -> <follow-up>"`,
          targets,
        };
      }
      targets.set(move.groups.id, move.groups.target);
    }
  }
  return { targets };
};

const rowCells = (row: string): string[] => {
  const parts = row.split("|").map((cell) => cell.trim());
  return parts.filter((_cell, index) => index > 0 && index < parts.length - 1);
};

const tableComplete = (review: string): { ok: boolean; reason?: string } => {
  const block = frontmatterBlock(review);
  const waived = block ? parseWaived(block) : new Set<string>();
  const deferred = block
    ? parseDeferred(block)
    : { targets: new Map<string, string>() };
  if (deferred.error) {
    return { ok: false, reason: deferred.error };
  }
  const rows = review.split("\n").filter((line) => line.trim().startsWith("|"));
  // Skip the header row.
  const data = rows.filter((line) => !/---/u.test(line)).slice(1);
  if (data.length === 0) {
    return { ok: false, reason: "specs axis table has no criterion rows" };
  }
  const seen = new Set<string>();
  for (const row of data) {
    const [criterion, testRef, pass] = rowCells(row);
    if (!criterion) {
      return {
        ok: false,
        reason: `table row without a criterion id: ${row.trim()}`,
      };
    }
    seen.add(criterion);
    if (pass && /^yes$/iu.test(pass) && testRef) {
      continue;
    }
    if (waived.has(criterion) || deferred.targets.has(criterion)) {
      continue;
    }
    if (pass && /^(?<state>deferred|waived)$/iu.test(pass)) {
      return {
        ok: false,
        reason:
          `criterion ${criterion} is marked "${pass}" in the table but not listed ` +
          `under ${pass.toLowerCase()}: in the review frontmatter`,
      };
    }
    if (!testRef) {
      return {
        ok: false,
        reason: `criterion row lacks a test reference: ${row.trim()}`,
      };
    }
    return { ok: false, reason: `criterion not passing: ${row.trim()}` };
  }
  for (const id of [...waived, ...deferred.targets.keys()]) {
    if (!seen.has(id)) {
      return {
        ok: false,
        reason: `waiver lists unknown criterion ${id} — no such row in the specs table`,
      };
    }
  }
  return { ok: true };
};

const frontmatterValue = (review: string, key: string): string | null => {
  const block = frontmatterBlock(review);
  if (!block) {
    return null;
  }
  const line = block
    .split("\n")
    .find((candidate) =>
      candidate.trim().toLowerCase().startsWith(`${key}:`)
    );
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim().toLowerCase() || null;
};

// The Security axis must be fully checked — no unchecked boxes allowed.
// Reviews written before the axis existed fail here: re-render them with the
// current template rather than carrying an unchecked security posture forward.
const securityAxisComplete = (review: string): boolean => {
  const lines = review.split("\n");
  let inside = false;
  let checked = 0;
  for (const line of lines) {
    if (/^##\s+security axis/iu.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (!inside) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]")) {
      return false;
    }
    if (/^- \[[xX]\]/u.test(trimmed)) {
      checked += 1;
    }
  }
  return inside && checked > 0;
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

const verdictGate = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-commit" && name !== "lpwr-release") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        const message = `Blocked: /${name} requires a spec id.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      let review: string;
      try {
        review = await readFile(`docs/specs/${specId}/review.md`, "utf-8");
      } catch {
        const message = `Blocked: no review.md for ${specId} — no ship, no ${name}.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (!shipClaimed(review)) {
        const message = `Blocked: no recorded "ship" verdict for ${specId} — no ${name}.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      const check = tableComplete(review);
      if (!check.ok) {
        const message = `Blocked: ship claimed for ${specId} but ${check.reason}.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (!securityAxisComplete(review)) {
        const message =
          `Blocked: ship claimed for ${specId} but the Security axis is incomplete ` +
          `(missing section or unchecked box) — re-render review.md with the current template.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
      if (
        name === "lpwr-release" &&
        frontmatterValue(review, "risk_tier") === "high" &&
        !existsSync(`docs/specs/${specId}/threat-review.md`)
      ) {
        const message =
          `Blocked: ${specId} is high risk with no threat-review.md — ` +
          `run lpwr-threat-review before releasing.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });

export default verdictGate;

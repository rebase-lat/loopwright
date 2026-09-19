import type { Plugin } from "@opencode-ai/plugin";
import { readFile } from "node:fs/promises";

// Mechanical verdict floor (rules 5/7): /commit and /release cannot run
// without a recorded "ship" whose acceptance table is complete.
// A prompt sentence ("no ship, no commit") is a request an agent can miss
// under pressure; this plugin is the gate that holds whether or not the
// agent cooperates. Checked before the first tool call, not after.
function extractSpecId(args: any): string | undefined {
  if (!args) return undefined;
  if (typeof args === "string") return args;
  return args.specId ?? args.SPEC_ID ?? args.id ?? args[0];
}

function shipClaimed(review: string): boolean {
  return /\[x\] *ship/i.test(review);
}

function tableComplete(review: string): { ok: boolean; reason?: string } {
  const rows = review.split("\n").filter((l) => l.trim().startsWith("|"));
  const data = rows.filter((l) => !/---/.test(l)).slice(1); // skip header
  if (data.length === 0) return { ok: false, reason: "specs axis table has no criterion rows" };
  for (const row of data) {
    const cells = row.split("|").map((c) => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
    const [criterion, testRef, pass] = cells;
    if (!criterion || !testRef) return { ok: false, reason: `criterion row lacks a test reference: ${row.trim()}` };
    if (pass && !/^yes$/i.test(pass)) return { ok: false, reason: `criterion not passing: ${row.trim()}` };
  }
  return { ok: true };
}

export default (async () => {
  return {
    "command.execute.before": async (input: any, output: any) => {
      const name: string = output.command ?? "";
      if (!/(^|[/:])(commit|release)$/.test(name)) return;
      const specId = extractSpecId(output.args);
      if (!specId) throw new Error(`Blocked: /${name} requires a spec id.`);
      let review: string;
      try {
        review = await readFile(`docs/specs/${specId}/review.md`, "utf-8");
      } catch {
        throw new Error(`Blocked: no review.md for ${specId} — no ship, no ${name}.`);
      }
      if (!shipClaimed(review)) {
        throw new Error(`Blocked: no recorded "ship" verdict for ${specId} — no ${name}.`);
      }
      const check = tableComplete(review);
      if (!check.ok) {
        throw new Error(`Blocked: ship claimed for ${specId} but ${check.reason}.`);
      }
    },
  };
}) satisfies Plugin;

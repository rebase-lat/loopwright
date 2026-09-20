import { readFile } from "node:fs/promises";

import type { Hooks } from "@opencode-ai/plugin";

// Mechanical verdict floor (rules 5/7): /lpwr-commit and /lpwr-release cannot run
// without a recorded "ship" whose acceptance table is complete.
// A prompt sentence ("no ship, no commit") is a request an agent can miss
// under pressure; this plugin is the gate that holds whether or not the
// agent cooperates. Checked before the first tool call, not after.
const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

const shipClaimed = (review: string): boolean => /\[x\] *ship/giu.test(review);

const tableComplete = (review: string): { ok: boolean; reason?: string } => {
  const rows = review.split("\n").filter((line) => line.trim().startsWith("|"));
  // Skip the header row.
  const data = rows.filter((line) => !/---/u.test(line)).slice(1);
  if (data.length === 0) {
    return { ok: false, reason: "specs axis table has no criterion rows" };
  }
  for (const row of data) {
    const parts = row.split("|").map((cell) => cell.trim());
    const cells = parts.filter(
      (_cell, index) => index > 0 && index < parts.length - 1
    );
    const [criterion, testRef, pass] = cells;
    if (!criterion || !testRef) {
      return {
        ok: false,
        reason: `criterion row lacks a test reference: ${row.trim()}`,
      };
    }
    if (pass && !/^yes$/iu.test(pass)) {
      return { ok: false, reason: `criterion not passing: ${row.trim()}` };
    }
  }
  return { ok: true };
};

const verdictGate = (): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-commit" && name !== "lpwr-release") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        throw new Error(`Blocked: /${name} requires a spec id.`);
      }
      let review: string;
      try {
        review = await readFile(`docs/specs/${specId}/review.md`, "utf-8");
      } catch {
        throw new Error(
          `Blocked: no review.md for ${specId} — no ship, no ${name}.`
        );
      }
      if (!shipClaimed(review)) {
        throw new Error(
          `Blocked: no recorded "ship" verdict for ${specId} — no ${name}.`
        );
      }
      const check = tableComplete(review);
      if (!check.ok) {
        throw new Error(
          `Blocked: ship claimed for ${specId} but ${check.reason}.`
        );
      }
    },
  });

export default verdictGate;

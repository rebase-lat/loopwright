import { readFile } from "node:fs/promises";

import type { Hooks } from "@opencode-ai/plugin";

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
    .find((candidate) =>
      candidate.trim().toLowerCase().startsWith("status:")
    );
  if (!line) {
    return null;
  }
  return line.split(":").slice(1).join(":").split("#")[0].trim();
};

const firstArgument = (args: string): string | undefined =>
  args.trim().split(/\s+/u)[0];

const specLink = (): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-implement") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (!specId) {
        throw new Error("Blocked: /lpwr-implement requires a spec id.");
      }
      let raw: string;
      try {
        raw = await readFile(`docs/specs/${specId}/spec.md`, "utf-8");
      } catch {
        throw new Error(
          `Blocked: spec ${specId} not found at docs/specs/${specId}/spec.md.`
        );
      }
      if (frontmatterStatus(raw)?.toLowerCase() !== "approved") {
        throw new Error(`Blocked: spec ${specId} is not approved yet.`);
      }
    },
  });

export default specLink;

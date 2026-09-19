import type { Plugin } from "@opencode-ai/plugin";
import { readFile } from "node:fs/promises";

// Refuses /implement without an approved spec id.
// NOTE: layout snippet used raw.startsWith("---\nstatus: approved") —
// that never matches our spec template (id comes first), so we parse
// the frontmatter for a `status: approved` line instead.
function frontmatterStatus(raw: string): string | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const line = match[1]
    .split("\n")
    .find((l) => l.trim().startsWith("status:"));
  return line ? line.split(":")[1].trim() : null;
}

export default (async () => {
  return {
    "command.execute.before": async (input: any, output: any) => {
      const name: string = output.command ?? "";
      if (!/(^|[/:])implement$/.test(name)) return;
      const specId: string | undefined =
        output.args?.specId ?? output.args?.SPEC_ID ?? output.args?.id ?? output.args?.[0];
      if (!specId) throw new Error("Blocked: /implement requires a spec id.");
      let raw: string;
      try {
        raw = await readFile(`docs/specs/${specId}/spec.md`, "utf-8");
      } catch {
        throw new Error(`Blocked: spec ${specId} not found at docs/specs/${specId}/spec.md.`);
      }
      if (frontmatterStatus(raw) !== "approved") {
        throw new Error(`Blocked: spec ${specId} is not approved yet.`);
      }
    },
  };
}) satisfies Plugin;

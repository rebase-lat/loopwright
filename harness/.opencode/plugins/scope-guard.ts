import type { Plugin } from "@opencode-ai/plugin";
import { readFile } from "node:fs/promises";

// Blocks edits outside the active spec's declared surface.
// Active spec comes from OPENCODE_SPEC_ID (worktree environment).
// Declared surface = backtick-quoted paths/globs in tasks.md
// plus the spec's own folder, always allowed.
async function readDeclaredSurface(tasksPath: string, specId: string): Promise<string[]> {
  const surface = [`docs/specs/${specId}/**`];
  let raw: string;
  try {
    raw = await readFile(tasksPath, "utf-8");
  } catch {
    return surface;
  }
  for (const match of raw.matchAll(/`([^`]+)`/g)) {
    const entry = match[1].trim();
    if (entry && !entry.includes("<") && !entry.includes(" ")) surface.push(entry);
  }
  return [...new Set(surface)];
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split("/")
    .map((seg) => {
      if (seg === "**") return "\0";
      return seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
    })
    .join("/")
    .replace(/\0/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/^\.\//, "");
  return patterns.some((p) => {
    const n = p.replace(/^\.\//, "");
    if (n === normalized || normalized.startsWith(n.replace(/\/\*\*$/, "/"))) return true;
    try {
      return globToRegExp(n).test(normalized);
    } catch {
      return false;
    }
  });
}

export default (async () => {
  return {
    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool !== "edit" && input.tool !== "write") return;
      const specId = process.env.OPENCODE_SPEC_ID;
      if (!specId) return; // no active spec — nothing to guard
      const declaredSurface = await readDeclaredSurface(`docs/specs/${specId}/tasks.md`, specId);
      if (!matchesAny(output.args.filePath, declaredSurface)) {
        throw new Error(
          `Blocked: ${output.args.filePath} is outside the declared surface for ${specId}. ` +
            `Update tasks.md first if scope genuinely changed.`
        );
      }
    },
  };
}) satisfies Plugin;

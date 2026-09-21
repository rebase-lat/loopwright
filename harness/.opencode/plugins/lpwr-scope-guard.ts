import { readFile } from "node:fs/promises";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Blocks edits outside the active spec's declared surface.
// Active spec comes from OPENCODE_SPEC_ID (worktree environment).
// Declared surface is the backtick-quoted paths/globs in tasks.md
// plus the spec's own folder, always allowed.
const readDeclaredSurface = async (
  tasksPath: string,
  specId: string
): Promise<string[]> => {
  const surface = [`docs/specs/${specId}/**`];
  let raw: string;
  try {
    raw = await readFile(tasksPath, "utf-8");
  } catch {
    return surface;
  }
  for (const match of raw.matchAll(/`(?<path>[^`]+)`/gu)) {
    const entry = match.groups?.path?.trim() ?? "";
    if (entry && !entry.includes("<") && !entry.includes(" ")) {
      surface.push(entry);
    }
  }
  return [...new Set(surface)];
};

const globToRegExp = (glob: string): RegExp => {
  const escaped = glob
    .split("/")
    .map((seg) => {
      if (seg === "**") {
        return "\0";
      }
      return seg
        .replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&")
        .replaceAll("*", "[^/]*")
        .replaceAll("?", "[^/]");
    })
    .join("/")
    .replaceAll("\0", ".*");
  return new RegExp(`^${escaped}$`, "u");
};

const matchesAny = (filePath: string, patterns: string[]): boolean => {
  const normalized = filePath.replace(/^\.\//u, "");
  return patterns.some((pattern) => {
    const candidate = pattern.replace(/^\.\//u, "");
    if (candidate === normalized) {
      return true;
    }
    if (
      candidate.endsWith("/**") &&
      normalized.startsWith(`${candidate.slice(0, -"/**".length)}/`)
    ) {
      return true;
    }
    try {
      return globToRegExp(candidate).test(normalized);
    } catch {
      return false;
    }
  });
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

const scopeGuard = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") {
        return;
      }
      const specId = process.env.OPENCODE_SPEC_ID;
      // No active spec means nothing to guard.
      if (!specId) {
        return;
      }
      const declaredSurface = await readDeclaredSurface(
        `docs/specs/${specId}/tasks.md`,
        specId
      );
      if (!matchesAny(output.args.filePath, declaredSurface)) {
        const message =
          `Blocked: ${output.args.filePath} is outside the declared surface for ${specId}. ` +
          `Update tasks.md first if the declared surface genuinely changed.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });

export default scopeGuard;

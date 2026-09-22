import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Blocks edits outside the active spec's declared surface.
// The active spec resolves as: explicit OPENCODE_SPEC_ID wins; otherwise the git
// branch of the edited file's worktree, when it looks like a spec ID (worktrees
// are named per spec ID, so branch-derived resolution needs no manual exports).
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

const execFileAsync = promisify(execFile);

const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/u;

const specCache = new Map<string, string | null>();

const findGitDir = (filePath: string): string | null => {
  let dir = path.resolve(process.cwd(), path.dirname(filePath));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (existsSync(path.resolve(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
  return null;
};

const branchSpecId = async (gitDir: string): Promise<string | null> => {
  const cached = specCache.get(gitDir);
  if (cached !== undefined) {
    return cached;
  }
  let specId: string | null = null;
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", gitDir, "branch", "--show-current"],
      {
        timeout: 5000,
      }
    );
    const branch = stdout.trim();
    specId = SPEC_ID.test(branch) ? branch : null;
  } catch {
    specId = null;
  }
  specCache.set(gitDir, specId);
  return specId;
};

const activeSpec = async (
  filePath: unknown
): Promise<{ gitDir: string; specId: string } | null> => {
  if (typeof filePath !== "string") {
    return null;
  }
  const gitDir = findGitDir(filePath);
  if (!gitDir) {
    return null;
  }
  const specId = process.env.OPENCODE_SPEC_ID ?? (await branchSpecId(gitDir));
  return specId ? { gitDir, specId } : null;
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
    event: (input) => {
      // Branch switches invalidate the branch-derived spec cache. The event
      // carries no directory, so the whole cache goes — the next edit
      // re-derives at the cost of one git call. Explicit OPENCODE_SPEC_ID
      // is unaffected (it never consults the cache).
      if (input.event.type === "vcs.branch.updated") {
        specCache.clear();
      }
      return Promise.resolve();
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") {
        return;
      }
      const resolved = await activeSpec(output.args.filePath);
      // No active spec means nothing to guard.
      if (!resolved) {
        return;
      }
      const { gitDir, specId } = resolved;
      // Match in repo-relative terms so absolute or `../` paths from other
      // worktrees can't slip past (or falsely trip) the declared surface.
      const absolute = path.resolve(process.cwd(), output.args.filePath);
      const relative = path.relative(gitDir, absolute).replaceAll("\\", "/");
      const declaredSurface = await readDeclaredSurface(
        path.join(gitDir, `docs/specs/${specId}/tasks.md`),
        specId
      );
      if (relative.startsWith("..") || !matchesAny(relative, declaredSurface)) {
        const message =
          `Blocked: ${relative} is outside the declared surface for ${specId}. ` +
          `Update tasks.md first if the declared surface genuinely changed.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });

export default scopeGuard;

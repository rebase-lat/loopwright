import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { declaredSurfaceFrom } from "../lib/gates.js";
import { SPEC_ID, RETAIN_PATHS, toastBlocked } from "../lib/shared.js";

// Blocks edits outside the active spec's declared surface.
// The active spec resolves as: explicit OPENCODE_SPEC_ID wins; otherwise the git
// branch of the edited file's worktree, when it looks like a spec ID (worktrees
// are named per spec ID, so branch-derived resolution needs no manual exports).
// Declared surface is the backtick-quoted paths/globs in spec.md's Tasks
// section — section-scoped, so backticks elsewhere in the spec (criterion
// text, examples) never leak into the surface — plus the spec's own folder and
// the shared harness bookkeeping paths (RETAIN_PATHS), always allowed.
const readDeclaredSurface = async (
  specPath: string,
  specId: string
): Promise<string[]> => {
  const surface = [`docs/specs/${specId}/**`, ...RETAIN_PATHS];
  let raw: string;
  try {
    raw = await readFile(specPath, "utf-8");
  } catch {
    return surface;
  }
  return [...surface, ...declaredSurfaceFrom(raw)];
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

// apply_patch carries paths in marker lines (patchText), not args.filePath:
//   *** Add File: path / *** Update File: path / *** Move to: path / *** Delete File: path
const patchFilePaths = (patchText: unknown): string[] => {
  if (typeof patchText !== "string") {
    return [];
  }
  const paths: string[] = [];
  for (const match of patchText.matchAll(
    /^\*\*\* (?:Add|Update|Move to|Delete) File: (?<path>.+)$/gmu
  )) {
    const entry = match.groups?.path?.trim();
    if (entry) {
      paths.push(entry);
    }
  }
  return paths;
};

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
  return specId && SPEC_ID.test(specId) ? { gitDir, specId } : null;
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
      if (
        input.tool !== "edit" &&
        input.tool !== "write" &&
        input.tool !== "apply_patch"
      ) {
        return;
      }
      let filePaths: string[] = [];
      if (input.tool === "apply_patch") {
        filePaths = patchFilePaths(output.args.patchText);
      } else if (typeof output.args.filePath === "string") {
        filePaths = [output.args.filePath];
      }
      if (filePaths.length === 0) {
        return;
      }
      // All paths in one patch share one spec context (branch / env var).
      const resolved = await activeSpec(filePaths[0]);
      // No active spec means nothing to guard.
      if (!resolved) {
        return;
      }
      const { specId } = resolved;
      // The spec and the allowed surface both resolve beside this plugin's
      // project directory (same anchor as lpwr-spec-link); `resolved` exists
      // only to prove the branch hosts the active spec (the file's git worktree).
      const declaredSurface = await readDeclaredSurface(
        path.join(plugin.directory, `docs/specs/${specId}/spec.md`),
        specId
      );
      // oxlint-disable-next-line no-await-in-loop -- first violation wins so the blocked path is deterministic
      for (const filePath of filePaths) {
        // Match in project-relative terms — the same base the surface
        // patterns (`docs/specs/<id>/**`, RETAIN_PATHS, Tasks backticks) are
        // written from — so a harness in a git subdirectory still matches its
        // own paths, while absolute or `../` paths from other worktrees can't
        // slip past (or falsely trip) the declared surface.
        const absolute = path.resolve(process.cwd(), filePath);
        const relative = path
          .relative(plugin.directory, absolute)
          .replaceAll("\\", "/");
        if (
          relative.startsWith("..") ||
          !matchesAny(relative, declaredSurface)
        ) {
          const message =
            `Blocked: ${relative} is outside the declared surface for ${specId}. ` +
            `Update the Tasks section first if the declared surface genuinely changed.`;
          // oxlint-disable-next-line no-await-in-loop -- throw stops at first violation
          await toastBlocked(plugin, message);
          throw new Error(message);
        }
      }
    },
  });

export default scopeGuard;

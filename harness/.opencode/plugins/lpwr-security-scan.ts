import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Always-on mechanical floor: secret patterns in touched files block the edit;
// a dependency audit gates lpwr-implement. Zero overhead for a low-tier doc fix
// beyond these two checks — nothing proceeds with a hardcoded secret or a
// known-critical dependency, regardless of tier.
//
// Block messages name the pattern and the file, never the matched secret text
// itself — echoing a secret into an error would violate the constitution floor
// this plugin enforces.
const execFileAsync = promisify(execFile);

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/u],
  ["private key block", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/u],
  ["GitHub token", /\bghp_[A-Za-z0-9]{36,}/u],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/u],
  [
    "secret assignment",
    /(?<key>secret|passwd|password|api[_-]?key|auth[_-]?token)\s*[:=]\s*['"][^'"]{4,}['"]/iu,
  ],
];

const MAX_SCAN_BYTES = 1024 * 1024;
const AUDIT_TIMEOUT_MS = 120000;

const auditCache = new Map<string, { clean: boolean; summary: string }>();

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

const scanFile = async (filePath: string): Promise<string | null> => {
  const resolved = path.resolve(process.cwd(), filePath);
  try {
    if (statSync(resolved).size > MAX_SCAN_BYTES) {
      return null;
    }
    const content = await readFile(resolved, "utf-8");
    for (const [name, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) {
        return name;
      }
    }
  } catch {
    return null;
  }
  return null;
};

const findLockfile = (): string | null => {
  for (const lockfile of [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
  ]) {
    if (existsSync(path.resolve(process.cwd(), lockfile))) {
      return lockfile;
    }
  }
  return null;
};

const countHighCritical = (stdout: string): { high: number; critical: number } | null => {
  try {
    const report = JSON.parse(stdout) as {
      metadata?: { vulnerabilities?: { high?: number; critical?: number } };
    };
    return {
      critical: report.metadata?.vulnerabilities?.critical ?? 0,
      high: report.metadata?.vulnerabilities?.high ?? 0,
    };
  } catch {
    return null;
  }
};

const auditDependencies = async (): Promise<{ blocked?: string; warned?: string }> => {
  const lockfile = findLockfile();
  if (!lockfile) {
    return {};
  }
  if (lockfile !== "package-lock.json") {
    return {
      warned: `Dependency audit is automated for npm only; ${lockfile} found — run your manager's audit manually before implementing.`,
    };
  }
  const lockPath = path.resolve(process.cwd(), lockfile);
  let mtime = 0;
  try {
    mtime = statSync(lockPath).mtimeMs;
  } catch {
    return {};
  }
  const cacheKey = `${lockPath}:${mtime}`;
  const cached = auditCache.get(cacheKey);
  if (cached) {
    return cached.clean ? {} : { blocked: cached.summary };
  }
  let result: { blocked?: string; warned?: string } = {};
  // npm audit exits nonzero when it finds vulnerabilities, so findings arrive
  // via the exec error's stdout — not via the success path. Only a missing or
  // unparseable report degrades to a warning.
  const inspect = (stdout: unknown): void => {
    const counts = typeof stdout === "string" ? countHighCritical(stdout) : null;
    if (!counts) {
      result = {
        warned:
          "npm audit produced no parseable report (offline or npm error) — proceeding without automated findings; run it manually before release.",
      };
      return;
    }
    if (counts.high + counts.critical > 0) {
      result = {
        blocked:
          `npm audit found ${counts.high} high and ${counts.critical} critical vulnerabilities. ` +
          `Resolve before implementing.`,
      };
    }
    auditCache.set(cacheKey, {
      clean: !result.blocked,
      summary: result.blocked ?? "",
    });
  };
  try {
    const { stdout } = await execFileAsync("npm", ["audit", "--json", "--audit-level=high"], {
      maxBuffer: 10_485_760,
      timeout: AUDIT_TIMEOUT_MS,
    });
    inspect(stdout);
  } catch (error) {
    const { stdout } = error as { stdout?: unknown };
    if (typeof stdout === "string" && stdout) {
      inspect(stdout);
    } else {
      result = {
        warned:
          "npm audit could not run (offline or npm error) — proceeding without automated findings; run it manually before release.",
      };
    }
  }
  return result;
};

const securityScan = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      const name = input.command.split(/[/:]/u).pop() ?? "";
      if (name !== "lpwr-implement") {
        return;
      }
      const audit = await auditDependencies();
      if (audit.warned) {
        console.warn(`[security-audit] ${audit.warned}`);
      }
      if (audit.blocked) {
        const message = `Blocked: ${audit.blocked}`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
    "tool.execute.after": async (input) => {
      if (input.tool !== "edit" && input.tool !== "write") {
        return;
      }
      const file: string = input.args.filePath;
      const flagged = await scanFile(file);
      if (!flagged) {
        return;
      }
      const message =
        `Blocked: possible secret detected in ${file} (pattern: ${flagged}). ` +
        `Remove it before continuing.`;
      await toastBlocked(plugin, message);
      throw new Error(message);
    },
  });

export default securityScan;

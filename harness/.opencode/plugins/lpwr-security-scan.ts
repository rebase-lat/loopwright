import { execFile } from "node:child_process";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Always-on mechanical floor: secret patterns in touched files block the edit;
// a dependency audit gates lpwr-implement. Zero overhead for a low-tier doc fix
// beyond these two checks — nothing proceeds with a hardcoded secret or a
// known-critical dependency, regardless of tier.
//
// The audit stays language-agnostic: the exact command is declared per project
// in the constitution (`Audit command:`), never hardcoded here. A nonzero exit
// means findings-or-failure for the project's chosen tool — either way,
// implement does not proceed.
//
// Block messages name the pattern and the file, never the matched secret text
// itself — echoing a secret into an error would violate the constitution floor
// this plugin enforces.
const execFileAsync = promisify(execFile);

const SECRET_PATTERNS: [string, RegExp][] = [
  ["AWS access key", /AKIA[0-9A-Z]{16}/u],
  [
    "private key block",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/u,
  ],
  ["GitHub token", /\bghp_[A-Za-z0-9]{36,}/u],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/u],
  [
    "secret assignment",
    /(?<key>secret|passwd|password|api[_-]?key|auth[_-]?token)\s*[:=]\s*['"][^'"]{4,}['"]/iu,
  ],
];

const MAX_SCAN_BYTES = 1024 * 1024;
const AUDIT_TIMEOUT_MS = 120_000;

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

const readAuditCommands = async (): Promise<string[]> => {
  let raw = "";
  try {
    raw = await readFile(
      path.resolve(process.cwd(), "docs/constitution.md"),
      "utf-8"
    );
  } catch {
    return [];
  }
  const commands: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim().toLowerCase().startsWith("audit command:")) {
      continue;
    }
    const command = line.split(":").slice(1).join(":").trim();
    if (command && !command.includes("<")) {
      commands.push(command);
    }
  }
  return commands;
};

// Minimal quote-aware split: single binary plus args, no shell features.
// Unclosed quotes run to the end of the line.
const splitCommand = (command: string): string[] => {
  const parts: string[] = [];
  let current = "";
  let quote = "";
  for (const char of command) {
    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/u.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) {
    parts.push(current);
  }
  return parts;
};

const auditDependencies = async (): Promise<{
  blocked?: string;
  warned?: string;
}> => {
  const commands = await readAuditCommands();
  if (commands.length === 0) {
    return {
      warned:
        "No audit command declared in docs/constitution.md — dependency findings are unverified; declare one per stack or run them manually before release.",
    };
  }
  for (const command of commands) {
    const [binary, ...args] = splitCommand(command);
    if (!binary) {
      return {
        warned:
          "An audit command in docs/constitution.md is empty — dependency findings are unverified; fix the declaration or run it manually before release.",
      };
    }
    try {
      // eslint-disable-next-line no-await-in-loop -- fail fast: no point running later stacks after a block
      await execFileAsync(binary, args, {
        maxBuffer: 10_485_760,
        timeout: AUDIT_TIMEOUT_MS,
      });
    } catch {
      return {
        blocked:
          `Audit command "${command}" failed — resolve findings or fix the command, ` +
          `then re-run lpwr-implement.`,
      };
    }
  }
  return {};
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

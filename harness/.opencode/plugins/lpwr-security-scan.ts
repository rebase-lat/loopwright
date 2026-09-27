// Always-on mechanical floor: secret patterns in touched files block the edit;
// a dependency audit traces findings per spec. Secrets block because committing
// one is irreversible; audit findings warn-and-trace because the human may
// accept, defer, or fix them at review time — implement continues either way.
//
// The audit stays language-agnostic: the exact command is declared per project
// in the constitution (`Audit command:`), never hardcoded here. A nonzero exit
// means findings-or-failure for the project's chosen tool — recorded in the
// spec's `docs/specs/<id>/audit.md`, reviewed at lpwr-review; it does not stop
// implement.
//
// Block messages name the pattern and the file, never the matched secret text
// itself — echoing a secret into an error would violate the constitution floor
// this plugin enforces.
import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import {
  SPEC_ID,
  commandName,
  firstArgument,
  gitCommandDir,
  looksLikeGitCommit,
  logWarn,
  toastBlocked,
  toastWarning,
} from "../lib/shared.js";

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

// Obvious fixture values are not secrets — test fixtures, example configs, and
// placeholder templates ship `password: "changeme"` deliberately. Only the
// matched text itself is consulted; a real credential never trips this.
const isDummyValue = (matched: string): boolean =>
  /^(?:test|changeme|dummy|placeholder|xxx)[\w-]*$/iu.test(matched.trim()) ||
  /['"](?:test|changeme|dummy|placeholder|xxx)[\w-]*['"]/iu.test(matched);

const MAX_SCAN_BYTES = 1024 * 1024;
const AUDIT_TIMEOUT_MS = 120_000;

// Returns the pattern name for a secret found in text, ignoring dummy values.
const scanContent = (content: string): string | null => {
  for (const [name, pattern] of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match && !isDummyValue(match[0])) {
      return name;
    }
  }
  return null;
};

const scanFile = async (
  plugin: PluginInput,
  filePath: string
): Promise<string | null> => {
  const resolved = path.resolve(process.cwd(), filePath);
  try {
    const { size } = statSync(resolved);
    if (size > MAX_SCAN_BYTES) {
      logWarn(
        plugin,
        "lpwr-security-scan",
        `${filePath} exceeds ${MAX_SCAN_BYTES} bytes — skipped; ` +
          `run a dedicated secret scanner over large files before release.`
      );
      return null;
    }
    const content = await readFile(resolved, "utf-8");
    return scanContent(content);
  } catch {
    return null;
  }
};

const readAuditCommands = async (root: string): Promise<string[]> => {
  let raw = "";
  try {
    raw = await readFile(path.join(root, "docs/constitution.md"), "utf-8");
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

// Per-run dependency audit trace, appended by this plugin to
// docs/specs/<id>/audit.md. One section per run, newest last. Frontmatter
// carries the owning spec (written once on creation). Shape:
//   ---
//   spec_ref: <domain>-<sequence>
//   ---
//   ## <ISO timestamp>
//   command: <audit command run>
//   result: clean | findings (exit <code>)
//   ```<bounded tool output tail>
//   ```
// Reviewed at lpwr-review time via the Security axis. The shape lives in
// templates/audit-per-spec.md; templates/audit.md is the project trail's
// template, not this one.
const AUDIT_TRACE_CHARS = 4000;

const appendAuditTrace = async (
  root: string,
  specId: string | undefined,
  command: string,
  exit: number,
  detail: string
): Promise<void> => {
  if (!specId || !SPEC_ID.test(specId)) {
    return;
  }
  try {
    const dir = path.join(root, "docs/specs", specId);
    await mkdir(dir, { recursive: true });
    const logPath = path.join(dir, "audit.md");
    if (!existsSync(logPath)) {
      await appendFile(logPath, `---\nspec_ref: ${specId}\n---\n\n`, "utf-8");
    }
    const lines = [
      `## ${new Date().toISOString()}`,
      `command: ${command}`,
      exit === 0 ? "result: clean" : `result: findings (exit ${exit})`,
    ];
    if (detail.trim()) {
      lines.push("```", detail.trim(), "```");
    }
    await appendFile(logPath, `${lines.join("\n")}\n\n`, "utf-8");
  } catch {
    // The trace is best-effort; the console warning above remains.
  }
};

// Staged additions only — context lines and deletions can't introduce a secret.
// `git diff --cached` fails outside a repo; treat that as nothing staged.
const scanStagedDiff = async (root: string): Promise<string | null> => {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(
      "git",
      ["-C", root, "diff", "--cached", "--unified=0", "--no-color"],
      { maxBuffer: 10_485_760, timeout: 15_000 }
    ));
  } catch {
    return null;
  }
  const added = stdout
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
  if (!added) {
    return null;
  }
  return scanContent(added);
};

const auditDependencies = async (
  root: string,
  specId: string | undefined
): Promise<{ warned?: string }> => {
  const commands = await readAuditCommands(root);
  if (commands.length === 0) {
    return {
      warned:
        "No audit command declared in docs/constitution.md — dependency findings " +
        "are unverified. Either the file is not materialized yet (run lpwr-install, " +
        "then lpwr-onboard) or it holds no `Audit command:` line of its own; " +
        "declare one per stack, or run the audit manually before release.",
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
      // oxlint-disable-next-line no-await-in-loop -- runs are sequential so the trace reads in declaration order
      await execFileAsync(binary, args, {
        maxBuffer: 10_485_760,
        timeout: AUDIT_TIMEOUT_MS,
      });
      // oxlint-disable-next-line no-await-in-loop -- runs are sequential so the trace reads in declaration order
      await appendAuditTrace(root, specId, command, 0, "");
    } catch (error) {
      const { code, stdout, stderr } = error as {
        code?: string | number;
        stdout?: unknown;
        stderr?: unknown;
      };
      const exit = typeof code === "number" ? code : 1;
      const detail = `${stdout ?? ""}${stderr ?? ""}`.slice(-AUDIT_TRACE_CHARS);
      // oxlint-disable-next-line no-await-in-loop -- runs are sequential so the trace reads in declaration order
      await appendAuditTrace(root, specId, command, exit, detail);
      return {
        warned:
          `Audit command "${command}" reported findings — recorded in ` +
          `docs/specs/${specId ?? "<id>"}/audit.md; review before release, ` +
          `implement continues.`,
      };
    }
  }
  return {};
};

const securityScan = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      if (commandName(input.command) !== "lpwr-implement") {
        return;
      }
      const specId = firstArgument(input.arguments);
      if (specId && !SPEC_ID.test(specId)) {
        return;
      }
      const audit = await auditDependencies(root, specId);
      if (audit.warned) {
        logWarn(plugin, "lpwr-security-scan", audit.warned);
        await toastWarning(plugin, audit.warned);
      }
    },
    "tool.execute.after": async (input) => {
      if (
        input.tool !== "edit" &&
        input.tool !== "write" &&
        input.tool !== "apply_patch"
      ) {
        return;
      }
      const file: unknown = input.args.filePath;
      if (typeof file !== "string" || file === "") {
        // apply_patch has no single filePath — pending content is scanned pre-write.
        return;
      }
      const flagged = await scanFile(plugin, file);
      if (!flagged) {
        return;
      }
      const message =
        `Blocked: possible secret detected in ${file} (pattern: ${flagged}). ` +
        `Remove it before continuing.`;
      await toastBlocked(plugin, message);
      throw new Error(message);
    },
    "tool.execute.before": async (input, output) => {
      // Pre-write: scan the pending content so a secret never lands on disk —
      // the after-hook remains as a backstop for tools that rewrite the file.
      if (
        input.tool === "edit" ||
        input.tool === "write" ||
        input.tool === "apply_patch"
      ) {
        const args = output.args as Record<string, unknown>;
        const pending = [
          args.newText,
          args.content,
          args.newString,
          args.patchText,
        ]
          .filter((value): value is string => typeof value === "string")
          .join("\n");
        let file = "(pending)";
        if (typeof args.filePath === "string" && args.filePath !== "") {
          file = args.filePath;
        } else if (input.tool === "apply_patch") {
          file = "(apply_patch)";
        }
        const flagged = pending ? scanContent(pending) : null;
        if (flagged) {
          const message =
            `Blocked: possible secret detected in pending write to ${file} ` +
            `(pattern: ${flagged}). Remove it before continuing.`;
          await toastBlocked(plugin, message);
          throw new Error(message);
        }
        return;
      }
      // A raw `git commit` is the same irreversible action as /lpwr-commit —
      // scan what is actually staged, not the working tree. The commit flow
      // stages in the trunk worktree (`git -C <main> …`) while this plugin
      // runs from the spec worktree session, so follow the command's -C
      // target — scanning the session index would miss the staged squash
      // (Round 6, S5-08).
      if (input.tool !== "bash") {
        return;
      }
      const command: unknown = output.args.command;
      if (typeof command !== "string" || !looksLikeGitCommit(command)) {
        return;
      }
      const flagged = await scanStagedDiff(gitCommandDir(command, root));
      if (flagged) {
        const message =
          `Blocked: possible secret in staged changes (pattern: ${flagged}). ` +
          `Unstage it (\`git restore --staged <file>\`) before committing.`;
        await toastBlocked(plugin, message);
        throw new Error(message);
      }
    },
  });
};

export default securityScan;

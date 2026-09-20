import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import type { Hooks } from "@opencode-ai/plugin";

// Journals domain handoffs to docs/specs/<id>/log.ndjson — the one
// artifact every domain writes to. Each command invocation maps to its
// domain intent; the payload is always a constructed artifact pointer,
// never inline content (rule 20). Only spec-shaped arguments are
// journaled; anything else is out-of-process work, not a gap in the log.
// Agents also append precise completion lines per their command prompts;
// this plugin is the canonical backstop. Never throws — a logging
// failure must not break the loop.
const COMMAND_INTENTS = {
  "lpwr-codebase": "govern",
  "lpwr-commit": "retain",
  "lpwr-constitution": "govern",
  "lpwr-diagnose": "execute",
  "lpwr-domain": "govern",
  "lpwr-goal": "verify",
  "lpwr-implement": "execute",
  "lpwr-improve": "frame",
  "lpwr-interview": "frame",
  "lpwr-propose": "frame",
  "lpwr-release": "verify",
  "lpwr-research": "frame",
  "lpwr-review": "verify",
  "lpwr-specs": "specify",
  "lpwr-stack": "govern",
  "lpwr-tasks": "specify",
  "lpwr-teach": "retain",
} as const;

type CommandName = keyof typeof COMMAND_INTENTS;

const COMMAND_ARTIFACTS: Record<CommandName, string> = {
  "lpwr-codebase": "glossary.md",
  "lpwr-commit": "",
  "lpwr-constitution": "constitution.md",
  "lpwr-diagnose": "",
  "lpwr-domain": "glossary.md",
  "lpwr-goal": "",
  "lpwr-implement": "",
  "lpwr-improve": "",
  "lpwr-interview": "",
  "lpwr-propose": "proposal.md",
  "lpwr-release": "review.md",
  "lpwr-research": "",
  "lpwr-review": "review.md",
  "lpwr-specs": "spec.md",
  "lpwr-stack": "",
  "lpwr-tasks": "tasks.md",
  "lpwr-teach": "",
};

const isCommand = (name: string): name is CommandName =>
  name in COMMAND_INTENTS;

const specDirOf = (specRef: string): string | null => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/iu.test(specRef)) {
    return null;
  }
  const parts = specRef.split("-");
  const last = parts.at(-1) ?? "";
  const prev = parts.at(-2) ?? "";
  if (/^\d+$/u.test(last) && /^\d+$/u.test(prev)) {
    return parts.slice(0, -1).join("-");
  }
  if (/^\d+$/u.test(last)) {
    return specRef;
  }
  return null;
};

const evidenceLog = (): Promise<Hooks> =>
  Promise.resolve({
    "command.execute.before": async (input) => {
      try {
        const name = input.command.split(/[/:]/u).pop() ?? "";
        if (!isCommand(name)) {
          return;
        }
        const specRef = input.arguments.trim().split(/\s+/u)[0] ?? "";
        const dir = specDirOf(specRef);
        if (!dir) {
          return;
        }
        const artifact = COMMAND_ARTIFACTS[name];
        const pointer = artifact
          ? `docs/specs/${dir}/${artifact}`
          : `docs/specs/${dir}/`;
        const line = `${JSON.stringify({
          confidence: "medium",
          intent: COMMAND_INTENTS[name],
          payload: { type: "artifact_pointer", value: pointer },
          spec_ref: specRef,
          ts: new Date().toISOString(),
        })}\n`;
        const logPath = `docs/specs/${dir}/log.ndjson`;
        await mkdir(path.dirname(logPath), { recursive: true });
        await appendFile(logPath, line, "utf-8");
      } catch {
        // Logging must never break the loop.
      }
    },
  });

export default evidenceLog;

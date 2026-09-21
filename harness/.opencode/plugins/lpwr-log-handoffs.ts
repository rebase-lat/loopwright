import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { tool } from "@opencode-ai/plugin";
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

const writeHandoff = async (
  intent: string,
  specRef: string,
  pointer: string,
  confidence: string
): Promise<string | null> => {
  const dir = specDirOf(specRef);
  if (!dir) {
    return null;
  }
  const line = `${JSON.stringify({
    confidence,
    intent,
    payload: { type: "artifact_pointer", value: pointer },
    spec_ref: specRef,
    ts: new Date().toISOString(),
  })}\n`;
  const logPath = `docs/specs/${dir}/log.ndjson`;
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, line, "utf-8");
  return logPath;
};

// Mechanical logging: commands call this instead of hand-writing log lines,
// so intent vocabulary and pointer shape are validated by schema, not by prose.
const journalHandoff = tool({
  args: {
    artifact: tool.schema.string().min(1),
    confidence: tool.schema.enum(["high", "low", "medium"]).optional(),
    intent: tool.schema.enum([
      "frame",
      "specify",
      "execute",
      "verify",
      "retain",
      "govern",
    ]),
    spec_ref: tool.schema
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u),
  },
  description:
    "Append one validated A2A handoff line to a spec's log.ndjson. Prefer this over hand-writing log lines.",
  execute: async (args) => {
    try {
      const written = await writeHandoff(
        args.intent,
        args.spec_ref,
        args.artifact,
        args.confidence ?? "medium"
      );
      if (!written) {
        return `Refused: "${args.spec_ref}" is not a traceability ID.`;
      }
      return `Recorded ${args.intent} handoff for ${args.spec_ref} in ${written}.`;
    } catch {
      return `Failed to record handoff for ${args.spec_ref}; logging must never break the loop.`;
    }
  },
});

const specDirOf = (specRef: string): string | null => {
  // Strictly lowercase: the ID scheme is lowercase everywhere, and an uppercase
  // argument must not journal phantom entries under a second spelling of the ID.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u.test(specRef)) {
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
    tool: { journal_handoff: journalHandoff },
    "command.execute.before": async (input) => {
      try {
        const name = input.command.split(/[/:]/u).pop() ?? "";
        if (!isCommand(name)) {
          return;
        }
        const specRef = input.arguments.trim().split(/\s+/u)[0] ?? "";
        const artifact = COMMAND_ARTIFACTS[name];
        const pointer = artifact
          ? `docs/specs/${specDirOf(specRef)}/${artifact}`
          : `docs/specs/${specDirOf(specRef)}/`;
        await writeHandoff(COMMAND_INTENTS[name], specRef, pointer, "medium");
      } catch {
        // Logging must never break the loop.
      }
    },
  });

export default evidenceLog;

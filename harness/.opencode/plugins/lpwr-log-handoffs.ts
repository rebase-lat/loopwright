import { existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { tool } from "@opencode-ai/plugin";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Journals domain handoffs to docs/specs/<id>/log.ndjson — the one
// artifact every domain writes to. Each command invocation maps to its
// domain intent; the payload is always a constructed artifact pointer,
// never inline content (rule 20). Only spec-shaped arguments are
// journaled; anything else is out-of-process work, not a gap in the log.
// Auto-lines written from command.execute.before carry origin "hook" —
// there is no command.execute.after in the Hooks interface, so provenance
// has to travel on the line itself rather than be inferred later.
// Agents also append precise completion lines per their command prompts;
// this plugin is the canonical backstop. Never throws — a logging
// failure must not break the loop.
const COMMAND_INTENTS = {
  "lpwr-amend": "specify",
  "lpwr-codebase": "govern",
  "lpwr-commit": "retain",
  "lpwr-constitution": "govern",
  "lpwr-design": "specify",
  "lpwr-diagnose": "execute",
  "lpwr-domain": "govern",
  "lpwr-explore": "specify",
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
  "lpwr-threat-review": "verify",
} as const;

type CommandName = keyof typeof COMMAND_INTENTS;

const COMMAND_ARTIFACTS: Record<CommandName, string> = {
  "lpwr-amend": "spec.md",
  "lpwr-codebase": "glossary.md",
  "lpwr-commit": "",
  "lpwr-constitution": "constitution.md",
  "lpwr-design": "adr.md",
  "lpwr-diagnose": "",
  "lpwr-domain": "glossary.md",
  "lpwr-explore": "spec.md",
  "lpwr-goal": "",
  "lpwr-implement": "",
  "lpwr-improve": "",
  "lpwr-interview": "",
  "lpwr-propose": "proposal.md",
  // Release ships the repo, not one file in the spec folder — the pointer
  // is the directory itself (tag/notes live outside docs/specs/).
  "lpwr-release": "",
  "lpwr-research": "",
  "lpwr-review": "review.md",
  "lpwr-specs": "spec.md",
  "lpwr-stack": "",
  "lpwr-tasks": "spec.md",
  "lpwr-teach": "",
  "lpwr-threat-review": "threat-review.md",
};

const isCommand = (name: string): name is CommandName =>
  name in COMMAND_INTENTS;

const SPEC_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u;

// Resolve a spec argument to its directory under docs/specs/, anchored to the
// plugin root. Strictly lowercase: the ID scheme is lowercase everywhere, and an
// uppercase argument must not journal phantom entries under a second spelling of
// the ID. If the full argument already names an existing directory (multi-part
// ids like auth-014-2 keep their own folder), prefer it; otherwise strip a
// trailing `-\d+` sequence when the remainder is a valid id.
const resolveSpecDir = (root: string, specRef: string): string | null => {
  if (!SPEC_REF.test(specRef)) {
    return null;
  }
  if (existsSync(path.join(root, "docs/specs", specRef))) {
    return specRef;
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

const writeHandoff = async (
  root: string,
  intent: string,
  specRef: string,
  pointer: string,
  confidence: string,
  origin?: string
): Promise<string | null> => {
  const dir = resolveSpecDir(root, specRef);
  if (!dir) {
    return null;
  }
  const line = `${JSON.stringify({
    ...(origin ? { origin } : {}),
    confidence,
    intent,
    payload: { type: "artifact_pointer", value: pointer },
    spec_ref: specRef,
    ts: new Date().toISOString(),
  })}\n`;
  const logPath = path.join(root, "docs/specs", dir, "log.ndjson");
  await mkdir(path.dirname(logPath), { recursive: true });
  await appendFile(logPath, line, "utf-8");
  return path.relative(root, logPath).replaceAll("\\", "/");
};

// Mechanical logging: commands call this instead of hand-writing log lines,
// so intent vocabulary and pointer shape are validated by schema, not by prose.
const journalHandoff = (root: string) =>
  tool({
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
      "Append one validated A2A handoff line to a spec's log.ndjson. Prefer this over hand-writing log lines. Set confidence high only with a passing check behind the claim, medium for mechanical observations, low when inferred from adjacent context.",
    execute: async (args) => {
      try {
        const written = await writeHandoff(
          root,
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

const evidenceLog = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    "command.execute.before": async (input) => {
      try {
        const name = input.command.split(/[/:]/u).pop() ?? "";
        if (!isCommand(name)) {
          return;
        }
        const specRef = input.arguments.trim().split(/\s+/u)[0] ?? "";
        const dir = resolveSpecDir(root, specRef);
        if (!dir) {
          return;
        }
        const artifact = COMMAND_ARTIFACTS[name];
        const pointer = artifact
          ? `docs/specs/${dir}/${artifact}`
          : `docs/specs/${dir}/`;
        await writeHandoff(
          root,
          COMMAND_INTENTS[name],
          specRef,
          pointer,
          "medium",
          "hook"
        );
      } catch {
        // Logging must never break the loop.
      }
    },
    tool: { journal_handoff: journalHandoff(root) },
  });
};

export default evidenceLog;

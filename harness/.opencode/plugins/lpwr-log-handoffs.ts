import { existsSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import path from "node:path";

import { tool } from "@opencode-ai/plugin";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { specDirNames } from "../lib/gates.ts";
import {
  commandName,
  logWarn,
  specIdArgument,
  specWorktreeBases,
} from "../lib/shared.ts";

// Journals domain handoffs to docs/specs/<id>/log.ndjson — the one
// artifact every domain writes to. Each command maps to its domain intent;
// the payload is always a constructed artifact pointer, never inline content
// (rule 20). Auto-lines are written from the `command.executed` event, which
// opencode publishes only after every `command.execute.before` gate has
// passed and the command actually ran — so a blocked command never journals,
// in any plugin load order (the old before-hook raced the blocking hooks,
// and hook order is filesystem-dependent per install, Round 6 S6-03). The
// spec folder resolves through the session root plus every registered
// worktree: a keyed trunk command appends into the spec's worktree log
// instead of minting a divergent copy on trunk (Round 6 S6-02), and a
// spec-shaped ref with no folder anywhere is refused, never created (S5-04).
// `lpwr-commit` carries no auto-line: its step-5 retain handoff is written
// before the squash-merge, and an end-of-command line would land after the
// merge and dirty the worktree the next propose needs to prune.
// Agents also append precise completion lines per their command prompts;
// this plugin is the canonical backstop. Never throws — a logging failure
// must not break the loop.
const COMMAND_INTENTS = {
  "lpwr-amend": "specify",
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
  "lpwr-specify": "specify",
  "lpwr-specs": "specify",
  "lpwr-stack": "govern",
  "lpwr-tasks": "specify",
  "lpwr-teach": "retain",
  "lpwr-threat-review": "verify",
} as const;

type CommandName = keyof typeof COMMAND_INTENTS;

const COMMAND_ARTIFACTS: Record<CommandName, string> = {
  "lpwr-amend": "spec.md",
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
  "lpwr-specify": "spec.md",
  "lpwr-specs": "spec.md",
  "lpwr-stack": "",
  "lpwr-tasks": "spec.md",
  "lpwr-teach": "",
  "lpwr-threat-review": "threat-review.md",
};

const isCommand = (name: string): name is CommandName =>
  name in COMMAND_INTENTS;

// Existing docs/specs/<name> for a spec-shaped ref: the session root first,
// then every registered worktree's harness dir (Round 6 S6-02). Candidate
// names come from gates.specDirNames — invalid refs and id-shaped slugs with
// no folder anywhere resolve to a refusal, never to a mkdir.
type SpecDirResolution =
  | { status: "invalid" }
  | { status: "missing" }
  | { status: "found"; dir: string };

const resolveSpecDir = async (
  root: string,
  specRef: string
): Promise<SpecDirResolution> => {
  const names = specDirNames(specRef);
  if (names.length === 0) {
    return { status: "invalid" };
  }
  const bases = await specWorktreeBases(root);
  for (const name of names) {
    for (const base of bases) {
      const dir = path.join(base, "docs/specs", name);
      if (existsSync(dir)) {
        return { dir, status: "found" };
      }
    }
  }
  return { status: "missing" };
};

const appendHandoff = async (
  root: string,
  dir: string,
  intent: string,
  specRef: string,
  pointer: string,
  confidence: string,
  origin?: string
): Promise<string> => {
  const line = `${JSON.stringify({
    ...(origin ? { origin } : {}),
    confidence,
    intent,
    payload: { type: "artifact_pointer", value: pointer },
    spec_ref: specRef,
    ts: new Date().toISOString(),
  })}\n`;
  const logPath = path.join(dir, "log.ndjson");
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
        const resolved = await resolveSpecDir(root, args.spec_ref);
        if (resolved.status === "invalid") {
          return (
            `Refused: "${args.spec_ref}" is not a traceability ID ` +
            `(expected <domain>-<sequence>, lowercase, e.g. auth-014).`
          );
        }
        if (resolved.status === "missing") {
          return (
            `Refused: no docs/specs folder for ${args.spec_ref} in the ` +
            `project or its spec worktrees — create the spec with ` +
            `lpwr-propose / lpwr-explore before journaling.`
          );
        }
        const written = await appendHandoff(
          root,
          resolved.dir,
          args.intent,
          args.spec_ref,
          args.artifact,
          args.confidence ?? "medium"
        );
        return `Recorded ${args.intent} handoff for ${args.spec_ref} in ${written}.`;
      } catch {
        return (
          `Failed to record handoff for ${args.spec_ref} — check ` +
          `docs/specs/ is writable; logging never breaks the loop.`
        );
      }
    },
  });

const evidenceLog = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    event: async (input) => {
      try {
        const { event } = input;
        if (event.type !== "command.executed") {
          return;
        }
        const props = event.properties as {
          name?: unknown;
          arguments?: unknown;
        };
        const name = typeof props.name === "string" ? props.name : "";
        const args = typeof props.arguments === "string" ? props.arguments : "";
        const command = commandName(name);
        if (!isCommand(command)) {
          return;
        }
        // Flag-skipping: a keyed command invoked with flags still journals on
        // its ID; prose first words that are not spec-shaped stay "invalid".
        const specRef = specIdArgument(args) ?? "";
        const resolved = await resolveSpecDir(root, specRef);
        if (resolved.status === "invalid") {
          // Unkeyed command (topic slug, path, prose) — out-of-process work.
          return;
        }
        if (resolved.status === "missing") {
          logWarn(
            plugin,
            "lpwr-log-handoffs",
            `no docs/specs folder for ${specRef} — auto-handoff for ${command} skipped (create the spec before journaling)`
          );
          return;
        }
        const artifact = COMMAND_ARTIFACTS[command];
        const folder = path.basename(resolved.dir);
        const pointer = artifact
          ? `docs/specs/${folder}/${artifact}`
          : `docs/specs/${folder}/`;
        await appendHandoff(
          root,
          resolved.dir,
          COMMAND_INTENTS[command],
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

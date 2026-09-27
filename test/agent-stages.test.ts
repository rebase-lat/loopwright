import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  AGENT_STAGES,
  STAGES,
  stagesIn,
} from "../harness/.opencode/lib/agent-stages.ts";
import { frontmatterBlock } from "../harness/.opencode/lib/gates.ts";

// Round 7 S7-02: the two prose documents that describe delegation — each
// agent's description line and orchestrator's Responsibilities section — had
// nothing checking them against each other or against the `Stage:` lines the
// commands actually declare. This locks the structured file as the source of
// truth for both directions: a description that stops matching its entry, or
// that names a stage without an entry, fails here. Sets compare unordered,
// which is the right semantics — stage order carries no meaning.

const AGENTS_DIR = path.resolve(
  import.meta.dirname,
  "../harness/.opencode/agents",
);
const COMMANDS_DIR = path.resolve(
  import.meta.dirname,
  "../harness/.opencode/commands",
);

const agentFiles = readdirSync(AGENTS_DIR).filter((file) =>
  file.endsWith(".md")
);

const descriptionOf = (agent: string): string => {
  const raw = readFileSync(path.join(AGENTS_DIR, `${agent}.md`), "utf-8");
  const frontmatter = frontmatterBlock(raw);
  assert.ok(frontmatter, `${agent}.md has frontmatter`);
  const line = frontmatter
    .split("\n")
    .find((candidate) =>
      candidate.trim().toLowerCase().startsWith("description:")
    );
  assert.ok(line, `${agent}.md has a description: line`);
  return line.slice(line.indexOf(":") + 1).trim();
};

for (const [agent, expected] of Object.entries(AGENT_STAGES)) {
  test(`agent-stages: ${agent} description matches AGENT_STAGES`, () => {
    assert.ok(
      agentFiles.includes(`${agent}.md`),
      `${agent}.md listed in AGENT_STAGES is missing from the agents directory`,
    );
    assert.deepEqual(
      new Set(stagesIn(descriptionOf(agent))),
      new Set(expected),
      `${agent}'s description: stage set drifted from AGENT_STAGES — update ` +
        `one of the two so the map stays the source of truth`,
    );
  });
}

test("agent-stages: agents with no entry name no stage", () => {
  for (const file of agentFiles) {
    const agent = file.replace(/\.md$/u, "");
    if (agent in AGENT_STAGES) {
      continue;
    }
    assert.deepEqual(
      stagesIn(descriptionOf(agent)),
      [],
      `${file} names a stage but has no AGENT_STAGES entry — either its ` +
        `description now lists stages (map it) or it describes the role by ` +
        `function (leave it out and reword)`,
    );
  }
});

test("agent-stages: orchestrator Responsibilities names every mapped agent", () => {
  const raw = readFileSync(path.join(AGENTS_DIR, "orchestrator.md"), "utf-8");
  const lines = raw.split("\n");
  const start = lines.findIndex((line) =>
    /^##\s+Responsibilities\s*$/u.test(line)
  );
  assert.notEqual(start, -1, "orchestrator.md has a Responsibilities section");
  const end = lines.findIndex(
    (line, index) => index > start && /^##\s/u.test(line)
  );
  const section = lines.slice(start, end === -1 ? undefined : end).join("\n");
  for (const agent of Object.keys(AGENT_STAGES)) {
    assert.ok(
      section.includes(`\`${agent}\``),
      `orchestrator.md Responsibilities does not name \`${agent}\`, but ` +
        `AGENT_STAGES maps it — the prose document is out of date`,
    );
  }
});

test("agent-stages: STAGES matches the Stage: lines commands declare", () => {
  const declared = new Set<string>();
  for (const file of readdirSync(COMMANDS_DIR)) {
    if (!file.endsWith(".md")) {
      continue;
    }
    const raw = readFileSync(path.join(COMMANDS_DIR, file), "utf-8");
    const match = /^Stage:\s*(?<stage>.+?)\s*$/mu.exec(raw);
    if (match?.groups?.stage) {
      declared.add(match.groups.stage.replace(/\.\s*$/u, ""));
    }
  }
  assert.deepEqual(
    declared,
    new Set(STAGES),
    "the stage vocabulary in agent-stages.ts has drifted from the Stage: " +
      "lines the command surface declares",
  );
});

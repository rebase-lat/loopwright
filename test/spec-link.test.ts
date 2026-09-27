import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import specLink from "../harness/.opencode/plugins/lpwr-spec-link.ts";

// Round 8 Wave 3: lpwr-spec-link's command gate had no test — only its
// receipt predicate did. These fixtures drive the real hook.
// Types come from the factory, not from `@opencode-ai/plugin`: the root and
// harness/.opencode copies are separate installs with unrelated PluginInput.

type Hooks = Awaited<ReturnType<typeof specLink>>;
type PluginArg = Parameters<typeof specLink>[0];

const plugin = (directory: string): PluginArg =>
  ({ directory }) as unknown as PluginArg;

const runImplement = async (hooks: Hooks, args: string): Promise<void> => {
  const before = hooks["command.execute.before"];
  assert.ok(before, "spec-link must register command.execute.before");
  await before(
    { arguments: args, command: "lpwr-implement", sessionID: "test" },
    { parts: [] }
  );
};

const root = (): string => mkdtempSync(path.join(tmpdir(), "lpwr-spec-link-"));

const writeSpec = (
  dir: string,
  status: string,
  basis: string,
  id = "auth-014"
): void => {
  const folder = path.join(dir, "docs/specs", id);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    path.join(folder, "spec.md"),
    `---\nid: ${id}\nstatus: ${status}\nrisk_tier: low\n` +
      `design_review: none\nbasis: ${basis}\nsupersedes: null\n` +
      `proposal_ref: docs/specs/${id}/proposal.md\n---\n\n# Spec: x\n`,
    "utf-8"
  );
};

const COMPLETE_RECEIPT =
  "## Checked against memory\n- Constitution: none relevant\n" +
  "- Lessons: none\n- Memos: none\n";

test("spec-link: refuses a missing or malformed spec id", async () => {
  const hooks = await specLink(plugin(root()));
  await assert.rejects(runImplement(hooks, ""), /requires a spec id/u);
  await assert.rejects(
    runImplement(hooks, "--fast"),
    /not a traceability ID/u
  );
});

test("spec-link: names the three causes when spec.md is missing", async () => {
  // No foundation: the first diagnosis wins (foundation before specs).
  const bare = await specLink(plugin(root()));
  await assert.rejects(
    runImplement(bare, "auth-014"),
    /missing docs\/context\.md and docs\/constitution\.md/u
  );

  // Foundation present, no worktree, no folder: unknown ID.
  const dir = root();
  mkdirSync(path.join(dir, "docs"), { recursive: true });
  writeFileSync(path.join(dir, "docs/context.md"), "x\n", "utf-8");
  writeFileSync(path.join(dir, "docs/constitution.md"), "x\n", "utf-8");
  const hooks = await specLink(plugin(dir));
  await assert.rejects(
    runImplement(hooks, "auth-014"),
    /spec auth-014 not found/u
  );
});

test("spec-link: blocks unapproved, blocked-in-state, and receipt gaps", async () => {
  // status: draft — the rule-2 floor.
  const draft = root();
  writeSpec(draft, "draft", "proposed");
  await assert.rejects(
    runImplement(await specLink(plugin(draft)), "auth-014"),
    /not approved yet/u
  );

  // Approved, but docs/state.md escalated it — implement must not route around.
  const escalated = root();
  writeSpec(escalated, "approved", "proposed");
  writeFileSync(
    path.join(escalated, "docs/state.md"),
    "## Done\n\n## Blocked\n- auth-014: waiting on the human\n",
    "utf-8"
  );
  await assert.rejects(
    runImplement(await specLink(plugin(escalated)), "auth-014"),
    /Blocked section/u
  );

  // basis: proposed with no proposal.md.
  const noProposal = root();
  writeSpec(noProposal, "approved", "proposed");
  await assert.rejects(
    runImplement(await specLink(plugin(noProposal)), "auth-014"),
    /has no docs\/specs\/auth-014\/proposal\.md/u
  );

  // proposal.md present but the motion's memory receipt is unfilled.
  const noReceipt = root();
  writeSpec(noReceipt, "approved", "proposed");
  writeFileSync(
    path.join(noReceipt, "docs/specs/auth-014/proposal.md"),
    "## Motion\n\n### Checked against memory\n- Constitution: \n",
    "utf-8"
  );
  await assert.rejects(
    runImplement(await specLink(plugin(noReceipt)), "auth-014"),
    /memory receipt is incomplete/u
  );
});

test("spec-link: passes on an approved observed spec and a complete receipt", async () => {
  // basis: observed — no proposal by design (lpwr-explore drafts).
  const observed = root();
  writeSpec(observed, "approved", "observed");
  await runImplement(await specLink(plugin(observed)), "auth-014");

  // basis: proposed with a complete receipt.
  const proposed = root();
  writeSpec(proposed, "approved", "proposed");
  writeFileSync(
    path.join(proposed, "docs/specs/auth-014/proposal.md"),
    `## Motion\n\n${COMPLETE_RECEIPT}`,
    "utf-8"
  );
  await runImplement(await specLink(plugin(proposed)), "auth-014");
});

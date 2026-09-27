import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import verdictGate from "../harness/.opencode/plugins/lpwr-verdict-gate.ts";

// Round 8 Wave 3: lpwr-verdict-gate's orchestration (the order its checks run
// in, and which one reports first) had no fixture — only lib/gates.ts's pure
// predicates did. These drive the real command hook against on-disk fixtures.
// Types come from the factory, not from `@opencode-ai/plugin`: the root and
// harness/.opencode copies are separate installs with unrelated PluginInput.

type Hooks = Awaited<ReturnType<typeof verdictGate>>;
type PluginArg = Parameters<typeof verdictGate>[0];

const plugin = (directory: string): PluginArg =>
  ({ directory }) as unknown as PluginArg;

const runCommand = async (
  hooks: Hooks,
  command: string,
  args: string
): Promise<void> => {
  const before = hooks["command.execute.before"];
  assert.ok(before, `${command} must register command.execute.before`);
  await before({ arguments: args, command, sessionID: "test" }, { parts: [] });
};

const runBash = async (hooks: Hooks, command: string): Promise<void> => {
  const before = hooks["tool.execute.before"];
  assert.ok(before, "verdict-gate must register tool.execute.before");
  await before(
    { callID: "c1", sessionID: "test", tool: "bash" },
    { args: { command } }
  );
};

interface Fixture {
  readonly deploy?: boolean;
  readonly spec?: boolean;
  readonly specTier?: string;
  readonly state?: string;
  readonly review?: string | null;
  readonly reviewTier?: string;
  readonly verdict?: string;
  readonly rows?: readonly string[];
  readonly waived?: string;
  readonly log?: boolean;
}

const SPEC_FM = (tier: string): string =>
  `---\nid: auth-014\nstatus: approved\nrisk_tier: ${tier}\n` +
  "design_review: none\nbasis: proposed\nsupersedes: null\n" +
  "proposal_ref: docs/specs/auth-014/proposal.md\n---\n\n# Spec: x\n\n" +
  "## Acceptance criteria → test binding\n" +
  "| Criterion ID | Test reference (filled by lpwr-implement) |\n" +
  "| --- | --- |\n| auth-014-1 | test/a.test.ts |\n";

const REVIEW = (options: {
  tier: string;
  verdict: string;
  rows: readonly string[];
  waived: string;
}): string =>
  `---\nid: auth-014\ndate: 2026-09-27\ndiff_ref: HEAD (uncommitted)\n` +
  `risk_tier: ${options.tier}\nwaived: ${options.waived}\ndeferred: none\n---\n\n` +
  "# Review: x\n\n## Standards axis\n" +
  "- [x] Passes linter / formatter / CI gate named in constitution.md\n" +
  "- Notes: none\n\n## Specs axis\n" +
  "| Criterion ID | Test reference | Pass? |\n| --- | --- | --- |\n" +
  `${options.rows.join("\n")}\n\n## Security axis\n` +
  "- [x] Audit findings reviewed (or scan clean), no unresolved secrets\n" +
  "- [x] Constitution's security floors are met\n" +
  "- [x] Risk tier still looks correct given the actual diff\n" +
  "- [x] Threat review in place where required\n" +
  "- Notes: none\n\n## Verdict\n" +
  `${options.verdict}\n- Reasoning: ok\n`;

const workspace = (fixture: Fixture = {}): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "lpwr-verdict-gate-"));
  const folder = path.join(dir, "docs/specs/auth-014");
  mkdirSync(folder, { recursive: true });
  if (fixture.spec !== false) {
    writeFileSync(
      path.join(folder, "spec.md"),
      SPEC_FM(fixture.specTier ?? "low"),
      "utf-8"
    );
  }
  if (fixture.review !== null) {
    writeFileSync(
      path.join(folder, "review.md"),
      fixture.review ??
        REVIEW({
          rows: fixture.rows ?? ["| auth-014-1 | test/a.test.ts | yes |"],
          tier: fixture.reviewTier ?? fixture.specTier ?? "low",
          verdict: fixture.verdict ?? "- [x] Ship  [ ] Block  [ ] Redirect",
          waived: fixture.waived ?? "none",
        }),
      "utf-8"
    );
  }
  if (fixture.log !== false) {
    const handoff = JSON.stringify({
      confidence: "high",
      intent: "execute",
      payload: { type: "artifact_pointer", value: "auth-014-1" },
      spec_ref: "auth-014",
      ts: "2026-09-27T00:00:00.000Z",
    });
    writeFileSync(
      path.join(folder, "log.ndjson"),
      `${handoff}\n`,
      "utf-8"
    );
  }
  if (fixture.state) {
    writeFileSync(path.join(dir, "docs/state.md"), fixture.state, "utf-8");
  }
  if (fixture.deploy) {
    writeFileSync(
      path.join(dir, "docs/constitution.md"),
      "# Constitution\n\nAudit command: npm audit --audit-level=high\n" +
        "Deploy command: npm run deploy\n",
      "utf-8"
    );
  }
  return dir;
};

test("verdict-gate: no review, no verdict section, non-ship verdict", async () => {
  const none = await verdictGate(plugin(workspace({ review: null })));
  await assert.rejects(
    runCommand(none, "lpwr-commit", "auth-014"),
    /no review\.md for auth-014/u
  );

  const noSection = await verdictGate(
    plugin(workspace({ review: "# Review: x\n\nno verdict here\n" }))
  );
  await assert.rejects(
    runCommand(noSection, "lpwr-commit", "auth-014"),
    /no Verdict section/u
  );

  const blocked = await verdictGate(
    plugin(
      workspace({ verdict: "- [ ] Ship  [x] Block  [ ] Redirect" })
    )
  );
  await assert.rejects(
    runCommand(blocked, "lpwr-commit", "auth-014"),
    /no recorded "ship" verdict/u
  );
});

test("verdict-gate: incomplete acceptance table blocks the ship claim", async () => {
  const missingRef = await verdictGate(
    plugin(workspace({ rows: ["| auth-014-1 |  |  |"] }))
  );
  await assert.rejects(
    runCommand(missingRef, "lpwr-commit", "auth-014"),
    /lacks a test reference/u
  );

  // Marked waived in the table but not listed in frontmatter — the silent
  // skip is a miss, not a waiver (implementation-rules 7).
  const silent = await verdictGate(
    plugin(workspace({ rows: ["| auth-014-1 |  | waived |"] }))
  );
  await assert.rejects(
    runCommand(silent, "lpwr-commit", "auth-014"),
    /not listed under waived:/u
  );
});

test("verdict-gate: cross-file checks — tier mismatch and Blocked escalation", async () => {
  const mismatch = await verdictGate(
    plugin(workspace({ reviewTier: "low", specTier: "high" }))
  );
  await assert.rejects(
    runCommand(mismatch, "lpwr-commit", "auth-014"),
    /risk_tier mismatch/u
  );

  const escalated = await verdictGate(
    plugin(
      workspace({
        state: "## Done\n\n## Blocked\n- auth-014: waiting on the human\n",
      })
    )
  );
  await assert.rejects(
    runCommand(escalated, "lpwr-commit", "auth-014"),
    /Blocked section/u
  );
});

test("verdict-gate: commit passes the full chain; amend refuses post-ship", async () => {
  const hooks = await verdictGate(plugin(workspace()));
  await runCommand(hooks, "lpwr-commit", "auth-014");

  // No upstream handoff in the journal is out-of-process work (the commit
  // gate's step 2): log missing entirely counts the same as retain-only.
  const retainOnly = await verdictGate(plugin(workspace({ log: false })));
  await assert.rejects(
    runCommand(retainOnly, "lpwr-commit", "auth-014"),
    /no non-retain handoff/u
  );

  // lpwr-amend: Done in state.md means the ID shipped — amend is pre-commit.
  const shipped = await verdictGate(
    plugin(workspace({ state: "## Done\n- auth-014: shipped\n" }))
  );
  await assert.rejects(
    runCommand(shipped, "lpwr-amend", "auth-014 widen the surface"),
    /already shipped/u
  );
});

test("verdict-gate: a spec edited after review diverges from its tables", async () => {
  // The tables are the review's only binding to the spec (no hash): move a
  // test reference after review and commit must refuse.
  const renamed = workspace();
  writeFileSync(
    path.join(renamed, "docs/specs/auth-014/spec.md"),
    SPEC_FM("low").replace(
      "| auth-014-1 | test/a.test.ts |",
      "| auth-014-1 | test/renamed.test.ts |"
    ),
    "utf-8"
  );
  await assert.rejects(
    runCommand(await verdictGate(plugin(renamed)), "lpwr-commit", "auth-014"),
    /cites test\/renamed\.test\.ts in spec\.md but test\/a\.test\.ts in review\.md/u
  );

  // A criterion the review never saw is the same class of drift.
  const added = workspace();
  writeFileSync(
    path.join(added, "docs/specs/auth-014/spec.md"),
    `${SPEC_FM("low")}| auth-014-2 | test/extra.test.ts |\n`,
    "utf-8"
  );
  await assert.rejects(
    runCommand(await verdictGate(plugin(added)), "lpwr-commit", "auth-014"),
    /criterion auth-014-2 is in spec\.md but was never reviewed/u
  );
});

test("verdict-gate: deploy runs only inside an open lpwr-release window", async () => {
  const dir = workspace({ deploy: true });
  const hooks = await verdictGate(plugin(dir));

  // Outside any release: the declared deploy command is refused, with flags
  // and inside a compound command too.
  await assert.rejects(
    runBash(hooks, "npm run deploy"),
    /may only run inside lpwr-release/u
  );
  await assert.rejects(
    runBash(hooks, "cd . && npm run deploy -- --tag x"),
    /may only run inside lpwr-release/u
  );
  // Anything that is not the deploy command is untouched.
  await runBash(hooks, "npm run build");

  // lpwr-release passes its gate → the window opens → deploy is allowed.
  await runCommand(hooks, "lpwr-release", "auth-014");
  await runBash(hooks, "npm run deploy");

  // Any later command closes the window again.
  await runCommand(hooks, "lpwr-guide", "");
  await assert.rejects(
    runBash(hooks, "npm run deploy"),
    /may only run inside lpwr-release/u
  );
});

test("verdict-gate: no declared Deploy command means nothing to gate", async () => {
  const dir = workspace();
  writeFileSync(
    path.join(dir, "docs/constitution.md"),
    "# Constitution\n\nAudit command: npm audit --audit-level=high\n",
    "utf-8"
  );
  await runBash(await verdictGate(plugin(dir)), "npm run deploy");
});

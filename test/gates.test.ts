import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptanceTablesDiverge,
  approvedSpecEdit,
  checkTierMismatch,
  constitutionCommands,
  declaredSurfaceFrom,
  normalizeGlob,
  overlaps,
  parseDeferred,
  parseWaived,
  receiptIncomplete,
  securityAxisComplete,
  specDirNames,
  tableComplete,
  templateLeftovers,
  threatAccepted,
  verdictCheck,
} from "../harness/.opencode/lib/gates.ts";

// Round 3 D1: pure gate predicates exercised directly. These are the exact
// functions the enforcing plugins import, so a regression in a gate fails a
// named fixture instead of being caught ad hoc.

const review = (rows: string[], front = "waived: none"): string =>
  `---\n${front}\ndeferred: none\n---\n\n## Specs axis\n` +
  `| Criterion ID | Test reference | Pass? |\n| --- | --- | --- |\n${rows.join("\n")}\n`;

test("parseWaived: empty markers and lists", () => {
  assert.equal(parseWaived("waived: none").size, 0);
  assert.equal(parseWaived("waived: []").size, 0);
  assert.deepEqual(
    [...parseWaived("waived: auth-014-1, auth-014-2")],
    ["auth-014-1", "auth-014-2"]
  );
  assert.deepEqual(
    [...parseWaived("waived: [auth-014-1, auth-014-2]")],
    ["auth-014-1", "auth-014-2"]
  );
  // Format-hint comment must not become a phantom waiver id.
  assert.equal(parseWaived("waived: none # criterion IDs, comma-separated").size, 0);
});

test("parseDeferred: target mapping and format error", () => {
  const ok = parseDeferred("deferred: auth-014-3 -> auth-020");
  assert.equal(ok.error, undefined);
  assert.equal(ok.targets.get("auth-014-3"), "auth-020");
  assert.equal(parseDeferred("deferred: none").targets.size, 0);
  assert.ok(parseDeferred("deferred: auth-014-3").error);
});

test("tableComplete: passing, missing ref, waived, unknown waiver", () => {
  assert.equal(
    tableComplete(review(["| auth-014-1 | test/a.test.ts | yes |"])).ok,
    true
  );
  assert.equal(
    tableComplete(review(["| auth-014-1 |  |  |"])).ok,
    false
  );
  assert.equal(
    tableComplete(
      review(["| auth-014-1 |  |  |"], "waived: auth-014-1")
    ).ok,
    true
  );
  const unknown = tableComplete(
    review(["| auth-014-1 | test/a.test.ts | yes |"], "waived: auth-014-9")
  );
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason ?? "", /unknown criterion/u);
  assert.equal(tableComplete(review([])).ok, false);
});

test("verdictCheck: exactly one of ship/block/redirect", () => {
  assert.equal(
    verdictCheck("## Verdict\n- [x] Ship  [ ] Block  [ ] Redirect").ok,
    true
  );
  assert.equal(
    verdictCheck("## Verdict\n- [ ] Ship  [ ] Block  [ ] Redirect").ok,
    false
  );
  assert.equal(
    verdictCheck("## Verdict\n- [x] Ship  [x] Block  [ ] Redirect").ok,
    false
  );
  assert.equal(
    verdictCheck("## Verdict\n- [ ] Ship  [x] Block  [ ] Redirect").ok,
    false
  );
  assert.equal(verdictCheck("no verdict section here").ok, false);
});

test("securityAxisComplete: no unchecked boxes", () => {
  assert.equal(
    securityAxisComplete("## Security axis\n- [x] a\n- [x] b\n"),
    true
  );
  assert.equal(
    securityAxisComplete("## Security axis\n- [x] a\n- [ ] b\n"),
    false
  );
  assert.equal(securityAxisComplete("## Verdict\n- [x] Ship\n"), false);
});

test("threatAccepted: single Acceptable to proceed", () => {
  assert.equal(
    threatAccepted(
      "## Verdict\n- [x] Acceptable to proceed  [ ] Needs changes before proceeding"
    ),
    true
  );
  assert.equal(
    threatAccepted(
      "## Verdict\n- [x] Acceptable to proceed  [x] Needs changes before proceeding"
    ),
    false
  );
});

test("templateLeftovers: code spans and comments are not placeholders", () => {
  assert.equal(templateLeftovers("see `docs/specs/<id>/audit.md`"), null);
  assert.equal(templateLeftovers("waived: none # <criterion-ids>"), null);
  assert.equal(templateLeftovers("title: <title>"), "<title>");
});

test("receiptIncomplete: presence, fill, and placeholder detection", () => {
  const complete =
    "## Checked against memory\n- Constitution: none relevant\n" +
    "- Lessons: none\n- Memos: none\n";
  assert.equal(receiptIncomplete(complete), null);
  assert.match(
    receiptIncomplete("## Motion\n### Dissent\n- none") ?? "",
    /no "Checked against memory" heading/u
  );
  assert.match(
    receiptIncomplete("## Checked against memory\n- Constitution: none\n") ?? "",
    /missing "Lessons:"/u
  );
  assert.match(
    receiptIncomplete(
      "## Checked against memory\n- Constitution: none\n- Lessons: none\n" +
        "- Memos: `docs/memos/<topic>.md`\n"
    ) ?? "",
    /placeholder/u
  );
});

test("overlaps: exact, prefix, glob, and disjoint paths", () => {
  assert.equal(overlaps("src/a.ts", "src/a.ts"), true);
  assert.equal(overlaps("src/**", "src"), true);
  assert.equal(overlaps("src", "src/a.ts"), true);
  assert.equal(overlaps("src/a.ts", "src/b.ts"), false);
  assert.equal(normalizeGlob("./src/lib/**"), "src/lib");
});

test("declaredSurfaceFrom: surface bullets, with Tasks-backtick fallback", () => {
  const withSurface =
    "## Tasks\n1. [ ] x — satisfies a-1\n### Declared surface\n" +
    "- `src/a.ts`\n- `src/lib/**`\n- `<file-or-glob>`\n";
  assert.deepEqual(declaredSurfaceFrom(withSurface), [
    "src/a.ts",
    "src/lib/**",
  ]);
  const fallback =
    "## Tasks\n1. [ ] touch `src/b.ts` — satisfies a-1\n";
  assert.deepEqual(declaredSurfaceFrom(fallback), ["src/b.ts"]);
  assert.deepEqual(declaredSurfaceFrom("# Spec: nothing declared\n"), []);
});

test("specDirNames: spec and criterion refs, slugs and prose refused", () => {
  assert.deepEqual(specDirNames("auth-014"), ["auth-014"]);
  // Criterion refs prefer their own folder, then the parent spec folder.
  assert.deepEqual(specDirNames("auth-014-1"), ["auth-014-1", "auth-014"]);
  // Id-shaped topic slugs yield only their own name; when no folder exists
  // anywhere, the journal refuses instead of mkdir-ing a phantom
  // docs/specs entry (S5-04).
  assert.deepEqual(specDirNames("null-pointer-500"), ["null-pointer-500"]);
  assert.deepEqual(specDirNames("login-2"), ["login-2"]);
  assert.deepEqual(specDirNames("login"), []);
  assert.deepEqual(specDirNames("Auth-014"), []);
  assert.deepEqual(specDirNames("docs/context.md"), []);
});

// Round 8 Wave 4: the frozen-spec and review↔spec binding predicates.
const approvedSpec = (options?: {
  rows?: string;
  status?: string;
  title?: string;
  tier?: string;
}): string => {
  const status = options?.status ?? "approved";
  const rows = options?.rows ?? "| auth-014-1 |  |";
  const title = options?.title ?? "# Spec";
  const tier = options?.tier ?? "low";
  return (
    `---\nid: auth-014\nstatus: ${status}\nrisk_tier: ${tier}\n---\n\n` +
    `${title}\n\n## Acceptance criteria → test binding\n` +
    `| Criterion ID | Test reference |\n| --- | --- |\n${rows}\n\n` +
    `## Tasks\n1. [ ] x\n`
  );
};

test("constitutionCommands: audit/deploy lines, placeholders and CRLF", () => {
  const raw =
    "# C\n\nAudit command: npm audit --audit-level=high\n" +
    "Audit command: pip-audit\n" +
    "Deploy command: <one command that ships>\n";
  assert.deepEqual(constitutionCommands(raw, "audit command"), [
    "npm audit --audit-level=high",
    "pip-audit",
  ]);
  // Template placeholders declare nothing.
  assert.deepEqual(constitutionCommands(raw, "deploy command"), []);
  assert.deepEqual(constitutionCommands(raw, "release command"), []);
  assert.deepEqual(
    constitutionCommands("Deploy command: npm run deploy\r\n", "deploy command"),
    ["npm run deploy"]
  );
});

test("approvedSpecEdit: test refs pass, everything else is lpwr-amend", () => {
  const current = approvedSpec();
  // Filling the test-reference cell is Execute's own job.
  assert.equal(
    approvedSpecEdit(current, approvedSpec({ rows: "| auth-014-1 | test/x |" })),
    null
  );
  // The amend door: status flips alone.
  assert.equal(
    approvedSpecEdit(current, approvedSpec({ status: "draft" })),
    null
  );
  // A flip that smuggles other changes through.
  assert.match(
    approvedSpecEdit(
      current,
      approvedSpec({ status: "draft", title: "# Spec: renamed" })
    ) ?? "",
    /must not carry other changes/u
  );
  // Changes outside the table.
  assert.match(
    approvedSpecEdit(current, approvedSpec({ title: "# Spec: renamed" })) ?? "",
    /outside the acceptance table/u
  );
  assert.match(
    approvedSpecEdit(current, approvedSpec({ tier: "high" })) ?? "",
    /outside the acceptance table/u
  );
  // The criterion list itself.
  assert.match(
    approvedSpecEdit(current, approvedSpec({ rows: "| auth-014-1 |  |\n| auth-014-2 |  |" })) ?? "",
    /criterion list changed/u
  );
  // A draft spec is not frozen at all.
  const draft = approvedSpec({ status: "draft" });
  assert.equal(approvedSpecEdit(draft, approvedSpec({ title: "# X" })), null);
});

const reviewTable = (rows: string): string =>
  `## Standards axis\n- [x] ok\n\n## Specs axis\n` +
  `| Criterion ID | Test reference | Pass? |\n| --- | --- | --- |\n${rows}\n\n` +
  `## Verdict\n- [x] Ship\n`;

test("acceptanceTablesDiverge: the review's only binding to the spec", () => {
  const spec = (rows: string): string =>
    approvedSpec({ rows });
  assert.equal(
    acceptanceTablesDiverge(spec("| auth-014-1 | test/a |"), reviewTable("| auth-014-1 | test/a | yes |")),
    null
  );
  // Two present, disagreeing references.
  assert.match(
    acceptanceTablesDiverge(
      spec("| auth-014-1 | test/renamed |"),
      reviewTable("| auth-014-1 | test/a | yes |")
    ) ?? "",
    /cites test\/renamed in spec\.md but test\/a in review\.md/u
  );
  // Criterion added after review.
  assert.match(
    acceptanceTablesDiverge(
      spec("| auth-014-1 | test/a |\n| auth-014-2 | test/b |"),
      reviewTable("| auth-014-1 | test/a | yes |")
    ) ?? "",
    /auth-014-2 is in spec\.md but was never reviewed/u
  );
  // Criterion dropped after review.
  assert.match(
    acceptanceTablesDiverge(
      spec("| auth-014-1 | test/a |"),
      reviewTable("| auth-014-1 | test/a | yes |\n| auth-014-2 |  | deferred |")
    ) ?? "",
    /auth-014-2 was reviewed but is no longer in spec\.md/u
  );
  // A blank cell on either side (waived/deferred) is not drift.
  assert.equal(
    acceptanceTablesDiverge(spec("| auth-014-1 |  |"), reviewTable("| auth-014-1 |  | waived |")),
    null
  );
  // Missing tables.
  assert.match(
    acceptanceTablesDiverge("# Spec: no table\n", reviewTable("| auth-014-1 | test/a | yes |")) ?? "",
    /has no acceptance table/u
  );
  assert.match(
    acceptanceTablesDiverge(spec("| auth-014-1 | test/a |"), "# Review\n") ?? "",
    /no Specs axis table/u
  );
});

// Round 7 C: the tier signal is advisory, so what matters is (a) it fires on
// the three escalation shapes for a non-high tier, (b) it never fires for
// `high`, and (c) it is stateless — the patterns are tested through `.test`,
// so an accidental `g` flag would make the second call on the same diff miss.
test("checkTierMismatch: fires on each escalation signal for a low tier", () => {
  assert.equal(
    checkTierMismatch('const res = await fetch("/api");', "low"),
    "a new external network call"
  );
  assert.equal(
    checkTierMismatch("client.get('https://api.example.com/v1')", "medium"),
    "a new external network call"
  );
  assert.equal(
    checkTierMismatch("permissions: read", "low"),
    "a permissions/ACL change"
  );
  assert.equal(
    checkTierMismatch('require("child_process").exec(cmd)', "low"),
    "a new shell/process invocation"
  );
  assert.equal(checkTierMismatch("spawn(worker)", "medium"), "a new shell/process invocation");
});

test("checkTierMismatch: high is already at the top", () => {
  assert.equal(
    checkTierMismatch('await fetch("https://api.example.com")', "high"),
    null
  );
});

test("checkTierMismatch: a diff with no signal says nothing", () => {
  assert.equal(
    checkTierMismatch("export const add = (a: number, b: number) => a + b;", "low"),
    null
  );
  // A `https` protocol word with no `://` is not a network call, and `fetch`
  // not called is not one either.
  assert.equal(checkTierMismatch("const httpsStatus = 200;", "medium"), null);
  assert.equal(checkTierMismatch("const fetch = loadFromCache();", "low"), null);
});

test("checkTierMismatch: stateless across repeated calls", () => {
  const diff = 'const x = await fetch("https://api.example.com");';
  assert.equal(checkTierMismatch(diff, "low"), "a new external network call");
  assert.equal(checkTierMismatch(diff, "low"), "a new external network call");
  assert.equal(checkTierMismatch(diff, "high"), null);
  assert.equal(checkTierMismatch(diff, "high"), null);
});

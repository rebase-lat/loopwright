import assert from "node:assert/strict";
import test from "node:test";

import {
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

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EXPECTED,
  REQUIRED_DEPS,
  mergeConfig,
  parseJsonc,
  unionGitignore,
} from "../harness/.opencode/lib/installer-lib.mjs";
import { EXPECTED as SHARED_EXPECTED } from "../harness/.opencode/lib/shared.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const LW = path.join(REPO, "loopwright.sh");

const temps = [];
const tempDir = (label) => {
  const dir = mkdtempSync(path.join(tmpdir(), `lpwr-${label}-`));
  temps.push(dir);
  return dir;
};

test.after(() => {
  for (const dir of temps) {rmSync(dir, { force: true, recursive: true });}
});

const sh = (args) =>
  spawnSync("bash", [LW, ...args], { encoding: "utf-8", timeout: 120_000 });

const output = (r) => `${r.stdout}\n${r.stderr}`;

const appendFileSync = (file, text) => {
  writeFileSync(file, `${readFileSync(file, "utf-8")}${text}`);
};

const expectStatus = (r, want, label) =>
  assert.equal(r.status, want, `${label}\nexit ${r.status}, want ${want}\n${output(r)}`);

const makePayload = (dir) => {
  mkdirSync(dir, { recursive: true });
  const listed = spawnSync(
    "git",
    ["-C", REPO, "ls-files", "-z", "--cached", "--others", "--exclude-standard",
      "--", "harness", "CHANGELOG.md", "loopwright.sh"],
    { encoding: "utf-8" }
  );
  assert.equal(listed.status, 0, listed.stderr);
  const files = listed.stdout.split("\0").filter(Boolean);
  for (const rel of files) {
    const src = path.join(REPO, rel);
    if (!existsSync(src)) {continue;}
    const dst = path.join(dir, rel);
    mkdirSync(path.dirname(dst), { recursive: true });
    copyFileSync(src, dst);
  }
  assert.ok(existsSync(path.join(dir, "harness", "opencode.json")), "payload staged");
  return dir;
};

const makeProject = (label = "proj") => {
  const dir = tempDir(label);
  expectStatus(spawnSync("git", ["-C", dir, "init", "-q"]), 0, "git init");
  return dir;
};

const stubDeps = (project) => {
  for (const dep of REQUIRED_DEPS) {
    const dir = path.join(project, ".opencode", "node_modules", dep);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "package.json"), `${JSON.stringify({ name: dep })}\n`);
  }
};

const materializeFoundation = (project) => {
  for (const name of ["constitution", "context", "state", "audit"]) {
    mkdirSync(path.join(project, "docs"), { recursive: true });
    copyFileSync(
      path.join(REPO, "harness", "templates", `${name}.md`),
      path.join(project, "docs", `${name}.md`)
    );
  }
  // lpwr-install also ensures the shared memo dir (no template ships for it).
  mkdirSync(path.join(project, "docs", "memos"), { recursive: true });
};

const manifest = (project) =>
  JSON.parse(readFileSync(path.join(project, ".loopwright", "manifest.json"), "utf-8"));

const mutatePayload = (payload, rel, text) => {
  const file = path.join(payload, "harness", rel);
  writeFileSync(file, text);
};

test("installer-lib mirrors shared.ts EXPECTED and package.json dependencies", () => {
  const shared = SHARED_EXPECTED.map(([rel, hint]) => `${rel}\t${hint}`);
  const lib = EXPECTED.map(([rel, hint]) => `${rel}\t${hint}`);
  assert.deepEqual(lib, shared);
  const pkg = JSON.parse(
    readFileSync(path.join(REPO, "harness", ".opencode", "package.json"), "utf-8")
  );
  assert.deepEqual(REQUIRED_DEPS.toSorted(), Object.keys(pkg.dependencies).toSorted());
});

test("lib: parseJsonc, mergeConfig, unionGitignore behaviors", () => {
  const parsed = parseJsonc('{\n  // note\n  "a": 1, /* x */\n  "b": [1, 2,],\n}');
  assert.deepEqual(parsed, { a: 1, b: [1, 2] });

  const theirs = `{
  "$schema": "https://opencode.ai/config.json",
  // harness comment
  "instructions": ["AGENTS.md"],
  "default_agent": "orchestrator",
  "agent": { "build": { "disable": true } }
}`;
  const ours = `{
  // project comment
  "mcp": { "grep": {} },
  "instructions": ["CONTRIBUTING.md"],
  "default_agent": "build",
  "agent": { "custom": { "description": "mine" } }
}`;
  const fresh = mergeConfig({ oursText: ours, theirsText: theirs });
  const out = parseJsonc(fresh.text);
  assert.deepEqual(out.mcp, { grep: {} }, "project keys survive");
  assert.equal(out.default_agent, "orchestrator", "harness wins on install");
  assert.deepEqual(out.instructions, ["CONTRIBUTING.md", "AGENTS.md"], "union");
  assert.deepEqual(out.agent.custom, { description: "mine" }, "custom agent survives");
  assert.match(fresh.text, /\/\/ project comment/u, "project comment preserved");
  assert.ok(fresh.conflicts.some((c) => c.startsWith("default_agent")), "conflict noted");
  assert.ok(!fresh.conflicts.some((c) => c.startsWith("mcp")), "no conflict for own keys");

  const variant = mergeConfig({
    instructionsName: "AGENTS.lpwr.md",
    oursText: ours,
    theirsText: theirs,
  });
  assert.deepEqual(parseJsonc(variant.text).instructions, [
    "CONTRIBUTING.md",
    "AGENTS.lpwr.md",
  ]);

  const base = theirs;
  const edited = ours.replace('"description": "mine"', '"description": "edited"');
  const threeWay = mergeConfig({
    baseText: base,
    oursText: edited,
    theirsText: base,
  });
  assert.equal(
    parseJsonc(threeWay.text).default_agent,
    "build",
    "upstream unchanged, local edit kept"
  );
  assert.equal(
    parseJsonc(threeWay.text).agent.custom.description,
    "edited",
    "nested local edit kept"
  );

  const g = unionGitignore("node_modules/\nsecrets/\n", "build/\nnode_modules/\n");
  assert.equal(g, "build/\nnode_modules/\nsecrets/\n");
  assert.equal(unionGitignore("a\n", "a\n"), "a\n", "idempotent");
});

test("install: fresh project, guards, dry-run, then green doctor", () => {
  const payload = makePayload(tempDir("payload-i"));
  const project = makeProject("install");
  const base = ["--project", project, "--source", "local", payload, "--version", "1.0.0", "--offline"];

  sh(["install", ...base, "--dry-run", "--no-deps", "--no-opencode"]);
  assert.ok(!existsSync(path.join(project, ".loopwright")), "dry-run writes nothing");

  const nested = makeProject("nested");
  mkdirSync(path.join(nested, "harness", ".opencode", "lib"), { recursive: true });
  writeFileSync(path.join(nested, "harness", ".opencode", "lib", "shared.ts"), "");
  writeFileSync(path.join(nested, "integration-analysis.md"), "");
  const refused = sh(["install", "--project", nested, "--source", "local", payload,
    "--version", "1.0.0", "--no-deps"]);
  assert.notEqual(refused.status, 0, "nested install refused");
  assert.match(output(refused), /nested install/u);

  const installed = sh(["install", ...base, "--no-deps", "--no-opencode"]);
  expectStatus(installed, 1, "install with --no-deps exits 1 (deps not installed)");
  assert.ok(existsSync(path.join(project, "AGENTS.md")), "AGENTS.md installed");
  assert.ok(existsSync(path.join(project, ".loopwright", "manifest.json")), "manifest");
  assert.ok(existsSync(path.join(project, ".opencode", "lib", "installer-lib.mjs")), "lib");
  assert.equal(manifest(project).agents_file, "AGENTS.md");
  assert.match(
    readFileSync(path.join(project, ".gitignore"), "utf-8"),
    /\.loopwright\/cache\//u,
    "installer state ignored"
  );
  assert.match(readFileSync(path.join(project, "opencode.json"), "utf-8"), /"default_agent"/u);

  const again = sh(["install", ...base, "--no-deps", "--no-opencode"]);
  assert.notEqual(again.status, 0, "second install refused");
  assert.match(output(again), /already installed/u);

  stubDeps(project);
  materializeFoundation(project);
  const doctor = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(doctor, 0, "green doctor on materialized project");
  assert.match(doctor.stdout, /all checks passed/u);

  const json = sh(["doctor", "--project", project, "--offline", "--no-opencode", "--json"]);
  expectStatus(json, 0, "json doctor");
  const report = JSON.parse(json.stdout);
  assert.equal(report.counts.error, 0);

  const notInstalled = sh(["doctor", "--project", tempDir("none"), "--offline"]);
  expectStatus(notInstalled, 2, "doctor exit 2 when not installed");
  const status = sh(["status", "--project", tempDir("none2"), "--offline"]);
  expectStatus(status, 2, "status exit 2 when not installed");
});

test("install: pre-existing AGENTS.md keeps original, variant carries protocol", () => {
  const payload = makePayload(tempDir("payload-a"));
  const project = makeProject("agents");
  writeFileSync(path.join(project, "AGENTS.md"), "# team rules\n");
  writeFileSync(
    path.join(project, "opencode.json"),
    '{\n  "instructions": ["CONTRIBUTING.md"]\n}\n'
  );
  writeFileSync(path.join(project, "CONTRIBUTING.md"), "hi\n");
  const r = sh(["install", "--project", project, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);
  expectStatus(r, 1, "install with variant exits 1 (deps not installed)");
  assert.equal(readFileSync(path.join(project, "AGENTS.md"), "utf-8"), "# team rules\n",
    "original AGENTS.md untouched");
  assert.ok(existsSync(path.join(project, "AGENTS.lpwr.md")), "variant written");
  assert.equal(manifest(project).agents_file, "AGENTS.lpwr.md");
  const cfg = parseJsonc(readFileSync(path.join(project, "opencode.json"), "utf-8"));
  assert.deepEqual(cfg.instructions, ["CONTRIBUTING.md", "AGENTS.lpwr.md"]);
  assert.match(readFileSync(path.join(project, "AGENTS.lpwr.md"), "utf-8"), /Loopwright Harness/u);
});

test("update: 3-way keeps local edits, applies upstream, prunes, adds", () => {
  const payload = makePayload(tempDir("payload-u"));
  const project = makeProject("update");
  sh(["install", "--project", project, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);

  const v2 = tempDir("payload-u2");
  makePayload(v2);
  const localReview = path.join(project, ".opencode", "commands", "lpwr-review.md");
  writeFileSync(localReview, `LOCAL\n${readFileSync(localReview, "utf-8")}`);
  mutatePayload(v2, ".opencode/commands/lpwr-review.md",
    `${readFileSync(path.join(v2, "harness", ".opencode", "commands", "lpwr-review.md"), "utf-8")}\nUPSTREAM\n`);
  mutatePayload(v2, ".opencode/commands/lpwr-guide.md",
    `${readFileSync(path.join(v2, "harness", ".opencode", "commands", "lpwr-guide.md"), "utf-8")}\nGUIDE V2\n`);
  writeFileSync(path.join(v2, "harness", ".opencode", "skills", "lpwr-voice", "EXTRA.md"), "x\n");
  rmSync(path.join(v2, "harness", "docs", "glossary.md"));

  const r = sh(["update", "--project", project, "--source", "local", v2,
    "--version", "2.0.0", "--offline", "--no-deps", "--no-opencode"]);
  expectStatus(r, 1, "update exit (foundation suggestions are soft? warn?)");
  const review = readFileSync(path.join(project, ".opencode", "commands", "lpwr-review.md"), "utf-8");
  assert.match(review, /LOCAL/u, "local edit kept");
  assert.match(review, /UPSTREAM/u, "upstream edit merged");
  assert.match(
    readFileSync(path.join(project, ".opencode", "commands", "lpwr-guide.md"), "utf-8"),
    /GUIDE V2/u,
    "pristine file updated"
  );
  assert.ok(existsSync(path.join(project, ".opencode", "skills", "lpwr-voice", "EXTRA.md")),
    "new file added");
  assert.ok(!existsSync(path.join(project, "docs", "glossary.md")), "removed upstream");
  assert.equal(manifest(project).version, "2.0.0");

  const again = sh(["update", "--project", project, "--source", "local", v2,
    "--version", "2.0.0", "--offline", "--no-deps", "--no-opencode"]);
  assert.match(again.stdout, /unchanged/u, "second update idempotent");
});

test("update conflict: markers, state, doctor, resolve, fix records", () => {
  const payload = makePayload(tempDir("payload-c"));
  const project = makeProject("conflict");
  sh(["install", "--project", project, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);

  appendFileSync(path.join(project, ".opencode", "commands", "lpwr-review.md"), "\nLOCAL LINE\n");
  const v2 = tempDir("payload-c2");
  makePayload(v2);
  mutatePayload(v2, ".opencode/commands/lpwr-review.md",
    `${readFileSync(path.join(v2, "harness", ".opencode", "commands", "lpwr-review.md"), "utf-8")}\nUPSTREAM LINE\n`);
  const upd = sh(["update", "--project", project, "--source", "local", v2,
    "--version", "2.0.0", "--offline", "--no-deps", "--no-opencode"]);
  expectStatus(upd, 1, "conflicting update exits 1");
  assert.match(upd.stdout, /CONFLICT/u, "conflict reported");
  const file = path.join(project, ".opencode", "commands", "lpwr-review.md");
  assert.match(readFileSync(file, "utf-8"), /^<<<<<<< /mu, "markers present");
  assert.equal(manifest(project).files[".opencode/commands/lpwr-review.md"].state, "conflict");

  const flagged = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(flagged, 1, "doctor flags markers");
  assert.match(flagged.stdout, /conflict markers/u);

  writeFileSync(file, "LOCAL LINE\nUPSTREAM LINE\n");
  const pending = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(pending, 1, "doctor flags pending bookkeeping");
  assert.match(pending.stdout, /not recorded/u);

  const fixed = sh(["fix", "--project", project, "--offline", "--no-opencode", "--no-deps"]);
  assert.match(fixed.stdout, /recorded conflict resolution/u);
  assert.equal(manifest(project).files[".opencode/commands/lpwr-review.md"].state, undefined,
    "state cleared");
  assert.match(readFileSync(file, "utf-8"), /UPSTREAM LINE/u, "resolution untouched by fix");
  stubDeps(project);
  materializeFoundation(project);
  const clean = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(clean, 0, "green after conflict cycle");
});

test("fix: restores missing + drifted files, heals config keys", () => {
  const payload = makePayload(tempDir("payload-f"));
  const project = makeProject("fix");
  sh(["install", "--project", project, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);

  rmSync(path.join(project, ".opencode", "agents", "scout.md"));
  appendFileSync(path.join(project, ".opencode", "commands", "lpwr-propose.md"), "\nDRIFT\n");
  const cfgPath = path.join(project, "opencode.json");
  const cfg = parseJsonc(readFileSync(cfgPath, "utf-8"));
  delete cfg.default_agent;
  delete cfg.permission;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  const flagged = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(flagged, 1, "doctor flags all three");
  assert.match(flagged.stdout, /scout\.md: installed file is missing/u);
  assert.match(flagged.stdout, /lpwr-propose\.md: differs/u);
  assert.match(flagged.stdout, /harness keys missing/u);

  const r = sh(["fix", "--project", project, "--offline", "--no-opencode", "--no-deps"]);
  assert.match(r.stdout, /restored \.opencode\/agents\/scout\.md \(missing\)/u);
  assert.match(r.stdout, /restored drifted \.opencode\/commands\/lpwr-propose\.md/u);
  assert.match(r.stdout, /healed opencode\.json/u);
  const healed = parseJsonc(readFileSync(cfgPath, "utf-8"));
  assert.equal(healed.default_agent, "orchestrator");
  stubDeps(project);
  materializeFoundation(project);
  const drift = sh(["doctor", "--project", project, "--offline", "--no-opencode"]);
  expectStatus(drift, 0, "green after fix");
});

test("uninstall: removes created files, restores pre-existing config", () => {
  const payload = makePayload(tempDir("payload-un"));
  const project = makeProject("uninstall");
  sh(["install", "--project", project, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);
  const r = sh(["uninstall", "--project", project]);
  expectStatus(r, 0, "uninstall");
  const leftover = spawnSync("find", [project, "-type", "f", "!", "-path", `${project}/.git/*`],
    { encoding: "utf-8" }).stdout.trim();
  assert.equal(leftover, "", `expected no files left, got:\n${leftover}`);
  assert.ok(!existsSync(path.join(project, ".loopwright", "manifest.json")));

  const keep = makeProject("uninstall-keep");
  writeFileSync(path.join(keep, "opencode.json"), '{ "mcp": { "x": 1 } }\n');
  writeFileSync(path.join(keep, ".gitignore"), "custom/\n");
  sh(["install", "--project", keep, "--source", "local", payload,
    "--version", "1.0.0", "--offline", "--no-deps", "--no-opencode"]);
  const r2 = sh(["uninstall", "--project", keep]);
  expectStatus(r2, 0, "uninstall with pre-existing config");
  assert.equal(readFileSync(path.join(keep, "opencode.json"), "utf-8"), '{ "mcp": { "x": 1 } }\n',
    "original config restored");
  assert.equal(readFileSync(path.join(keep, ".gitignore"), "utf-8"), "custom/\n",
    "original gitignore restored");
  assert.ok(!existsSync(path.join(keep, "tui.json")), "created tui.json removed");
});

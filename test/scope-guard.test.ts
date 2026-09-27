import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import scopeGuard from "../harness/.opencode/plugins/lpwr-scope-guard.ts";

// Round 8 Wave 3: lpwr-scope-guard's matching (surface globs, apply_patch
// marker paths, active-spec resolution) had no fixture. The env var is
// process-wide, so every case restores it. Types come from the factory, not
// from `@opencode-ai/plugin` — the root and harness/.opencode copies of that
// package are separate installs with unrelated PluginInput types.

type Hooks = Awaited<ReturnType<typeof scopeGuard>>;
type PluginArg = Parameters<typeof scopeGuard>[0];

const plugin = (directory: string): PluginArg =>
  ({ directory }) as unknown as PluginArg;

interface EditCase {
  readonly filePath: string;
  readonly patchText?: string;
}

const runTool = async (hooks: Hooks, spec: EditCase): Promise<void> => {
  const before = hooks["tool.execute.before"];
  assert.ok(before, "scope-guard must register tool.execute.before");
  await before(
    { callID: "c1", sessionID: "test", tool: spec.patchText ? "apply_patch" : "edit" },
    { args: spec.patchText ? { patchText: spec.patchText } : { filePath: spec.filePath } }
  );
};

const workspace = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "lpwr-scope-guard-"));
  execFileSync("git", ["init", "-q", dir]);
  const specFolder = path.join(dir, "docs/specs/auth-014");
  mkdirSync(specFolder, { recursive: true });
  writeFileSync(
    path.join(specFolder, "spec.md"),
    "---\nid: auth-014\nstatus: approved\n---\n\n# Spec\n\n## Tasks\n" +
      "1. [ ] touch it — satisfies auth-014-1\n\n### Declared surface\n" +
      "- `src/**`\n",
    "utf-8"
  );
  return dir;
};

test("scope-guard: enforces the declared surface with an active spec", async () => {
  const dir = workspace();
  const hooks = await scopeGuard(plugin(dir));
  const prev = process.env.OPENCODE_SPEC_ID;
  const prevCwd = process.cwd();
  process.env.OPENCODE_SPEC_ID = "auth-014";
  // apply_patch marker paths are project-relative; opencode runs with cwd =
  // the harness directory, so resolve them the same way here.
  process.chdir(dir);
  try {
    // In surface.
    await runTool(hooks, { filePath: path.join(dir, "src/feature.ts") });
    // Always allowed: the spec's own folder and the retain bookkeeping paths.
    await runTool(hooks, {
      filePath: path.join(dir, "docs/specs/auth-014/spec.md"),
    });
    await runTool(hooks, { filePath: path.join(dir, "docs/state.md") });
    await runTool(hooks, { filePath: path.join(dir, "docs/lessons/x.md") });

    // Outside the surface.
    await assert.rejects(
      runTool(hooks, { filePath: path.join(dir, "lib/other.ts") }),
      /outside the declared surface for auth-014/u
    );
    await assert.rejects(
      runTool(hooks, { filePath: path.join(dir, "docs/glossary.md") }),
      /outside the declared surface/u
    );

    // apply_patch carries paths in marker lines, not args.filePath.
    await runTool(hooks, {
      filePath: "",
      patchText: "*** Begin Patch\n*** Add File: src/added.ts\n+ok\n*** End Patch",
    });
    await assert.rejects(
      runTool(hooks, {
        filePath: "",
        patchText: "*** Begin Patch\n*** Add File: elsewhere/x.ts\n+ok\n*** End Patch",
      }),
      /outside the declared surface/u
    );
  } finally {
    process.chdir(prevCwd);
    if (prev === undefined) {
      delete process.env.OPENCODE_SPEC_ID;
    } else {
      process.env.OPENCODE_SPEC_ID = prev;
    }
  }
});

test("scope-guard: no active spec means no guard", async () => {
  const dir = workspace();
  const hooks = await scopeGuard(plugin(dir));
  const prev = process.env.OPENCODE_SPEC_ID;
  delete process.env.OPENCODE_SPEC_ID;
  try {
    // Fresh repo, empty branch — branch-derived resolution yields nothing.
    await runTool(hooks, { filePath: path.join(dir, "lib/anywhere.ts") });
  } finally {
    if (prev !== undefined) {
      process.env.OPENCODE_SPEC_ID = prev;
    }
  }
});

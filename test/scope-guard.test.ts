import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import scopeGuard from "../harness/.opencode/plugins/lpwr-scope-guard.ts";

// Round 8 Wave 3: lpwr-scope-guard's matching (surface globs, apply_patch
// marker paths, active-spec resolution) had no fixture. Round 8 Wave 4 adds
// the status: approved freeze. The env var is process-wide, so every case
// restores it. Types come from the factory, not from `@opencode-ai/plugin` —
// the root and harness/.opencode copies of that package are separate installs
// with unrelated PluginInput types.

type Hooks = Awaited<ReturnType<typeof scopeGuard>>;
type PluginArg = Parameters<typeof scopeGuard>[0];

const plugin = (directory: string): PluginArg =>
  ({ directory }) as unknown as PluginArg;

interface EditCase {
  readonly content?: string;
  readonly filePath: string;
  readonly newString?: string;
  readonly oldString?: string;
  readonly patchText?: string;
}

const SPEC = (status: string): string =>
  `---\nid: auth-014\nstatus: ${status}\nrisk_tier: low\n---\n\n` +
  "# Spec: x\n\n## Tasks\n1. [ ] touch it — satisfies auth-014-1\n\n" +
  "### Declared surface\n- `src/**`\n\n" +
  "## Acceptance criteria → test binding\n" +
  "| Criterion ID | Test reference (filled by lpwr-implement) |\n" +
  "| --- | --- |\n| auth-014-1 |  |\n";

const runTool = async (hooks: Hooks, spec: EditCase): Promise<void> => {
  const before = hooks["tool.execute.before"];
  assert.ok(before, "scope-guard must register tool.execute.before");
  let tool = "edit";
  if (spec.patchText !== undefined) {
    tool = "apply_patch";
  } else if (spec.content !== undefined) {
    tool = "write";
  }
  const args: Record<string, unknown> = {};
  if (spec.patchText !== undefined) {
    // apply_patch carries paths in marker lines; no filePath.
    args.patchText = spec.patchText;
  }
  if (spec.content !== undefined) {
    args.content = spec.content;
  }
  if (spec.patchText === undefined) {
    args.filePath = spec.filePath;
  }
  if (spec.oldString !== undefined) {
    args.oldString = spec.oldString;
  }
  if (spec.newString !== undefined) {
    args.newString = spec.newString;
  }
  await before({ callID: "c1", sessionID: "test", tool }, { args });
};

const workspace = (status = "approved"): string => {
  const dir = mkdtempSync(path.join(tmpdir(), "lpwr-scope-guard-"));
  execFileSync("git", ["init", "-q", dir]);
  const specFolder = path.join(dir, "docs/specs/auth-014");
  mkdirSync(specFolder, { recursive: true });
  writeFileSync(path.join(specFolder, "spec.md"), SPEC(status), "utf-8");
  return dir;
};

// Env + cwd are process-wide: run every guarded case under this harness.
const withActiveSpec = async (
  dir: string,
  cases: (hooks: Hooks) => Promise<void>
): Promise<void> => {
  const hooks = await scopeGuard(plugin(dir));
  const prev = process.env.OPENCODE_SPEC_ID;
  const prevCwd = process.cwd();
  process.env.OPENCODE_SPEC_ID = "auth-014";
  process.chdir(dir);
  try {
    await cases(hooks);
  } finally {
    process.chdir(prevCwd);
    if (prev === undefined) {
      delete process.env.OPENCODE_SPEC_ID;
    } else {
      process.env.OPENCODE_SPEC_ID = prev;
    }
  }
};

const SPEC_PATH = "docs/specs/auth-014/spec.md";

test("scope-guard: enforces the declared surface with an active spec", async () => {
  const dir = workspace();
  await withActiveSpec(dir, async (hooks) => {
    // In surface.
    await runTool(hooks, { filePath: path.join(dir, "src/feature.ts") });
    // Always allowed: the spec's own folder and the retain bookkeeping paths.
    await runTool(hooks, {
      filePath: path.join(dir, SPEC_PATH),
      newString: "| auth-014-1 | test/a.test.ts |",
      oldString: "| auth-014-1 |  |",
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
  });
});

test("scope-guard: status approved freezes spec.md to test refs", async () => {
  const dir = workspace("approved");
  await withActiveSpec(dir, async (hooks) => {
    // Allowed: filling a test-reference cell (edit tool).
    await runTool(hooks, {
      filePath: path.join(dir, SPEC_PATH),
      newString: "| auth-014-1 | test/a.test.ts |",
      oldString: "| auth-014-1 |  |",
    });
    // Allowed: the same fill as a whole-file write.
    await runTool(hooks, {
      content: SPEC("approved").replace(
        "| auth-014-1 |  |",
        "| auth-014-1 | test/a.test.ts |"
      ),
      filePath: path.join(dir, SPEC_PATH),
    });
    // Allowed: lpwr-amend's door — the approved→draft flip alone.
    await runTool(hooks, {
      filePath: path.join(dir, SPEC_PATH),
      newString: "status: draft",
      oldString: "status: approved",
    });

    // Blocked: criteria prose, frontmatter tiers, and unverifiable args.
    await assert.rejects(
      runTool(hooks, {
        filePath: path.join(dir, SPEC_PATH),
        newString: "# Spec: renamed",
        oldString: "# Spec: x",
      }),
      /frozen at status: approved/u
    );
    await assert.rejects(
      runTool(hooks, {
        filePath: path.join(dir, SPEC_PATH),
        newString: "risk_tier: high",
        oldString: "risk_tier: low",
      }),
      /frozen at status: approved/u
    );
    await assert.rejects(
      runTool(hooks, { filePath: path.join(dir, SPEC_PATH) }),
      /cannot be verified/u
    );

    // apply_patch: a row-only change passes, any other line does not.
    await runTool(hooks, {
      filePath: "",
      patchText:
        `*** Begin Patch\n*** Update File: ${SPEC_PATH}\n@@\n` +
        "-| auth-014-1 |  |\n+| auth-014-1 | test/a.test.ts |\n*** End Patch",
    });
    await assert.rejects(
      runTool(hooks, {
        filePath: "",
        patchText:
          `*** Begin Patch\n*** Update File: ${SPEC_PATH}\n@@\n` +
          "-# Spec: x\n+# Spec: y\n*** End Patch",
      }),
      /frozen at status: approved/u
    );
  });
});

test("scope-guard: a draft spec is not frozen", async () => {
  const dir = workspace("draft");
  await withActiveSpec(dir, async (hooks) => {
    await runTool(hooks, {
      filePath: path.join(dir, SPEC_PATH),
      newString: "# Spec: renamed",
      oldString: "# Spec: x",
    });
  });
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

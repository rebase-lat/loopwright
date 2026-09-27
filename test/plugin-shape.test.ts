import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

// Round 6 S6-01: opencode loads every file in .opencode/plugins/ as a plugin
// and requires each module export to be a function — a single `export const`
// (a RegExp, an array) anywhere in the module makes discovery throw
// "Plugin export is not a function" on every startup. The shared helpers used
// to live in plugins/shared.ts and did exactly that; they now live in lib/.
//
// Round 8 Wave 3: this fixture used to regex-scan source text because plugin
// modules imported `../lib/shared.js` NodeNext specifiers, which plain node
// cannot resolve to `.ts` — loading them was impossible. The plugins now
// import `../lib/*.ts` (the spelling lib/worktree.ts already proved works
// under both Bun and node --test), so every entry module is imported for real
// and the assertions run against the actual module namespace.

const PLUGINS_DIR = path.resolve(
  import.meta.dirname,
  "../harness/.opencode/plugins"
);

test("plugin entry modules import and default-export only", async () => {
  const files = readdirSync(PLUGINS_DIR).filter((file) =>
    file.endsWith(".ts")
  );
  assert.ok(files.length >= 12, `expected the plugin set, saw ${files.length}`);
  const namespaces = await Promise.all(
    files.map(async (file) => ({
      file,
      namespace: (await import(
        pathToFileURL(path.join(PLUGINS_DIR, file)).href
      )) as Record<string, unknown>,
    }))
  );
  for (const { file, namespace } of namespaces) {
    assert.equal(
      typeof namespace.default,
      "function",
      `${file} must default-export a plugin factory (got ${typeof namespace.default})`
    );
    const strays = Object.keys(namespace).filter((key) => key !== "default");
    assert.deepEqual(
      strays,
      [],
      `${file} has non-default runtime exports (${strays.join(", ")}) — ` +
        `opencode requires every plugin export to be a function; ` +
        `shared helpers belong in .opencode/lib/`
    );
  }
});

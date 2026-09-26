import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

// Round 6 S6-01: opencode loads every file in .opencode/plugins/ as a plugin
// and requires each module export to be a function — a single `export const`
// (a RegExp, an array) anywhere in the module makes discovery throw
// "Plugin export is not a function" on every startup. The shared helpers used
// to live in plugins/shared.ts and did exactly that; they now live in lib/.
// This fixture keeps plugin entry modules default-export-only, statically (a
// dynamic import is impossible here: plugin modules import "./shared.js"
// NodeNext specifiers, which plain node cannot resolve to .ts).
const PLUGINS_DIR = path.resolve(
  import.meta.dirname,
  "../harness/.opencode/plugins"
);

test("plugin entry modules default-export only", () => {
  const files = readdirSync(PLUGINS_DIR).filter((file) =>
    file.endsWith(".ts")
  );
  assert.ok(files.length >= 12, `expected the plugin set, saw ${files.length}`);
  for (const file of files) {
    const source = readFileSync(path.join(PLUGINS_DIR, file), "utf-8");
    const stray = source.match(/^export\s+(?!default\b)/mu);
    assert.equal(
      stray,
      null,
      `${file} has a non-default export (${stray?.[0].trim()}) — ` +
        `opencode requires every plugin export to be a function; ` +
        `shared helpers belong in .opencode/lib/`
    );
    assert.match(
      source,
      /^export default /mu,
      `${file} has no default export — opencode needs a plugin factory`
    );
  }
});

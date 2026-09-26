import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_DEPS = ["@opencode-ai/plugin", "@opentui/solid", "solid-js"];

const EXPECTED = [
  ["AGENTS.md", "protocol file", "installer"],
  ["docs/constitution.md", "run lpwr-install then lpwr-onboard", "foundation"],
  ["docs/context.md", "run lpwr-install then lpwr-onboard", "foundation"],
  ["docs/state.md", "run lpwr-install", "foundation"],
  ["docs/audit.md", "run lpwr-install", "foundation"],
  ["docs/glossary.md", "run lpwr-domain", "foundation"],
  [".gitignore", "generated foundation and secrets stay untracked", "installer"],
  ["opencode.json", "permission matrix", "installer"],
  ["tui.json", "TUI sidebar config", "installer"],
  ["templates/spec.md", "record shapes", "installer"],
];

const fail = (message) => {
  throw new Error(message);
};

const scanString = (text, start) => {
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === '"') {return i + 1;}
    i += 1;
  }
  fail("unterminated string");
};

const skipWsComments = (text, start) => {
  let i = start;
  for (;;) {
    const c = text[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {i += 1;}
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) {fail("unterminated block comment");}
      i = end + 2;
      continue;
    }
    return i;
  }
};

const skipValue = (text, start) => {
  let i = skipWsComments(text, start);
  const c = text[i];
  if (c === undefined) {fail("unexpected end of input");}
  if (c === '"') {return scanString(text, i);}
  if (c === "{" || c === "[") {
    let depth = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        i = scanString(text, i);
        continue;
      }
      if (ch === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
        i = skipWsComments(text, i);
        continue;
      }
      if (ch === "{" || ch === "[") {depth += 1;}
      else if (ch === "}" || ch === "]") {
        depth -= 1;
        if (depth === 0) {return i + 1;}
      }
      i += 1;
    }
    fail("unterminated container");
  }
  while (i < text.length && !",}]\n\t ".includes(text[i])) {
    if (text[i] === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {break;}
    i += 1;
  }
  return i;
};

const stripJsonc = (text) => {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const end = scanString(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") {i += 1;}
      out += " ";
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end === -1) {fail("unterminated block comment");}
      i = end + 2;
      out += " ";
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
};

const removeTrailingCommas = (text) => {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"') {
      const end = scanString(text, i);
      out += text.slice(i, end);
      i = end;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < text.length && " \t\n\r".includes(text[j])) {j += 1;}
      if (j < text.length && (text[j] === "}" || text[j] === "]")) {
        i += 1;
        continue;
      }
    }
    out += c;
    i += 1;
  }
  return out;
};

const parseJsonc = (text) => JSON.parse(removeTrailingCommas(stripJsonc(text)));

const depth1Spans = (text) => {
  const spans = [];
  let i = skipWsComments(text, 0);
  if (text[i] !== "{") {fail("expected object at document start");}
  i += 1;
  let propStart = i;
  for (;;) {
    i = skipWsComments(text, i);
    if (i >= text.length) {fail("unterminated object");}
    if (text[i] === "}") {break;}
    if (text[i] === ",") {
      i += 1;
      propStart = i;
      continue;
    }
    if (text[i] !== '"') {fail(`expected property name at offset ${i}`);}
    const keyEnd = scanString(text, i);
    const key = JSON.parse(text.slice(i, keyEnd));
    i = skipWsComments(text, keyEnd);
    if (text[i] !== ":") {fail(`expected ':' after property name at offset ${i}`);}
    i += 1;
    i = skipValue(text, i);
    spans.push({ end: i, key, start: propStart });
    i = skipWsComments(text, i);
    if (text[i] === ",") {
      i += 1;
      propStart = i;
      continue;
    }
    if (text[i] === "}") {break;}
    fail(`expected ',' or '}' at offset ${i}`);
  }
  return spans;
};

const isPlainObj = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const hasKey = (o, k) =>
  typeof o === "object" && o !== null && Object.hasOwn(o, k);

const indentValue = (v) =>
  JSON.stringify(v, null, 2).replaceAll("\n", "\n  ");

const deepMerge3 = (base, theirs, ours, prefix, conflicts) => {
  const out = { ...ours };
  for (const [k, tv] of Object.entries(theirs)) {
    const bv = base?.[k];
    const ov = out[k];
    const p = `${prefix}.${k}`;
    const inOurs = Object.hasOwn(ours, k);
    const inBase = hasKey(base, k);
    if (ov === undefined && !inOurs) {
      if (!inBase) {
        out[k] = tv;
      } else if (!deepEq(tv, bv)) {
        conflicts.push(
          `${p}: changed upstream; restored (it was deleted locally)`
        );
        out[k] = tv;
      }
      continue;
    }
    if (isPlainObj(tv) && isPlainObj(ov)) {
      out[k] = deepMerge3(inBase ? bv : undefined, tv, ov, p, conflicts);
      continue;
    }
    if (deepEq(ov, bv)) {
      out[k] = tv;
      continue;
    }
    if (deepEq(tv, bv)) {continue;}
    if (deepEq(ov, tv)) {continue;}
    conflicts.push(
      inBase
        ? `${p}: changed on both sides; harness value kept`
        : `${p}: project value replaced by the harness default`
    );
    out[k] = tv;
  }
  return out;
};


const unionDecision = (key, { instructionsName, oursVal, theirsVal }) => {
  const merged = [...oursVal];
  for (const item of theirsVal) {
    if (!merged.some((x) => deepEq(x, item))) {
      merged.push(item);
    }
  }
  const substNeeded =
    instructionsName !== undefined &&
    instructionsName !== "AGENTS.md" &&
    key === "instructions";
  if (deepEq(merged, oursVal) && !substNeeded) {
    return { source: "ours" };
  }
  return { source: "value", value: merged };
};

const decide3way = (key, ctx) => {
  const { baseVal, conflicts, force, inBase, inOurs, inTheirs, oursVal, theirsVal } =
    ctx;
  if (!inTheirs) {
    if (!inBase) {
      return { source: "ours" };
    }
    if (deepEq(oursVal, baseVal)) {
      return { source: "drop" };
    }
    conflicts.push(`${key}: upstream removed it; kept the local value`);
    return { source: "ours" };
  }
  if (!inOurs) {
    if (force || !inBase) {
      return { source: "theirs" };
    }
    if (deepEq(theirsVal, baseVal)) {
      return { source: "drop" };
    }
    conflicts.push(`${key}: changed upstream; restored (it was deleted locally)`);
    return { source: "theirs" };
  }
  if (deepEq(oursVal, theirsVal)) {
    return { source: "ours" };
  }
  if (deepEq(oursVal, baseVal)) {
    return { source: "theirs" };
  }
  if (deepEq(theirsVal, baseVal)) {
    return { source: "ours" };
  }
  if (!inBase) {
    if (isPlainObj(theirsVal) && isPlainObj(oursVal)) {
      return {
        source: "value",
        value: deepMerge3(undefined, theirsVal, oursVal, key, conflicts),
      };
    }
    conflicts.push(`${key}: project value replaced by the harness default`);
    return { source: "theirs" };
  }
  if (isPlainObj(theirsVal) && isPlainObj(oursVal)) {
    return {
      source: "value",
      value: deepMerge3(baseVal, theirsVal, oursVal, key, conflicts),
    };
  }
  conflicts.push(`${key}: changed on both sides; harness value kept`);
  return { source: "theirs" };
};

const mergeConfig = ({
  theirsText,
  oursText,
  baseText,
  instructionsName,
  force,
}) => {
  const theirs = parseJsonc(theirsText);
  const ours = parseJsonc(oursText);
  const base = baseText === undefined ? undefined : parseJsonc(baseText);
  const tSpans = new Map(depth1Spans(theirsText).map((s) => [s.key, s]));
  const oSpans = new Map(depth1Spans(oursText).map((s) => [s.key, s]));
  let tVals = theirs;
  if (instructionsName !== undefined && Array.isArray(theirs.instructions)) {
    tVals = {
      ...theirs,
      instructions: theirs.instructions.map((x) =>
        x === "AGENTS.md" ? instructionsName : x
      ),
    };
  }
  const unionKeys = new Set(["instructions", "plugin"]);
  const conflicts = [];
  const keys = Object.keys(ours);
  for (const k of Object.keys(tVals)) {
    if (!Object.hasOwn(ours, k)) {keys.push(k);}
  }
  const parts = [];
  for (const key of keys) {
    const inOurs = Object.hasOwn(ours, key);
    const inTheirs = Object.hasOwn(tVals, key);
    const inBase = hasKey(base, key);
    const ov = ours[key];
    const tv = tVals[key];
    const bv = base?.[key];
    const isUnion =
      unionKeys.has(key) &&
      inOurs &&
      inTheirs &&
      Array.isArray(ov) &&
      Array.isArray(tv);
    const decided = isUnion
      ? unionDecision(key, { instructionsName, oursVal: ov, theirsVal: tv })
      : decide3way(key, {
          baseVal: bv,
          conflicts,
          force,
          inBase,
          inOurs,
          inTheirs,
          oursVal: ov,
          theirsVal: tv,
        });
    const { source, value } = decided;
    if (source === "drop") {continue;}
    if (source === "ours") {
      const span = oSpans.get(key);
      if (!span) {fail(`no span for key ${key} in ours`);}
      const { end, start } = span;
      parts.push(oursText.slice(start, end));
    } else if (source === "theirs") {
      const span = tSpans.get(key);
      if (!span) {fail(`no span for key ${key} in theirs`);}
      const { end, start } = span;
      parts.push(theirsText.slice(start, end));
    } else {
      parts.push(`\n  ${JSON.stringify(key)}: ${indentValue(value)}`);
    }
  }
  const text = `{${parts.join(",")}\n}\n`;
  parseJsonc(text);
  return { conflicts, text };
};

const unionGitignore = (theirsText, oursText) => {
  const seen = new Set(oursText.split("\n").map((l) => l.trimEnd()));
  const added = [];
  for (const raw of theirsText.split("\n")) {
    if (!seen.has(raw.trimEnd())) {added.push(raw);}
  }
  while (added.length > 0 && added.at(-1).trim() === "") {
    added.pop();
  }
  if (added.length === 0) {return oursText;}
  if (oursText === "") {return `${added.join("\n")}\n`;}
  const base = oursText.endsWith("\n") ? oursText : `${oursText}\n`;
  return `${base}${added.join("\n")}\n`;
};

const sha256File = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const hasConflictMarkers = (text) =>
  text.includes("\n<<<<<<< ") || text.startsWith("<<<<<<< ");

const finding = (level, code, message, hint) =>
  [level, code, message, hint ?? ""].join("\t");

const verifyFindings = (manifestPath, root) => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const merged = new Set(manifest.merged);
  const out = [];
  for (const rel of Object.keys(manifest.files).toSorted()) {
    const destRel =
      rel === "AGENTS.md" && typeof manifest.agents_file === "string"
        ? manifest.agents_file
        : rel;
    const dest = path.join(root, destRel);
    const want = manifest.files[rel].sha256;
    if (!existsSync(dest)) {
      out.push(
        finding(
          "ERROR",
          "missing-file",
          `${destRel}: installed file is missing`,
          "run: loopwright.sh fix"
        )
      );
      continue;
    }
    if (manifest.files[rel].state === "conflict") {
      const text = readFileSync(dest, "utf-8");
      if (hasConflictMarkers(text)) {
        out.push(
          finding(
            "ERROR",
            "conflict-markers",
            `${destRel}: unresolved merge conflict markers`,
            "resolve the <<<<<<< markers, then run: loopwright.sh fix"
          )
        );
      } else {
        out.push(
          finding(
            "WARN",
            "conflict-pending",
            `${destRel}: update conflict resolved but not recorded`,
            "run: loopwright.sh fix"
          )
        );
      }
      continue;
    }
    const got = sha256File(dest);
    if (got !== want) {
      if (merged.has(rel)) {
        out.push(
          finding(
            "INFO",
            "modified",
            `${destRel}: modified (tracked as a merged file)`,
            "local edits are kept; loopwright.sh update 3-way merges them"
          )
        );
      } else {
        out.push(
          finding(
            "WARN",
            "drifted",
            `${destRel}: differs from the installed version`,
            "run: loopwright.sh fix (backs up the local copy first)"
          )
        );
      }
    }
    if (hasConflictMarkers(readFileSync(dest, "utf-8"))) {
      out.push(
        finding(
          "ERROR",
          "conflict-markers",
          `${destRel}: unresolved merge conflict markers`,
          "resolve the <<<<<<< markers, then run: loopwright.sh doctor"
        )
      );
    }
  }
  return out;
};

const expectedFindings = (root) => {
  const out = [];
  for (const [rel, hint, cls] of EXPECTED) {
    if (cls !== "foundation") {continue;}
    if (!existsSync(path.join(root, rel))) {
      out.push(finding("SUGGEST", "missing-foundation", `${rel}: missing`, hint));
    }
  }
  return out;
};

const depsFindings = (root) => {
  const out = [];
  const dir = path.join(root, ".opencode");
  const pkgFile = path.join(dir, "package.json");
  if (existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgFile, "utf-8"));
      const declared = new Set(Object.keys(pkg.dependencies ?? {}));
      const undeclared = REQUIRED_DEPS.filter((d) => !declared.has(d));
      if (undeclared.length > 0) {
        out.push(
          finding(
            "ERROR",
            "deps-declared",
            `.opencode/package.json: does not declare ${undeclared.join(", ")}`,
            "run: loopwright.sh fix"
          )
        );
      }
    } catch (error) {
      out.push(
        finding(
          "ERROR",
          "deps-manifest",
          `.opencode/package.json: invalid JSON (${error.message})`,
          "run: loopwright.sh fix"
        )
      );
    }
  } else {
    out.push(
      finding(
        "ERROR",
        "deps-manifest",
        ".opencode/package.json: dependency manifest is missing",
        "run: loopwright.sh fix"
      )
    );
  }
  const missing = REQUIRED_DEPS.filter(
    (d) =>
      !existsSync(path.join(dir, "node_modules", d, "package.json")) &&
      !existsSync(path.join(root, "node_modules", d, "package.json"))
  );
  if (missing.length > 0) {
    out.push(
      finding(
        "ERROR",
        "deps-missing",
        `dependencies not installed: ${missing.join(", ")}`,
        "run: loopwright.sh fix (npm install in .opencode/)"
      )
    );
  }
  return out;
};

const harnessKeyFindings = (file, theirsFile) => {
  if (!existsSync(file)) {return [];}
  let ours;
  let theirs;
  try {
    ours = parseJsonc(readFileSync(file, "utf-8"));
    theirs = parseJsonc(readFileSync(theirsFile, "utf-8"));
  } catch {
    return [];
  }
  const missing = Object.keys(theirs).filter((k) => !Object.hasOwn(ours, k));
  if (missing.length === 0) {return [];}
  return [
    finding(
      "ERROR",
      "harness-keys",
      `${path.basename(file)}: harness keys missing: ${missing.join(", ")}`,
      "run: loopwright.sh fix"
    ),
  ];
};

const sanitize = (s) => s.replaceAll("\t", " ").replaceAll("\n", " ");

const parseFindings = (raw) => {
  const out = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "") {continue;}
    const [level, code, message, hint] = line.split("\t");
    out.push({
      code: code ?? "",
      hint: sanitize(hint ?? ""),
      level: level ?? "INFO",
      message: sanitize(message ?? ""),
    });
  }
  return out;
};

const reportText = (findings) => {
  const labels = { ERROR: "ERROR", INFO: "info", SUGGEST: "suggest", WARN: "WARN" };
  const lines = findings.map((f) => {
    const head = `[${labels[f.level] ?? f.level}]`;
    return f.hint ? `${head} ${f.message} — ${f.hint}` : `${head} ${f.message}`;
  });
  const count = (lvl) => findings.filter((f) => f.level === lvl).length;
  const parts = [];
  const errors = count("ERROR");
  const warns = count("WARN");
  const suggests = count("SUGGEST");
  if (errors > 0) {parts.push(`${errors} error${errors === 1 ? "" : "s"}`);}
  if (warns > 0) {parts.push(`${warns} warning${warns === 1 ? "" : "s"}`);}
  if (suggests > 0) {parts.push(`${suggests} suggestion${suggests === 1 ? "" : "s"}`);}
  if (parts.length > 0) {lines.push(`summary: ${parts.join(", ")}`);}
  if (lines.length === 0) {lines.push("all checks passed");}
  return lines.join("\n");
};

const usage = `installer-lib operations:
  merge-config --theirs T --ours O [--base B] [--instructions-name N] [--force] --out X
  union-gitignore --theirs T --ours O --out X
  manifest-build --out F --version V --ref R --agents-file A --merged csv --tsv T [--conflicts csv] [--created csv] [--previous F]
  manifest-set --manifest F --rel R --sha S
  verify --manifest F --root R
  expected --root R
  deps-check --root R
  deps-heal --file F --from C
  check-harness-keys --file F --theirs T
  validate FILE...
  report --format text|json`;

const parseArgs = (argv) => {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
};

const read = (p) => readFileSync(p, "utf-8");

const tryParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const handle_check_harness_keys = (flags, _positional) => {

      process.stdout.write(
        `${harnessKeyFindings(flags.file, flags.theirs).join("\n")}\n`
      );
};
const handle_deps_check = (flags, _positional) => {

      process.stdout.write(`${depsFindings(flags.root).join("\n")}\n`);
};
const handle_deps_heal = (flags, _positional) => {

      const current = tryParse(read(flags.file)) ?? {};
      const source = tryParse(read(flags.from)) ?? {};
      current.dependencies = {
        ...source.dependencies,
        ...current.dependencies,
      };
      writeFileSync(flags.file, `${JSON.stringify(current, null, 2)}\n`);
};
const handle_expected = (flags, _positional) => {

      process.stdout.write(`${expectedFindings(flags.root).join("\n")}\n`);
};
const handle_manifest_build = (flags, _positional) => {

      const files = {};
      for (const line of read(flags.tsv).split("\n")) {
        if (line.trim() === "") {continue;}
        const [rel, sha] = line.split("\t");
        files[rel] = { sha256: sha };
      }
      const conflicts = new Set(
        String(flags.conflicts ?? "")
          .split(",")
          .filter(Boolean)
      );
      for (const rel of conflicts) {
        if (files[rel]) {files[rel].state = "conflict";}
      }
      const created = new Set(
        String(flags.created ?? "")
          .split(",")
          .filter(Boolean)
      );
      let previous;
      if (flags.previous !== undefined && existsSync(flags.previous)) {
        previous = tryParse(read(flags.previous));
      }
      for (const rel of Object.keys(files)) {
        if (created.has(rel) || previous?.files?.[rel]?.created === true) {
          files[rel].created = true;
        }
      }
      let installedAt = new Date().toISOString();
      if (previous?.installed_at) {installedAt = previous.installed_at;}
      const manifest = {
        agents_file: flags["agents-file"],
        files,
        installed_at: installedAt,
        merged: (flags.merged ?? "").split(",").filter(Boolean),
        ref: flags.ref,
        updated_at: new Date().toISOString(),
        version: flags.version,
      };
      writeFileSync(flags.out, `${JSON.stringify(manifest, null, 2)}\n`);
};
const handle_manifest_set = (flags, _positional) => {

      const manifest = JSON.parse(read(flags.manifest));
      if (manifest.files[flags.rel]) {
        manifest.files[flags.rel] = { sha256: flags.sha };
        writeFileSync(flags.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
      } else {
        fail(`unknown manifest entry: ${flags.rel}`);
      }
};
const handle_merge_config = (flags, _positional) => {

      const result = mergeConfig({
        baseText: flags.base === undefined ? undefined : read(flags.base),
        force: Boolean(flags.force),
        instructionsName: flags["instructions-name"],
        oursText: read(flags.ours),
        theirsText: read(flags.theirs),
      });
      writeFileSync(flags.out, result.text);
      for (const c of result.conflicts) {
        process.stdout.write(`conflict\t${sanitize(c)}\n`);
      }
};
const handle_report = (flags, _positional) => {

      const format = flags.format === "json" ? "json" : "text";
      const raw = process.stdin.isTTY ? "" : readFileSync(0, "utf-8");
      const findings = parseFindings(raw);
      if (format === "json") {
        const count = (lvl) => findings.filter((f) => f.level === lvl).length;
        process.stdout.write(
          `${JSON.stringify(
            {
              counts: {
                error: count("ERROR"),
                info: count("INFO"),
                suggest: count("SUGGEST"),
                warn: count("WARN"),
              },
              findings,
            },
            null,
            2
          )}\n`
        );
      } else {
        process.stdout.write(`${reportText(findings)}\n`);
      }
};
const handle_union_gitignore = (flags, _positional) => {

      const oursText = existsSync(flags.ours) ? read(flags.ours) : "";
      writeFileSync(flags.out, unionGitignore(read(flags.theirs), oursText));
};
const handle_validate = (flags, positional) => {

      let failed = 0;
      for (const f of positional) {
        try {
          parseJsonc(read(f));
        } catch (error) {
          failed += 1;
          process.stderr.write(`${f}: ${error.message}\n`);
        }
      }
      process.exitCode = failed > 0 ? 1 : 0;
};
const handle_verify = (flags, _positional) => {

      process.stdout.write(`${verifyFindings(flags.manifest, flags.root).join("\n")}\n`);
};

const opHandlers = {
  "check-harness-keys": handle_check_harness_keys,
  "deps-check": handle_deps_check,
  "deps-heal": handle_deps_heal,
  "expected": handle_expected,
  "manifest-build": handle_manifest_build,
  "manifest-set": handle_manifest_set,
  "merge-config": handle_merge_config,
  "report": handle_report,
  "union-gitignore": handle_union_gitignore,
  "validate": handle_validate,
  "verify": handle_verify,
};

const main = () => {
  const [op, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  const handler = opHandlers[op];
  if (handler === undefined) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    handler(flags, positional);
  } catch (error) {
    process.stderr.write(`${op}: ${error.message}\n`);
    process.exitCode = 1;
  }
};

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {main();}

export {
  EXPECTED,
  REQUIRED_DEPS,
  depth1Spans,
  mergeConfig,
  parseJsonc,
  unionGitignore,
};

// Pure gate predicates, extracted from the enforcing plugins so a committed
// node:test fixture harness can exercise them directly (Round 3 D1). This
// module is deliberately import-free — no local imports at all — so `node
// --test` loads it with no fs/git/plugin dependencies, and so it can be the
// one home for shared primitives (spec-ID regexes, frontmatter/EOL helpers,
// the state.md section parser) that used to be copied between `shared.ts`
// and the plugins. The plugins import these back (`.ts` specifiers, the same
// spelling `lib/worktree.ts` already uses), so the tested logic and the
// enforced logic are the same functions, never a copy.

// Branch/command-arg spec ID: single sequence suffix (auth-014).
export const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/u;
// Journal/tool spec ref: also accepts criterion IDs (auth-014-1).
export const SPEC_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+(?:-\d+)?$/u;

export const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.+^${}()|[\]\\]/gu, "\\$&");

export const normalizeEol = (raw: string): string =>
  raw.replaceAll("\r\n", "\n");

export const frontmatterBlock = (raw: string): string | null => {
  const match = normalizeEol(raw).match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  return match?.groups?.frontmatter ?? null;
};

// Lowercased value of `key:` in frontmatter, ` # …` comments stripped.
// Lives here with the rest of the pure frontmatter helpers; shared.ts
// re-exports it so existing call sites keep working.
export const frontmatterValue = (raw: string, key: string): string | null => {
  const fm = frontmatterBlock(raw);
  if (!fm) {
    return null;
  }
  const line = fm
    .split("\n")
    .find((candidate) => candidate.trim().toLowerCase().startsWith(`${key}:`));
  if (!line) {
    return null;
  }
  return (
    line.split(":").slice(1).join(":").split("#")[0].trim().toLowerCase() ||
    null
  );
};

// state.md section membership (Done closures, Blocked escalations) — one
// parser for every caller: the worktree service, lpwr-verdict-gate, and
// lpwr-spec-link used to keep three near-identical copies that could drift.
// Section names match case-insensitively; the entry match is boundary-aware
// so `auth-014` never matches `auth-0144`. Pure text in, boolean out — the
// callers own the file read.
export const stateSectionHasEntry = (
  stateText: string,
  section: string,
  specId: string
): boolean => {
  let inside = false;
  for (const line of normalizeEol(stateText).split("\n")) {
    if (new RegExp(`^##\\s+${escapeRegExp(section)}\\b`, "iu").test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (
      inside &&
      new RegExp(`^- ${escapeRegExp(specId)}(?=[:\\s]|$)`, "u").test(
        line.trim()
      )
    ) {
      return true;
    }
  }
  return false;
};

// Pipe-table cells with the leading/trailing empty splits dropped: `| a | b |`
// → ["a", "b"]. Primitive used by every table reader below.
export const rowCells = (row: string): string[] => {
  const parts = row.split("|").map((cell) => cell.trim());
  return parts.filter((_cell, index) => index > 0 && index < parts.length - 1);
};

// --- Frozen approved spec (AGENTS rule 9 / implementation-rules 38) ----------
//
// While `spec.md` carries `status: approved`, Execute may fill test-reference
// cells and nothing else; every other change travels through lpwr-amend, whose
// first act is the one allowed non-table edit — flipping `status` to `draft`.
// lpwr-scope-guard feeds these the tool's pending content, so the gate checks
// what would land on disk rather than who is writing (tool hooks carry no
// agent identity — conventions, "Gates can't see who acts").

const ACCEPTANCE_HEADING = /^##\s+acceptance criteria\b/iu;

const splitFrontmatter = (raw: string): { body: string; fm: string } => {
  const text = normalizeEol(raw);
  const match = text.match(/^---\n(?<fm>[\s\S]*?)\n---\n?/u);
  if (!match?.groups) {
    return { body: text, fm: "" };
  }
  return { body: text.slice(match[0].length), fm: match.groups.fm };
};

// Byte range of the spec's acceptance-table section: heading start → next
// heading (or end of file). null when the spec has no such section.
export const acceptanceSection = (
  raw: string
): { end: number; start: number } | null => {
  const text = normalizeEol(raw);
  let start = -1;
  let end = text.length;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (start === -1) {
      if (ACCEPTANCE_HEADING.test(line)) {
        start = offset;
      }
    } else if (/^#{1,6}\s/u.test(line)) {
      end = offset;
      break;
    }
    offset += line.length + 1;
  }
  return start === -1 ? null : { end, start };
};

const tableIds = (
  text: string,
  range: { end: number; start: number }
): string =>
  text
    .slice(range.start, range.end)
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => rowCells(line)[0] ?? "")
    .join("\n");

// Full pending content of spec.md vs the file on disk. Returns null when the
// change is allowed, otherwise the reason to block.
export const approvedSpecEdit = (
  current: string,
  pending: string
): string | null => {
  const onDisk = normalizeEol(current);
  const next = normalizeEol(pending);
  if (onDisk === next) {
    return null;
  }
  if (frontmatterValue(onDisk, "status") !== "approved") {
    return null;
  }
  const now = splitFrontmatter(onDisk);
  const after = splitFrontmatter(next);
  if (frontmatterValue(next, "status") === "draft") {
    // lpwr-amend's door: the flip may change nothing else in the same write.
    const flipped = now.fm.replace(
      /^status:\s*approved\s*$/mu,
      "status: draft"
    );
    return flipped === after.fm && now.body === after.body
      ? null
      : "the approved→draft flip must not carry other changes — split it off (lpwr-amend flips first)";
  }
  const a = acceptanceSection(onDisk);
  const b = acceptanceSection(next);
  if (!a || !b) {
    return "the acceptance table is missing from one side — restore it, or run lpwr-amend";
  }
  if (
    onDisk.slice(0, a.start) !== next.slice(0, b.start) ||
    onDisk.slice(a.end) !== next.slice(b.end)
  ) {
    return "changes outside the acceptance table must go through lpwr-amend (AGENTS rule 9)";
  }
  if (tableIds(onDisk, a) !== tableIds(next, b)) {
    return "the criterion list changed — that is a spec change, run lpwr-amend";
  }
  return null;
};

// Non-blank trimmed lines of a changed-line set.
const changedRows = (lines: readonly string[]): string[] =>
  lines.map((line) => line.trim()).filter((line) => line !== "");

// Changed lines of an `apply_patch` section targeting spec.md: every one must
// be an acceptance-table row, and the criterion ids must line up one-for-one
// (a row's test reference may change; its id may not).
export const patchChangesFrozenSpec = (
  removed: readonly string[],
  added: readonly string[]
): string | null => {
  const oldRows = changedRows(removed);
  const newRows = changedRows(added);
  if (oldRows.length !== newRows.length) {
    return "the patch adds or removes acceptance-table rows — run lpwr-amend";
  }
  for (let index = 0; index < oldRows.length; index += 1) {
    const before = oldRows[index];
    const next = newRows[index];
    if (!before.startsWith("|") || !next.startsWith("|")) {
      return "the patch changes text outside the acceptance table — run lpwr-amend";
    }
    if (rowCells(before)[0] !== rowCells(next)[0]) {
      return "the patch changes a criterion id — run lpwr-amend";
    }
  }
  return null;
};

// --- Review ↔ spec binding (AGENTS rule 9 / implementation-rules 38) ----------
//
// review.md records no version of the spec it reviewed — no hash, no
// timestamp — so the only mechanical tie between the two files is their pair
// of tables: spec.md's acceptance table and the review's Specs axis.
// lpwr-verdict-gate compares them at commit/release; a mismatch means the
// review was rendered against a different spec than the one shipping.

const tableRowsUnder = (raw: string, heading: RegExp): string[] | null => {
  const lines = normalizeEol(raw).split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) {
    return null;
  }
  const rows: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s/u.test(lines[index])) {
      break;
    }
    if (lines[index].trim().startsWith("|")) {
      rows.push(lines[index]);
    }
  }
  return rows;
};

// criterion id → test-reference cell. Both tables put the id first and the
// reference second; the header row (index 0) and `---` separators are dropped
// so the two templates' differently-worded headers never read as a drift.
const criteriaOf = (rows: readonly string[]): Map<string, string> => {
  const criteria = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const [id, ref] = rowCells(row);
    if (index === 0 || !id || /^-+$/u.test(id)) {
      continue;
    }
    criteria.set(id, (ref ?? "").trim());
  }
  return criteria;
};

export const acceptanceTablesDiverge = (
  specRaw: string,
  review: string
): string | null => {
  const specRows = tableRowsUnder(specRaw, ACCEPTANCE_HEADING);
  if (!specRows) {
    return "spec.md has no acceptance table";
  }
  const reviewRows = tableRowsUnder(review, /^##\s+specs axis\b/iu);
  if (!reviewRows) {
    return "review.md has no Specs axis table";
  }
  const spec = criteriaOf(specRows);
  const reviewed = criteriaOf(reviewRows);
  for (const id of spec.keys()) {
    if (!reviewed.has(id)) {
      return `criterion ${id} is in spec.md but was never reviewed`;
    }
  }
  for (const id of reviewed.keys()) {
    if (!spec.has(id)) {
      return `criterion ${id} was reviewed but is no longer in spec.md`;
    }
  }
  for (const [id, specRef] of spec) {
    const reviewRef = reviewed.get(id) ?? "";
    // An empty cell on either side is legitimate (waived/deferred rows, or a
    // reference the review has not recorded) — only two present, disagreeing
    // references prove the spec moved.
    if (specRef && reviewRef && specRef !== reviewRef) {
      return `criterion ${id} cites ${specRef} in spec.md but ${reviewRef} in review.md`;
    }
  }
  return null;
};

// `Audit command:` / `Deploy command:` lines from the constitution — one
// parser for both: lpwr-security-scan reads audit commands, lpwr-verdict-gate
// the deploy command. Placeholder lines (`<…>`, straight from the template)
// declare nothing, so a never-filled constitution gates nothing.
export const constitutionCommands = (raw: string, label: string): string[] => {
  const commands: string[] = [];
  const needle = `${label.trim().toLowerCase()}:`;
  for (const line of normalizeEol(raw).split("\n")) {
    if (!line.trim().toLowerCase().startsWith(needle)) {
      continue;
    }
    const command = line.split(":").slice(1).join(":").trim();
    if (command && !command.includes("<")) {
      commands.push(command);
    }
  }
  return commands;
};

// Strip a trailing YAML ` # …` comment (whitespace before `#` is required for
// it to be a comment in a plain scalar). Values keep their format-hint comments
// from the template; those must not become waived IDs or deferred entries.
export const stripYamlComment = (value: string): string =>
  value.replace(/\s+#.*$/u, "").trim();

// Line-based frontmatter list reader: handles `key: value`, `key: [a, b]`,
// and `- item` lists. Stops at the next key, a blank-line boundary, or `---`.
// Inline comments on the value are stripped before the value is collected.
export const sectionEntries = (fmBlock: string, key: string): string[] => {
  const entries: string[] = [];
  let inside = false;
  for (const line of fmBlock.split("\n")) {
    if (!inside) {
      const header = line.match(new RegExp(`^${key}:\\s*(?<rest>.*)$`, "iu"));
      const rest = stripYamlComment(header?.groups?.rest ?? "");
      if (header?.groups) {
        inside = true;
        if (rest && rest !== "[]" && rest !== "null" && rest !== "~") {
          entries.push(rest);
        }
      }
      continue;
    }
    const item = line.match(/^\s*-\s*(?<entry>.+)$/u);
    if (item?.groups) {
      const entry = stripYamlComment(item.groups.entry);
      if (entry) {
        entries.push(entry);
      }
      continue;
    }
    if (/^\s*$/u.test(line)) {
      continue;
    }
    break;
  }
  return entries;
};

export const stripBrackets = (entry: string): string =>
  entry.replace(/^\[/u, "").replace(/\]$/u, "");

export const isEmptyMarker = (token: string): boolean =>
  /^(?:none|null|~|-|\[\])$/iu.test(token);

export const parseWaived = (fmBlock: string): Set<string> => {
  const ids = new Set<string>();
  for (const entry of sectionEntries(fmBlock, "waived")) {
    for (const id of stripBrackets(entry).split(/[\s,]+/u)) {
      if (id && !isEmptyMarker(id)) {
        ids.add(id);
      }
    }
  }
  return ids;
};

export interface Deferred {
  targets: Map<string, string>;
  error?: string;
}

export const parseDeferred = (fmBlock: string): Deferred => {
  const targets = new Map<string, string>();
  for (const entry of sectionEntries(fmBlock, "deferred")) {
    for (const chunk of stripBrackets(entry).split(/,/u)) {
      const trimmed = chunk.trim();
      if (!trimmed || isEmptyMarker(trimmed)) {
        continue;
      }
      const move = trimmed.match(/^(?<id>\S+)\s*->\s*(?<target>\S+)$/u);
      if (!move?.groups?.id || !move.groups.target) {
        return {
          error: `deferred entry "${trimmed}" must be "<criterion-id> -> <follow-up>"`,
          targets,
        };
      }
      targets.set(move.groups.id, move.groups.target);
    }
  }
  return { targets };
};

export const isPlaceholderRef = (ref: string): boolean =>
  /^\s*<.*>\s*$/u.test(ref) || /^\s*\(pending\)\s*$/iu.test(ref);

// Template scaffolding left unfilled (`<...>`) reads as real content to both
// humans and agents — a skeleton review must never gate anything. Inline
// comments (YAML ` # …`) and code spans document the field format with the
// same angle-bracket metavars as real slots; strip both first so only
// genuine unfilled placeholders count. Returns the first offender, capped,
// or null when the file is fully filled in.
export const templateLeftovers = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const cleaned = line
      .replace(/\s+#\s.*$/u, "")
      .replaceAll(/`[^`\n]*`/gu, "");
    const match = cleaned.match(/<[A-Za-z][^<>\n]*>/u);
    if (match) {
      return match[0].slice(0, 80);
    }
  }
  return null;
};

export const tableComplete = (
  review: string
): { ok: boolean; reason?: string } => {
  const fmBlock = frontmatterBlock(review);
  const waived = fmBlock ? parseWaived(fmBlock) : new Set<string>();
  const deferred = fmBlock
    ? parseDeferred(fmBlock)
    : { targets: new Map<string, string>() };
  if (deferred.error) {
    return { ok: false, reason: deferred.error };
  }
  const rows = review.split("\n").filter((line) => line.trim().startsWith("|"));
  // Skip the header row.
  const data = rows.filter((line) => !/---/u.test(line)).slice(1);
  if (data.length === 0) {
    return { ok: false, reason: "specs axis table has no criterion rows" };
  }
  const seen = new Set<string>();
  for (const row of data) {
    const [criterion, testRef, pass] = rowCells(row);
    if (!criterion) {
      return {
        ok: false,
        reason: `table row without a criterion id: ${row.trim()}`,
      };
    }
    seen.add(criterion);
    if (testRef && isPlaceholderRef(testRef)) {
      return {
        ok: false,
        reason: `criterion ${criterion} cites a placeholder test reference: ${testRef.trim()}`,
      };
    }
    if (pass && /^yes$/iu.test(pass) && testRef) {
      continue;
    }
    if (waived.has(criterion) || deferred.targets.has(criterion)) {
      continue;
    }
    if (pass && /^(?<state>deferred|waived)$/iu.test(pass)) {
      return {
        ok: false,
        reason:
          `criterion ${criterion} is marked "${pass}" in the table but not listed ` +
          `under ${pass.toLowerCase()}: in the review frontmatter`,
      };
    }
    if (!testRef) {
      return {
        ok: false,
        reason: `criterion row lacks a test reference: ${row.trim()}`,
      };
    }
    return {
      ok: false,
      reason:
        `criterion not passing: ${row.trim()} — add a passing test reference ` +
        `or waive/defer it in the review frontmatter`,
    };
  }
  for (const id of [...waived, ...deferred.targets.keys()]) {
    if (!seen.has(id)) {
      return {
        ok: false,
        reason: `waiver lists unknown criterion ${id} — no such row in the specs table`,
      };
    }
  }
  return { ok: true };
};

// Checked boxes in a document's "## Verdict" section, in order of appearance.
// Templates put all options on one line (`- [ ] Ship  [ ] Block  [ ] Redirect`),
// so every box in the section is scanned — prose outside the section never counts.
export const verdictChecked = (
  document: string,
  labels: readonly string[]
): { present: boolean; checked: string[] } => {
  const labelPattern = labels.join("|");
  const boxPattern = new RegExp(
    `\\[(?<mark>[ xX])\\]\\s*(?<label>${labelPattern})\\b`,
    "gu"
  );
  const lines = document.split("\n");
  let inside = false;
  const checked: string[] = [];
  for (const line of lines) {
    if (/^##\s+verdict/iu.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (!inside) {
      continue;
    }
    for (const match of line.matchAll(boxPattern)) {
      const { groups } = match;
      if (groups?.mark && groups.mark !== " " && groups.label) {
        checked.push(groups.label.toLowerCase());
      }
    }
  }
  return { checked, present: inside };
};

export const verdictCheck = (
  review: string
): { ok: boolean; reason?: string } => {
  const { present, checked } = verdictChecked(review, [
    "Ship",
    "Block",
    "Redirect",
  ]);
  if (!present) {
    return { ok: false, reason: "review.md has no Verdict section" };
  }
  if (checked.length === 0) {
    return {
      ok: false,
      reason: "no verdict recorded — tick exactly one of Ship/Block/Redirect",
    };
  }
  if (checked.length > 1) {
    return {
      ok: false,
      reason: `multiple verdicts ticked (${checked.join(", ")}) — exactly one allowed`,
    };
  }
  const [recorded] = checked;
  if (recorded !== "ship") {
    return {
      ok: false,
      reason: `no recorded "ship" verdict (recorded: ${recorded})`,
    };
  }
  return { ok: true };
};

// The Security axis must be fully checked — no unchecked boxes allowed.
// Reviews written before the axis existed fail here: re-render them with the
// current template rather than carrying an unchecked security posture forward.
export const securityAxisComplete = (review: string): boolean => {
  const lines = review.split("\n");
  let inside = false;
  let checked = 0;
  for (const line of lines) {
    if (/^##\s+security axis/iu.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^##\s+/u.test(line)) {
      break;
    }
    if (!inside) {
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("- [ ]")) {
      return false;
    }
    if (/^- \[[xX]\]/u.test(trimmed)) {
      checked += 1;
    }
  }
  return inside && checked > 0;
};

// Threat review must not merely exist — its own verdict has to accept proceeding
// (same content-aware standard as the ADR `status: accepted` design gate).
export const threatAccepted = (threatReview: string): boolean => {
  const { present, checked } = verdictChecked(threatReview, [
    "Acceptable to proceed",
    "Needs changes before proceeding",
  ]);
  return (
    present && checked.length === 1 && checked[0] === "acceptable to proceed"
  );
};

// Memory receipt (Round 2 D6/A3): the motion's "Checked against memory"
// receipt is the observable that implement-time work consulted constitution
// floors, lessons, and memos — the root same-question/same-answer gap. One
// mechanism (presence + fill) enforces all three entries: each line must
// exist, carry content past its label, and hold no unfilled `<...>` template
// placeholder (code spans stripped first so a backticked <id> can't
// false-positive).
export const RECEIPT_KEYS = ["Constitution", "Lessons", "Memos"] as const;

export const receiptIncomplete = (proposal: string): string | null => {
  const lines = normalizeEol(proposal).split("\n");
  const start = lines.findIndex((line) =>
    /^#{1,6}\s+checked against memory\s*$/iu.test(line.trim())
  );
  if (start === -1) {
    return 'no "Checked against memory" heading';
  }
  const receipt: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/u.test(line)) {
      break;
    }
    receipt.push(line);
  }
  for (const key of RECEIPT_KEYS) {
    const entry = receipt.find((line) =>
      new RegExp(`^\\s*-\\s*${key}\\s*:`, "u").test(line)
    );
    if (entry === undefined) {
      return `missing "${key}:" line`;
    }
    const value = entry.replace(/^[\s-]*[\w-]+\s*:\s*/u, "");
    const cleaned = value.replaceAll(/`[^`\n]*`/gu, "");
    if (!cleaned.trim() || /<[A-Za-z]/u.test(cleaned)) {
      return `the "${key}:" line is empty or still holds a template placeholder`;
    }
  }
  return null;
};

export const normalizeGlob = (glob: string): string => {
  let value = glob.replace(/^\.\//u, "");
  if (value.endsWith("/**")) {
    value = value.slice(0, -3);
  } else if (value.endsWith("/*")) {
    value = value.slice(0, -2);
  } else if (value.endsWith("*")) {
    value = value.slice(0, -1);
  }
  return value.replace(/\/+$/u, "");
};

// Naive by design (no glob library in .opencode deps): exact paths, trailing
// /* or /** prefixes, and containment either way. Mid-path ** matches only
// itself — a broader match is a planning conversation, not a string test.
export const overlaps = (left: string, right: string): boolean => {
  const a = normalizeGlob(left);
  const b = normalizeGlob(right);
  if (a.includes("**") || b.includes("**")) {
    return a === b;
  }
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
};

// The declared surface (implementation-rules 46): bullet entries under the
// `### Declared surface` subsection, falling back to every backtick path in
// `## Tasks` when that subsection is absent (older specs). One parser shared
// by lpwr-scope-guard (enforcement) and lpwr-worktree-guard (rule 50 overlap)
// so both read the same list from the same spec. Placeholder metavars (`<...>`)
// are never real surface.
const surfaceBullet = (line: string): string | null => {
  const body = line.match(/^\s*-\s+(?<body>.+)$/u)?.groups?.body?.trim() ?? "";
  const value = body.replace(/^`/u, "").replace(/`$/u, "").trim();
  return value && !value.includes("<") ? value : null;
};

const taskBackticks = (line: string): string[] => {
  const out: string[] = [];
  for (const match of line.matchAll(/`(?<path>[^`]+)`/gu)) {
    const value = match.groups?.path?.trim() ?? "";
    if (value && !value.includes("<") && !value.includes(" ")) {
      out.push(value);
    }
  }
  return out;
};

export const declaredSurfaceFrom = (specRaw: string): string[] => {
  const surface: string[] = [];
  const fallback: string[] = [];
  let inSurface = false;
  let inTasks = false;
  for (const line of normalizeEol(specRaw).split("\n")) {
    if (/^###\s+declared surface\b/iu.test(line)) {
      inSurface = true;
      inTasks = false;
      continue;
    }
    if (/^##\s+tasks\b/iu.test(line)) {
      inTasks = true;
      inSurface = false;
      continue;
    }
    if (/^#{1,6}\s/u.test(line)) {
      inSurface = false;
      inTasks = false;
      continue;
    }
    if (inSurface) {
      const value = surfaceBullet(line);
      if (value) {
        surface.push(value);
      }
    } else if (inTasks) {
      fallback.push(...taskBackticks(line));
    }
  }
  return [...new Set(surface.length > 0 ? surface : fallback)];
};

// Journal folder candidates for a spec ref (lpwr-log-handoffs), in preference
// order: the ref itself when it is spec-shaped (`<domain>-<sequence>` with an
// optional criterion sub-id), plus the parent spec id for criterion refs so
// `auth-014-1` lands in `auth-014`'s folder when it has no folder of its own.
// Empty means "not a spec-shaped ref" — callers must refuse instead of
// creating a folder, so an id-shaped slug (`login-2`) can never mint a
// phantom docs/specs/ entry (Round 6, S5-04/S6-02).
const SPEC_DIR_REF = SPEC_REF;

export const specDirNames = (specRef: string): string[] => {
  if (!SPEC_DIR_REF.test(specRef)) {
    return [];
  }
  const parts = specRef.split("-");
  const last = parts.at(-1) ?? "";
  const prev = parts.at(-2) ?? "";
  if (/^\d+$/u.test(last) && /^\d+$/u.test(prev)) {
    return [specRef, parts.slice(0, -1).join("-")];
  }
  return [specRef];
};

// Round 7 C: a human sets risk_tier once, at lpwr-specs time, and the security
// scan has always run on every spec regardless of tier without feeding anything
// back — so a spec mislabeled `low` got no second signal. These patterns are a
// suggestion, never a gate: no `g` flag, so `.test` stays stateless, and the
// caller is expected to feed them added lines only (a `https://` already in the
// tree is context, not a new network call).
export const ESCALATION_SIGNALS: readonly {
  readonly pattern: RegExp;
  readonly reason: string;
}[] = [
  {
    pattern: /\bfetch\(|\baxios\.|\bhttps?:\/\//u,
    reason: "a new external network call",
  },
  {
    pattern: /\bpermissions?\s*[:=]/iu,
    reason: "a permissions/ACL change",
  },
  {
    pattern: /\bexec\(|\bspawn\(|child_process/u,
    reason: "a new shell/process invocation",
  },
];

// Advisory only — returns the reason to re-check the tier, or null. `high`
// short-circuits (already at the top, nothing to flag); an unparseable tier
// is left alone too, because there is no declared value to contradict. The
// human owns the tier (AGENTS rule 11), so this never upgrades it — it names
// what the diff did so lpwr-review's Security axis can re-confirm it.
export const checkTierMismatch = (
  diff: string,
  declaredTier: string
): string | null => {
  if (declaredTier === "high") {
    return null;
  }
  const hit = ESCALATION_SIGNALS.find((signal) => signal.pattern.test(diff));
  return hit ? hit.reason : null;
};

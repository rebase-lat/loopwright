// Pure gate predicates, extracted from the enforcing plugins so a committed
// node:test fixture harness can exercise them directly (Round 3 D1). This
// module is deliberately self-contained — no local imports — so `node --test`
// can load it without the plugins' `./shared.js` NodeNext specifiers. The
// plugins import these back, so the tested logic and the enforced logic are
// the same functions, never a copy.

export const normalizeEol = (raw: string): string =>
  raw.replaceAll("\r\n", "\n");

export const frontmatterBlock = (raw: string): string | null => {
  const match = normalizeEol(raw).match(/^---\n(?<frontmatter>[\s\S]*?)\n---/u);
  return match?.groups?.frontmatter ?? null;
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

export const rowCells = (row: string): string[] => {
  const parts = row.split("|").map((cell) => cell.trim());
  return parts.filter((_cell, index) => index > 0 && index < parts.length - 1);
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

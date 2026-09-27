// Pure aggregation for `lpwr-metrics` (Round 10 F). Every number the report
// prints is derived here from inputs the plugin reads off disk, so the three
// definitions are testable fixtures rather than prose that can drift from the
// arithmetic. Import-free like gates.ts: `node --test` loads it with no
// fs/git/plugin dependencies, and the caller owns every read.
//
// The definitions, stated once because the report quotes them:
// - rework rate — a spec where an `execute` handoff landed after its first
//   `verify` handoff: review said do it again, and it was done again. A
//   spec reviewed once and shipped is not rework, and a second `verify`
//   alone (lpwr-goal then lpwr-review) is not either.
// - time to first verify — first `verify` minus first `frame`, per spec.
//   Only specs with both are reported; a spec not yet reviewed is absent
//   from the range rather than counted as zero.
// - patches per file — commits whose message carries a traceability ID
//   (AGENTS rule 1) over the distinct files those commits touch. A project
//   developed outside its own spec flow reports "no history" instead of a
//   fabricated ratio.

export interface Handoff {
  readonly intent: string;
  readonly specRef: string;
  readonly ts: number;
}

export interface SpecMetric {
  readonly durationMs: number | null;
  readonly reworked: boolean;
  readonly specRef: string;
  readonly verifyCount: number;
}

export interface Aggregates {
  readonly durations: readonly number[];
  readonly maxMs: number | null;
  readonly medianMs: number | null;
  readonly minMs: number | null;
  readonly paired: number;
  readonly reworkRate: number | null;
  readonly reworked: number;
  readonly specs: number;
}

export interface GitTotals {
  readonly commits: number;
  readonly files: number;
  readonly specs: number;
}

export interface ReportInput {
  readonly aggregates: Aggregates;
  readonly folders: number;
  readonly git: GitTotals | null;
}

const normalizeLines = (raw: string): string[] =>
  raw
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

// oxlint's unicorn/no-array-sort forbids Array#sort because it mutates, and
// this project targets ES2022, whose Array has no toSorted — so the single
// place a sorted copy is needed brings its own insertion sort instead of an
// unchecked disable. n is the spec count, so clarity beats the asymptote.
const sortedCopy = (values: readonly number[]): number[] => {
  const out = [...values];
  for (let i = 1; i < out.length; i += 1) {
    const value = out[i];
    let j = i;
    while (j > 0 && out[j - 1] > value) {
      out[j] = out[j - 1];
      j -= 1;
    }
    out[j] = value;
  }
  return out;
};

const median = (sorted: readonly number[]): number | null => {
  if (sorted.length === 0) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

export const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

export const patchesPerFile = (totals: GitTotals): number | null =>
  totals.files > 0 ? totals.commits / totals.files : null;

const reworkLine = (aggregates: Aggregates): string => {
  const { reworked, specs, reworkRate } = aggregates;
  if (reworkRate === null) {
    return "Rework rate: —";
  }
  const percent = Math.round(reworkRate * 100);
  return (
    `Rework rate: ${reworked}/${specs} (${percent}%) — specs with an ` +
    `Execute handoff after their first Verify handoff`
  );
};

const durationLine = (aggregates: Aggregates): string => {
  const { maxMs, medianMs, minMs, paired } = aggregates;
  if (paired === 0 || medianMs === null || minMs === null || maxMs === null) {
    return "Time to first Verify: no spec has reached a Verify handoff yet";
  }
  const noun = paired === 1 ? "spec" : "specs";
  return (
    `Time to first Verify: median ${formatDuration(medianMs)} ` +
    `(range ${formatDuration(minMs)} – ${formatDuration(maxMs)}) across ` +
    `${paired} ${noun} with a Frame→Verify pair`
  );
};

const gitLine = (git: GitTotals | null): string => {
  if (git === null) {
    return (
      "Patches per file: git history unavailable (not a repository, or git " +
      "could not be run)"
    );
  }
  const ratio = patchesPerFile(git);
  if (ratio === null) {
    return (
      "Patches per file: no commit yet carries a traceability ID, so there " +
      "is no per-file history to divide"
    );
  }
  const noun = git.specs === 1 ? "spec" : "specs";
  return (
    `Patches per file: ${ratio.toFixed(1)} — ${git.commits} commits touching ` +
    `${git.files} distinct files, across ${git.specs} ${noun} in history`
  );
};

const gapLine = (
  aggregates: Aggregates,
  folders: number,
  git: GitTotals | null
): string | null => {
  const gaps: string[] = [];
  const unpaired = aggregates.specs - aggregates.paired;
  if (unpaired > 0) {
    const noun = unpaired === 1 ? "" : "s";
    gaps.push(
      `${unpaired} spec${noun} with a log but no Frame→Verify pair yet`
    );
  }
  const unlogged = folders - aggregates.specs;
  if (unlogged > 0) {
    const noun = unlogged === 1 ? "" : "s";
    gaps.push(`${unlogged} spec folder${noun} with no handoff log yet`);
  }
  if (git !== null && git.specs < aggregates.specs) {
    const missing = aggregates.specs - git.specs;
    gaps.push(
      `${missing} spec${missing === 1 ? "" : "s"} with no commit carrying its ID`
    );
  }
  return gaps.length > 0 ? `Gaps: ${gaps.join("; ")}` : null;
};

// One JSON object per line. A malformed or untimestamped line is skipped, not
// thrown on: the journal writer is explicitly best-effort, so one truncated
// append must not blank the whole report.
export const parseHandoffs = (raw: string): Handoff[] => {
  const handoffs: Handoff[] = [];
  for (const line of normalizeLines(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) {
      continue;
    }
    const {
      intent,
      spec_ref: specRef,
      ts: stamp,
    } = parsed as Record<string, unknown>;
    if (typeof intent !== "string" || typeof specRef !== "string") {
      continue;
    }
    if (typeof stamp !== "string") {
      continue;
    }
    const epoch = Date.parse(stamp);
    if (!Number.isFinite(epoch)) {
      continue;
    }
    handoffs.push({ intent, specRef, ts: epoch });
  }
  return handoffs;
};

// Null when the log yields no usable handoff — a spec folder created but never
// journaled contributes nothing rather than a zero row.
export const specMetric = (
  specRef: string,
  rawLog: string
): SpecMetric | null => {
  const handoffs = parseHandoffs(rawLog);
  if (handoffs.length === 0) {
    return null;
  }
  const firstOf = (intent: string): number | null => {
    const match = handoffs.find((handoff) => handoff.intent === intent);
    return match ? match.ts : null;
  };
  const firstFrame = firstOf("frame");
  const firstVerify = firstOf("verify");
  const reworked =
    firstVerify !== null &&
    handoffs.some(
      (handoff) => handoff.intent === "execute" && handoff.ts > firstVerify
    );
  const durationMs =
    firstFrame !== null && firstVerify !== null && firstVerify >= firstFrame
      ? firstVerify - firstFrame
      : null;
  return {
    durationMs,
    reworked,
    specRef,
    verifyCount: handoffs.filter((handoff) => handoff.intent === "verify")
      .length,
  };
};

export const aggregate = (metrics: readonly SpecMetric[]): Aggregates => {
  const durations = sortedCopy(
    metrics
      .map((metric) => metric.durationMs)
      .filter((value): value is number => value !== null)
  );
  const specs = metrics.length;
  const reworked = metrics.filter((metric) => metric.reworked).length;
  return {
    durations,
    maxMs: durations.at(-1) ?? null,
    medianMs: median(durations),
    minMs: durations[0] ?? null,
    paired: durations.length,
    reworkRate: specs > 0 ? reworked / specs : null,
    reworked,
    specs,
  };
};

export const formatReport = (input: ReportInput): string => {
  const { aggregates, folders, git } = input;
  if (aggregates.specs === 0) {
    return (
      "No spec has a handoff log yet — nothing to aggregate. Specs appear " +
      "here once lpwr-propose journals its first frame line."
    );
  }
  const lines = [
    `Spec folders: ${folders} — ${aggregates.specs} with a handoff log`,
    reworkLine(aggregates),
    durationLine(aggregates),
    gitLine(git),
  ];
  const gaps = gapLine(aggregates, folders, git);
  if (gaps) {
    lines.push(gaps);
  }
  return lines.join("\n");
};

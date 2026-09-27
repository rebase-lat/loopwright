import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregate,
  formatDuration,
  formatReport,
  parseHandoffs,
  patchesPerFile,
  specMetric,
} from "../harness/.opencode/lib/metrics.ts";
import type { SpecMetric } from "../harness/.opencode/lib/metrics.ts";

// Round 10 F: the report is only worth building if its three definitions hold,
// so each is a fixture here rather than a claim in a command file. Inputs are
// hand-written log.ndjson lines — the shape lpwr-log-handoffs actually writes.

const T0 = Date.parse("2026-01-01T00:00:00.000Z");

const line = (intent: string, offsetMs: number, specRef = "auth-014"): string =>
  `${JSON.stringify({
    confidence: "high",
    intent,
    payload: { type: "artifact_pointer", value: `docs/specs/${specRef}/x.md` },
    spec_ref: specRef,
    ts: new Date(T0 + offsetMs).toISOString(),
  })}\n`;

const metricWithDuration = (durationMs: number): SpecMetric => {
  const metric = specMetric(
    "auth-014",
    line("frame", 0) + line("verify", durationMs)
  );
  assert.ok(metric, "a Frame + Verify log always yields a metric");
  return metric;
};

test("parseHandoffs: shaped lines in, skips that cannot be dated", () => {
  const raw = [
    line("frame", 0).trimEnd(),
    "not json at all",
    line("verify", 60_000).trimEnd(),
    JSON.stringify({ intent: "execute", spec_ref: "auth-014" }),
    JSON.stringify({ intent: "execute", spec_ref: "auth-014", ts: "soon" }),
    "",
  ].join("\n");
  const handoffs = parseHandoffs(raw);
  assert.deepEqual(
    handoffs.map((handoff) => handoff.intent),
    ["frame", "verify"],
    "undatable and malformed lines are dropped, never thrown on"
  );
  assert.equal(handoffs[0].ts, T0);
});

test("parseHandoffs: CRLF logs parse identically", () => {
  const crlf =
    `${line("frame", 0).trimEnd()}\r\n${line("verify", 60_000).trimEnd()}\r\n`;
  const handoffs = parseHandoffs(crlf);
  assert.deepEqual(
    handoffs.map((handoff) => handoff.intent),
    ["frame", "verify"]
  );
});

test("specMetric: duration is first Verify minus first Frame", () => {
  const metric = specMetric(
    "auth-014",
    line("frame", 0) + line("specify", 30_000) + line("verify", 120_000)
  );
  assert.ok(metric);
  assert.equal(metric.durationMs, 120_000);
  assert.equal(metric.reworked, false);
  assert.equal(metric.verifyCount, 1);
});

test("specMetric: an Execute after the first Verify is rework", () => {
  const metric = specMetric(
    "auth-014",
    line("frame", 0) +
      line("verify", 60_000) +
      line("execute", 90_000) +
      line("verify", 150_000)
  );
  assert.ok(metric);
  assert.equal(metric.reworked, true);
  assert.equal(metric.verifyCount, 2);
  assert.equal(metric.durationMs, 60_000, "duration stops at the first Verify");
});

test("specMetric: a second Verify alone is not rework", () => {
  // lpwr-goal then lpwr-review both journal `verify` — nobody redid the work.
  const metric = specMetric(
    "auth-014",
    line("frame", 0) + line("verify", 60_000) + line("verify", 70_000)
  );
  assert.ok(metric);
  assert.equal(metric.reworked, false);
  assert.equal(metric.verifyCount, 2);
});

test("specMetric: no handoffs means no row, and a lone Frame has no duration", () => {
  assert.equal(specMetric("auth-014", ""), null);
  assert.equal(specMetric("auth-014", "garbage\n"), null);
  const unreviewed = specMetric("auth-014", line("frame", 0));
  assert.ok(unreviewed);
  assert.equal(unreviewed.durationMs, null);
  assert.equal(unreviewed.reworked, false);
});

test("aggregate: median over an odd and an even count", () => {
  const odd = aggregate([
    metricWithDuration(60_000),
    metricWithDuration(120_000),
    metricWithDuration(180_000),
  ]);
  assert.equal(odd.medianMs, 120_000);
  assert.equal(odd.minMs, 60_000);
  assert.equal(odd.maxMs, 180_000);
  assert.equal(odd.paired, 3);

  const even = aggregate([
    metricWithDuration(60_000),
    metricWithDuration(120_000),
    metricWithDuration(180_000),
    metricWithDuration(300_000),
  ]);
  assert.equal(even.medianMs, 150_000);
});

test("aggregate: rework rate counts every spec, unreviewed ones included", () => {
  const unreviewed = specMetric("auth-014", line("frame", 0));
  assert.ok(unreviewed);
  const totals = aggregate([
    { ...metricWithDuration(60_000), reworked: true },
    { ...metricWithDuration(120_000), reworked: false },
    unreviewed,
  ]);
  assert.equal(totals.specs, 3);
  assert.equal(totals.paired, 2, "a lone Frame has no pair to time");
  assert.equal(totals.reworked, 1);
  assert.equal(totals.reworkRate, 1 / 3);
  assert.equal(aggregate([]).reworkRate, null, "no specs is not 0%");
});

test("patchesPerFile: only divides when a file exists", () => {
  assert.equal(patchesPerFile({ commits: 7, files: 4, specs: 3 }), 1.75);
  assert.equal(patchesPerFile({ commits: 0, files: 0, specs: 0 }), null);
});

test("formatDuration: minutes, hours, and days", () => {
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(47 * 60_000), "47m");
  assert.equal(formatDuration(4 * 3_600_000 + 12 * 60_000), "4h 12m");
  assert.equal(formatDuration(2 * 86_400_000 + 3 * 3_600_000), "2d 3h");
});

test("formatReport: an empty project says so instead of reporting zeros", () => {
  const report = formatReport({
    aggregates: aggregate([]),
    folders: 0,
    git: null,
  });
  assert.match(report, /No spec has a handoff log yet/u);
  assert.doesNotMatch(report, /0%/u);
});

test("formatReport: full report quotes its definitions and names its gaps", () => {
  const unreviewed = specMetric("auth-014", line("frame", 0));
  assert.ok(unreviewed);
  const report = formatReport({
    aggregates: aggregate([
      { ...metricWithDuration(60_000), reworked: true },
      { ...metricWithDuration(180_000), reworked: false },
      unreviewed,
    ]),
    folders: 4,
    git: { commits: 7, files: 4, specs: 1 },
  });
  assert.match(report, /Spec folders: 4 — 3 with a handoff log/u);
  assert.match(report, /Rework rate: 1\/3 \(33%\)/u);
  assert.match(report, /median 2m \(range 1m – 3m\)/u);
  assert.match(report, /Patches per file: 1\.8 — 7 commits/u);
  assert.match(report, /Gaps: /u);
  assert.match(report, /1 spec with a log but no Frame→Verify pair yet/u);
  assert.match(report, /1 spec folder with no handoff log yet/u);
  assert.match(report, /2 specs with no commit carrying its ID/u);
});

test("formatReport: git unavailable is stated, not guessed at", () => {
  const report = formatReport({
    aggregates: aggregate([metricWithDuration(60_000)]),
    folders: 1,
    git: null,
  });
  assert.match(report, /git history unavailable/u);
});

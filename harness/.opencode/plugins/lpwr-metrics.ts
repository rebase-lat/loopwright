// Read-only reporting behind `lpwr-metrics` (Round 10 F): one tool, no gate,
// no write, no spec content read — only handoff timestamps and git history.
// Aggregation lives in lib/metrics.ts so the three definitions are tested
// fixtures; this file owns only the reads (readdir, one log per spec folder,
// one `git log --grep` per spec ID) and hands both over.
//
// The git query follows AGENTS rule 1 — a commit message carries its
// traceability ID — so a project developed outside its own spec flow reports
// "no commit carries an ID" rather than a ratio built from unrelated commits.
// Repeated hashes and paths across specs collapse into sets, so one commit
// naming two IDs still counts once.

import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { tool } from "@opencode-ai/plugin";
import type { Hooks, PluginInput } from "@opencode-ai/plugin";

import { aggregate, formatReport, specMetric } from "../lib/metrics.ts";
import type { GitTotals, ReportInput, SpecMetric } from "../lib/metrics.ts";
import { SPEC_ID } from "../lib/shared.ts";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 15_000;
const COMMIT_HASH = /^[0-9a-f]{40}$/u;

const specFolders = async (root: string): Promise<string[]> => {
  try {
    const entries = await readdir(path.join(root, "docs", "specs"), {
      withFileTypes: true,
    });
    return entries
      .filter((entry) => entry.isDirectory() && SPEC_ID.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

const readLog = async (
  root: string,
  specId: string
): Promise<string | null> => {
  try {
    return await readFile(
      path.join(root, "docs", "specs", specId, "log.ndjson"),
      "utf-8"
    );
  } catch {
    return null;
  }
};

// One spec's commits plus the files they touch: hash lines are commits, every
// other non-blank line is a path (`--format=%H --name-only` interleaves them).
const gitForSpec = async (
  root: string,
  specId: string
): Promise<{ hashes: Set<string>; files: Set<string> } | null> => {
  let stdout = "";
  try {
    ({ stdout } = await execFileAsync(
      "git",
      [
        "-C",
        root,
        "log",
        "-F",
        `--grep=${specId}`,
        "--format=%H",
        "--name-only",
      ],
      { maxBuffer: 10_485_760, timeout: GIT_TIMEOUT_MS }
    ));
  } catch {
    return null;
  }
  const hashes = new Set<string>();
  const files = new Set<string>();
  for (const line of stdout.split("\n")) {
    const value = line.trim();
    if (value === "") {
      continue;
    }
    if (COMMIT_HASH.test(value)) {
      hashes.add(value);
    } else {
      files.add(value);
    }
  }
  return { files, hashes };
};

const gitTotals = async (
  root: string,
  specIds: string[]
): Promise<GitTotals | null> => {
  if (specIds.length === 0) {
    return { commits: 0, files: 0, specs: 0 };
  }
  const perSpec = await Promise.all(
    specIds.map((specId) => gitForSpec(root, specId))
  );
  if (perSpec.every((result) => result === null)) {
    return null;
  }
  const hashes = new Set<string>();
  const files = new Set<string>();
  let specs = 0;
  for (const result of perSpec) {
    if (result === null) {
      continue;
    }
    if (result.hashes.size > 0) {
      specs += 1;
    }
    for (const hash of result.hashes) {
      hashes.add(hash);
    }
    for (const file of result.files) {
      files.add(file);
    }
  }
  return { commits: hashes.size, files: files.size, specs };
};

const metricsPlugin = (plugin: PluginInput): Promise<Hooks> => {
  const root = plugin.directory;
  return Promise.resolve({
    tool: {
      project_metrics: tool({
        args: {},
        description:
          "Report rework rate, time to first Verify, and patches per file across every spec's handoff log and git history. Read-only — writes nothing, reads no spec content.",
        execute: async () => {
          const folders = await specFolders(root);
          const rows = await Promise.all(
            folders.map(async (specId): Promise<SpecMetric | null> => {
              const raw = await readLog(root, specId);
              return raw === null ? null : specMetric(specId, raw);
            })
          );
          const metrics = rows.filter(
            (metric): metric is SpecMetric => metric !== null
          );
          const git = await gitTotals(root, folders);
          const input: ReportInput = {
            aggregates: aggregate(metrics),
            folders: folders.length,
            git,
          };
          return formatReport(input);
        },
      }),
    },
  });
};

export default metricsPlugin;

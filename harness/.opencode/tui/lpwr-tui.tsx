// Loopwright TUI — read-only workflow pulse in the session sidebar (Phase 1).
// Surfaces: active spec frontmatter, verdict tick, waived/deferred counts,
// state.md In flight/Blocked, open audit entries, last journal handoff, and
// foundation gaps. Reads docs/** only — never writes, never gates; enforcement
// stays in the server plugins. Refresh: palette command + file-watcher reload.
// Loads via harness/tui.json (project-level; .opencode/plugins/ is server-only).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  TuiPlugin,
  TuiPluginApi,
  TuiTheme,
} from "@opencode-ai/plugin/tui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { EXPECTED, SPEC_ID, frontmatterValue } from "../lib/shared.js";

type Verdict = "ship" | "block" | "redirect" | "pending" | "missing";

interface Handoff {
  readonly intent: string;
  readonly confidence: string | null;
  readonly origin: string | null;
}

interface WorktreePulse {
  readonly id: string;
  readonly path: string;
  readonly shipped: boolean;
}

interface Pulse {
  readonly specId: string | null;
  readonly status: string | null;
  readonly riskTier: string | null;
  readonly designReview: string | null;
  readonly verdict: Verdict;
  readonly waived: number | null;
  readonly deferred: number | null;
  readonly handoff: Handoff | null;
  readonly inFlight: readonly string[];
  readonly blocked: readonly string[];
  readonly auditOpen: number;
  readonly gaps: readonly string[];
  readonly worktrees: readonly WorktreePulse[];
  readonly asOf: string;
}

const refreshTarget = new EventTarget();
const REFRESH_EVENT = "lpwr:pulse-refresh";

const emitRefresh = (): void => {
  refreshTarget.dispatchEvent(new Event(REFRESH_EVENT));
};

const subscribeRefresh = (listener: () => void): (() => void) => {
  refreshTarget.addEventListener(REFRESH_EVENT, listener);
  return () => {
    refreshTarget.removeEventListener(REFRESH_EVENT, listener);
  };
};

const readText = (file: string): string | null => {
  try {
    return readFileSync(file, "utf-8");
  } catch {
    return null;
  }
};

// Bullets under an exact `## <heading>` section, `## ` prefix stripped.
const sectionBullets = (text: string, heading: string): string[] => {
  const bullets: string[] = [];
  let inside = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) {
      inside = line.trim().toLowerCase() === `## ${heading}`;
      continue;
    }
    if (inside) {
      const bullet = line.match(/^\s*-\s+(?<body>.+)$/u);
      if (bullet?.groups?.body) {
        bullets.push(bullet.groups.body.trim());
      }
    }
  }
  return bullets;
};

// Read-only twin of verdict-gate's verdictChecked: first ticked box inside
// `## Verdict`, else pending (section present) / missing (no review section).
const verdictOf = (review: string): Verdict => {
  const boxPattern = /\[(?<mark>[ xX])\]\s*(?<label>Ship|Block|Redirect)\b/gu;
  let inside = false;
  for (const line of review.split("\n")) {
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
        return groups.label.toLowerCase() as Verdict;
      }
    }
  }
  return inside ? "pending" : "missing";
};

const countList = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const cleaned = value.replace(/^\[/u, "").replace(/\]$/u, "").trim();
  if (cleaned === "" || /^(?:none|null|~|-)$/iu.test(cleaned)) {
    return 0;
  }
  return cleaned.split(",").filter((part) => part.trim() !== "").length;
};

const activeSpecId = (inFlight: readonly string[]): string | null => {
  for (const line of inFlight) {
    const token = line.split(":")[0].trim();
    if (SPEC_ID.test(token)) {
      return token;
    }
  }
  return null;
};

// OPENCODE_SPEC_ID written into a spec worktree's .env at mint — the live
// spec of THIS session even when state.md's optional In flight section is
// empty (Round 6: worktrees are the in-flight record).
const envSpecId = (root: string): string | null => {
  const raw = readText(path.join(root, ".env"));
  if (!raw) {
    return null;
  }
  const line = raw
    .split("\n")
    .find((candidate) => candidate.startsWith("OPENCODE_SPEC_ID="));
  const value = line?.slice("OPENCODE_SPEC_ID=".length).trim() ?? "";
  return SPEC_ID.test(value) ? value : null;
};

const parseHandoff = (line: string): Handoff | null => {
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as {
      intent?: unknown;
      confidence?: unknown;
      origin?: unknown;
    };
    if (typeof record.intent !== "string") {
      return null;
    }
    return {
      confidence:
        typeof record.confidence === "string" ? record.confidence : null,
      intent: record.intent,
      origin: typeof record.origin === "string" ? record.origin : null,
    };
  } catch {
    return null;
  }
};

// The sidebar shows the agent's most recent explicit handoff; the
// post-command backstop line (origin: hook, confidence medium) is a fallback
// only when it is all there is — since journaling moved to command.executed
// it lands last and would otherwise mask the agent's claim (Round 6 review).
const lastHandoff = (file: string): Handoff | null => {
  const raw = readText(file);
  if (!raw) {
    return null;
  }
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  let fallback: Handoff | null = null;
  let explicit: Handoff | null = null;
  for (const line of lines) {
    const entry = parseHandoff(line);
    if (!entry) {
      continue;
    }
    fallback = entry;
    if (entry.origin !== "hook") {
      explicit = entry;
    }
  }
  return explicit ?? fallback;
};

const countAuditOpen = (text: string): number =>
  text.split("\n").filter((line) => /^\s*-\s*status:\s*open\s*$/u.test(line))
    .length;

const handoffLine = (handoff: Handoff | null): string | null => {
  if (!handoff) {
    return null;
  }
  return handoff.confidence === null
    ? `handoff: ${handoff.intent}`
    : `handoff: ${handoff.intent} (conf ${handoff.confidence})`;
};

const specIdOfBullet = (line: string): string | null => {
  const token = line.split(":")[0].trim();
  return SPEC_ID.test(token) ? token : null;
};

const gitRootOf = (start: string): string | null => {
  let dir = path.resolve(start);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
  return null;
};

// The spec folder for the active id: this root when it holds the spec, else
// the owning worktree's harness dir (trunk sessions list worktrees but the
// folders live in them — round 6: pulse reads status/verdict from there).
const specDirOf = (
  root: string,
  specId: string,
  worktrees: readonly WorktreePulse[]
): string => {
  const local = path.join(root, "docs", "specs", specId);
  if (existsSync(path.join(local, "spec.md"))) {
    return local;
  }
  const wt = worktrees.find((entry) => entry.id === specId);
  const repo = gitRootOf(root);
  if (!wt || !repo) {
    return local;
  }
  const rel = path.relative(repo, root);
  return path.join(wt.path, rel, "docs", "specs", specId);
};

// Open spec worktrees, read from the main repo's .git/worktrees. Only the trunk
// session sees these — a linked worktree's `.git` is a file, so this returns
// empty there. Shipped state comes from state.md's Done section.
const readWorktrees = (
  harnessRoot: string,
  shipped: ReadonlySet<string>
): WorktreePulse[] => {
  const repo = gitRootOf(harnessRoot);
  if (!repo) {
    return [];
  }
  let entries: string[];
  try {
    entries = readdirSync(path.join(repo, ".git", "worktrees"));
  } catch {
    return [];
  }
  return entries
    .filter((id) => SPEC_ID.test(id))
    .map((id) => {
      // `.git/worktrees/<id>/gitdir` points at the worktree's own .git file;
      // its dirname is the checkout root the pulse reads spec folders from.
      let worktreeRoot = path.join(repo, ".git", "worktrees", id);
      try {
        const gitdir = readFileSync(
          path.join(worktreeRoot, "gitdir"),
          "utf-8"
        ).trim();
        worktreeRoot = path.dirname(gitdir);
      } catch {
        // Metadata unreadable — keep the id so the listing still renders.
      }
      return { id, path: worktreeRoot, shipped: shipped.has(id) };
    });
};

const loadPulse = (root: string): Pulse => {
  const stateText = readText(path.join(root, "docs", "state.md")) ?? "";
  const inFlight = sectionBullets(stateText, "in flight");
  const blocked = sectionBullets(stateText, "blocked");
  const shipped = new Set(
    sectionBullets(stateText, "done")
      .map(specIdOfBullet)
      .filter((id): id is string => id !== null)
  );
  const worktrees = readWorktrees(root, shipped);
  // Active spec: this session's worktree (.env), then optional state In
  // flight bookkeeping, then the first in-flight worktree (trunk session).
  const specId =
    envSpecId(root) ??
    activeSpecId(inFlight) ??
    worktrees.find((entry) => !entry.shipped)?.id ??
    null;

  let status: string | null = null;
  let riskTier: string | null = null;
  let designReview: string | null = null;
  let verdict: Verdict = "missing";
  let waived: number | null = null;
  let deferred: number | null = null;
  let handoff: Handoff | null = null;

  if (specId) {
    const specDir = specDirOf(root, specId, worktrees);
    const specText = readText(path.join(specDir, "spec.md"));
    if (specText) {
      status = frontmatterValue(specText, "status");
      riskTier = frontmatterValue(specText, "risk_tier");
      designReview = frontmatterValue(specText, "design_review");
    }
    const reviewText = readText(path.join(specDir, "review.md"));
    if (reviewText) {
      verdict = verdictOf(reviewText);
      waived = countList(frontmatterValue(reviewText, "waived"));
      deferred = countList(frontmatterValue(reviewText, "deferred"));
    }
    handoff = lastHandoff(path.join(specDir, "log.ndjson"));
  }

  const auditText = readText(path.join(root, "docs", "audit.md")) ?? "";
  const gaps = EXPECTED.filter(
    ([file]) => !existsSync(path.join(root, file))
  ).map(([file]) => file);

  return {
    asOf: new Date().toLocaleTimeString(),
    auditOpen: countAuditOpen(auditText),
    blocked,
    deferred,
    designReview,
    gaps,
    handoff,
    inFlight,
    riskTier,
    specId,
    status,
    verdict,
    waived,
    worktrees,
  };
};

interface SidebarProps {
  readonly api: TuiPluginApi;
  readonly theme: TuiTheme;
  readonly sessionId: string;
}

const SidebarContent = (props: SidebarProps) => {
  const [pulse, setPulse] = createSignal<Pulse | null>(null);
  const [failure, setFailure] = createSignal<string | null>(null);

  const reload = (): void => {
    try {
      setPulse(loadPulse(props.api.state.path.directory));
      setFailure(null);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  };

  createEffect(() => {
    void props.sessionId;
    reload();
  });

  const unsubscribe = subscribeRefresh(reload);
  onCleanup(unsubscribe);

  const colors = (): TuiTheme["current"] => props.theme.current;

  return (
    <box flexDirection="column">
      <text fg={colors().primary}>
        <b>Loopwright pulse</b>
      </text>

      <Show when={failure()}>
        <text fg={colors().error}>{failure()}</text>
      </Show>

      <Show when={!failure() && !pulse()}>
        <text fg={colors().textMuted}>Loading workflow pulse…</text>
      </Show>

      <Show keyed when={pulse()}>
        {(model: Pulse) => (
          <box flexDirection="column">
            <Show
              when={model.specId}
              fallback={<text fg={colors().textMuted}>no spec in flight</text>}
            >
              <text fg={colors().textMuted}>
                spec {model.specId} · {model.status ?? "?"} · risk{" "}
                {model.riskTier ?? "?"}
              </text>
              <Show when={model.designReview === "required"}>
                <text fg={colors().warning}>design review: required</text>
              </Show>
              <Show when={model.verdict === "pending"}>
                <text fg={colors().warning}>verdict: pending (human)</text>
              </Show>
              <Show when={model.verdict === "missing"}>
                <text fg={colors().textMuted}>review: not written</text>
              </Show>
              <Show
                when={
                  model.verdict === "ship" ||
                  model.verdict === "block" ||
                  model.verdict === "redirect"
                }
              >
                <text
                  fg={
                    model.verdict === "ship" ? colors().success : colors().error
                  }
                >
                  verdict: {model.verdict}
                </text>
              </Show>
              <Show when={model.waived !== null && model.waived > 0}>
                <text fg={colors().warning}>
                  waived {model.waived} · deferred {model.deferred ?? 0}
                </text>
              </Show>
              <Show when={model.handoff}>
                <text fg={colors().textMuted}>
                  {handoffLine(model.handoff)}
                </text>
              </Show>
            </Show>

            <Show when={model.inFlight.length > 0}>
              <text fg={colors().textMuted}>
                in flight: {model.inFlight.join("; ")}
              </text>
            </Show>
            <Show when={model.blocked.length > 0}>
              <text fg={colors().error}>
                blocked: {model.blocked.join("; ")}
              </text>
            </Show>

            <Show when={model.worktrees.length > 0}>
              <text fg={colors().textMuted}>
                worktrees: {model.worktrees.length} open —{" "}
                {model.worktrees
                  .map(
                    (wt) => `${wt.id} (${wt.shipped ? "shipped" : "in flight"})`
                  )
                  .join("; ")}
              </text>
            </Show>

            <Show when={model.auditOpen > 0}>
              <text fg={colors().textMuted}>audit open: {model.auditOpen}</text>
            </Show>

            <Show when={model.gaps.length > 0}>
              <text fg={colors().warning}>gaps: {model.gaps.join(", ")}</text>
            </Show>
            <Show when={model.gaps.length === 0}>
              <text fg={colors().textMuted}>foundation: complete</text>
            </Show>

            <text fg={colors().textMuted}>
              as of {model.asOf} · palette: Refresh Loopwright sidebar
            </text>
          </box>
        )}
      </Show>
    </box>
  );
};

const maybeDispose = (registration: unknown): void => {
  if (typeof registration === "function") {
    registration();
  }
};

const pulseFile = (root: string, changed: string): boolean => {
  const docs = `${path.join(root, "docs")}${path.sep}`;
  if (changed.startsWith(docs)) {
    return true;
  }
  return ["AGENTS.md", "opencode.json", "tui.json"].some(
    (file) => changed === path.join(root, file)
  );
};

const tui: TuiPlugin = (api) => {
  const root = api.state.path.directory;

  const unregisterSlots = api.slots.register({
    order: 1,
    slots: {
      sidebar_content: (context, props) => (
        <SidebarContent
          api={api}
          theme={context.theme}
          sessionId={props.session_id}
        />
      ),
    },
  });

  const unregisterCommand = api.command?.register(() => [
    {
      category: "Plugins",
      description: "Re-read the docs/** workflow pulse",
      onSelect: () => {
        emitRefresh();
        api.ui.toast({
          message: "Loopwright sidebar refresh requested",
          variant: "info",
        });
      },
      title: "Refresh Loopwright sidebar",
      value: "lpwr.refresh",
    },
  ]);

  let pending: ReturnType<typeof setTimeout> | undefined;
  const offEvent = api.event.on("file.watcher.updated", (event) => {
    const changed = (event as { path?: string }).path;
    const relevant = changed === undefined ? true : pulseFile(root, changed);
    if (relevant) {
      if (pending !== undefined) {
        clearTimeout(pending);
      }
      pending = setTimeout(() => {
        pending = undefined;
        emitRefresh();
      }, 300);
    }
  });

  api.lifecycle.onDispose(() => {
    if (pending !== undefined) {
      clearTimeout(pending);
    }
    offEvent();
    maybeDispose(unregisterCommand);
    maybeDispose(unregisterSlots);
  });

  return Promise.resolve();
};

export default { id: "lpwr-tui", tui };

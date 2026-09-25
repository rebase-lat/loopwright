// Loopwright TUI — read-only workflow pulse in the session sidebar (Phase 1).
// Surfaces: active spec frontmatter, verdict tick, waived/deferred counts,
// state.md In flight/Blocked, open audit entries, last journal handoff, and
// foundation gaps. Reads docs/** only — never writes, never gates; enforcement
// stays in the server plugins. Refresh: palette command + file-watcher reload.
// Loads via harness/tui.json (project-level; .opencode/plugins/ is server-only).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  TuiPlugin,
  TuiPluginApi,
  TuiTheme,
} from "@opencode-ai/plugin/tui";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { EXPECTED, SPEC_ID, frontmatterValue } from "../plugins/shared.js";

type Verdict = "ship" | "block" | "redirect" | "pending" | "missing";

interface Handoff {
  readonly intent: string;
  readonly confidence: number | null;
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
  if (!value || value === "none") {
    return value === "none" ? 0 : null;
  }
  return value.split(",").length;
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

const lastHandoff = (file: string): Handoff | null => {
  const raw = readText(file);
  if (!raw) {
    return null;
  }
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const tail = lines.at(-1);
  if (!tail) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(tail);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const record = parsed as { intent?: unknown; confidence?: unknown };
    if (typeof record.intent !== "string") {
      return null;
    }
    const confidence =
      typeof record.confidence === "number" ? record.confidence : null;
    return { confidence, intent: record.intent };
  } catch {
    return null;
  }
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
    : `handoff: ${handoff.intent} (conf ${handoff.confidence.toFixed(2)})`;
};

const loadPulse = (root: string): Pulse => {
  const stateText = readText(path.join(root, "docs", "state.md")) ?? "";
  const inFlight = sectionBullets(stateText, "in flight");
  const blocked = sectionBullets(stateText, "blocked");
  const specId = activeSpecId(inFlight);

  let status: string | null = null;
  let riskTier: string | null = null;
  let designReview: string | null = null;
  let verdict: Verdict = "missing";
  let waived: number | null = null;
  let deferred: number | null = null;
  let handoff: Handoff | null = null;

  if (specId) {
    const specDir = path.join(root, "docs", "specs", specId);
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

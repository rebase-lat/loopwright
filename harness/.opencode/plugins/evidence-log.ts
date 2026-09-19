import type { Plugin } from "@opencode-ai/plugin";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const INTENTS = new Set(["frame", "specify", "execute", "verify", "retain", "govern"]);

// Appends A2A handoff lines to docs/specs/<id>/log.ndjson — the one
// artifact every domain writes to. Agents also append lines directly
// (per their command prompts); this plugin is the canonical backstop:
// any bus event carrying {intent, spec_ref, payload} is journaled.
// Never throws — a logging failure must not break the loop.
// A payload is always a pointer, never inline content (rule 20) —
// malformed handoffs are skipped, not journaled.
function isPointer(payload: any): boolean {
  return (
    payload &&
    typeof payload === "object" &&
    payload.type === "artifact_pointer" &&
    typeof payload.value === "string" &&
    payload.value.length > 0
  );
}

function specDirOf(specRef: string): string | null {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*-\d+(-\d+)?$/i.test(specRef)) return null;
  const parts = specRef.split("-");
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  const dir =
    /^\d+$/.test(last) && /^\d+$/.test(prev)
      ? parts.slice(0, -1).join("-")
      : /^\d+$/.test(last)
        ? specRef
        : null;
  return dir;
}

function extractHandoff(evt: any): any | null {
  const candidates = [evt, evt?.payload, evt?.data, evt?.output, evt?.message];
  for (const c of candidates) {
    if (c && typeof c === "object" && typeof c.intent === "string" && typeof c.spec_ref === "string") {
      return c;
    }
  }
  return null;
}

export default (async () => {
  return {
    event: async (input: any) => {
      try {
        const h = extractHandoff(input);
        if (!h || !INTENTS.has(h.intent)) return;
        const dir = specDirOf(h.spec_ref);
        if (!dir || !isPointer(h.payload)) return;
        const line =
          JSON.stringify({
            ts: new Date().toISOString(),
            intent: h.intent,
            spec_ref: h.spec_ref,
            payload: h.payload,
            confidence: h.confidence ?? "medium",
          }) + "\n";
        const path = `docs/specs/${dir}/log.ndjson`;
        await mkdir(dirname(path), { recursive: true });
        await appendFile(path, line, "utf-8");
      } catch {
        // logging must never break the loop
      }
    },
  };
}) satisfies Plugin;

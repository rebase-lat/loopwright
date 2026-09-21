import type { Hooks, PluginInput } from "@opencode-ai/plugin";

// Surfaces session errors as TUI toasts pointing at lpwr-diagnose. User
// cancellations (MessageAbortedError) stay silent — aborting is intent, not
// failure. Best-effort only: with no attached TUI the call is a harmless
// no-op, and any delivery failure is swallowed.
const surfaceErrors = (plugin: PluginInput): Promise<Hooks> =>
  Promise.resolve({
    event: async (input) => {
      if (input.event.type !== "session.error") {
        return;
      }
      const name = input.event.properties.error?.name ?? "UnknownError";
      if (name === "MessageAbortedError") {
        return;
      }
      try {
        await plugin.client.tui.showToast({
          body: {
            message: `Session error (${name}) — run lpwr-diagnose to investigate.`,
            title: "Loopwright",
            variant: "error",
          },
          query: { directory: plugin.directory },
        });
      } catch {
        // Toast delivery is best-effort only.
      }
    },
  });

export default surfaceErrors;

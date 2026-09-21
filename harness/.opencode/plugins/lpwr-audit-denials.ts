import type { Hooks } from "@opencode-ai/plugin";

// Advisory audit: permission denials are otherwise silent. Records who tried
// what, where — never blocks and never overrides the decision (output.status
// is observed, not mutated).
const auditDenials = (): Promise<Hooks> =>
  Promise.resolve({
    "permission.ask": (input, output) => {
      if (output.status !== "deny") {
        return Promise.resolve();
      }
      console.warn(
        `[permission-denied] ${input.type} "${input.title}" (session ${input.sessionID}).`
      );
      return Promise.resolve();
    },
  });

export default auditDenials;

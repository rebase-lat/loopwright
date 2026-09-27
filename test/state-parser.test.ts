import assert from "node:assert/strict";
import test from "node:test";

import { stateSectionHasEntry } from "../harness/.opencode/lib/gates.ts";

// Round 8 Wave 3: this parser used to exist three times (lib/worktree.ts,
// plugins/lpwr-verdict-gate.ts, plugins/lpwr-spec-link.ts), none of them
// tested. One definition in gates.ts now backs all three callers.

const state = `# State

## Done
<!-- - <id>: <one line> -->
- auth-014: shipped the login flow

## Blocked
- auth-020: waiting on the human

## Next
- auth-021: next up
`;

test("stateSectionHasEntry: membership, sections, and id boundaries", () => {
  assert.equal(stateSectionHasEntry(state, "done", "auth-014"), true);
  assert.equal(stateSectionHasEntry(state, "blocked", "auth-020"), true);
  assert.equal(stateSectionHasEntry(state, "next", "auth-021"), true);

  // Right id, wrong section.
  assert.equal(stateSectionHasEntry(state, "done", "auth-020"), false);
  // Boundary: auth-014 must not match auth-0144, nor auth-02 auth-020-style
  // prefixes (the lookahead requires `:`, whitespace, or end).
  assert.equal(stateSectionHasEntry(state, "done", "auth-0144"), false);
  assert.equal(stateSectionHasEntry(state, "blocked", "auth-02"), false);
  // Unknown section.
  assert.equal(stateSectionHasEntry(state, "shipped", "auth-014"), false);
});

test("stateSectionHasEntry: section headers are case-insensitive", () => {
  assert.equal(stateSectionHasEntry(state, "DONE", "auth-014"), true);
  assert.equal(stateSectionHasEntry(state, "Blocked", "auth-020"), true);
});

test("stateSectionHasEntry: entry shapes and comment lines", () => {
  // `- <id>: <reason>` (the documented shape) and `- <id> <text>`.
  assert.equal(
    stateSectionHasEntry("## Done\n- auth-014 ships now", "done", "auth-014"),
    true
  );
  // A template comment must not read as an entry.
  assert.equal(stateSectionHasEntry("## Done\n<!-- - <id>: <one line> -->", "done", "id"), false);
  // Empty input / missing section.
  assert.equal(stateSectionHasEntry("", "done", "auth-014"), false);
});

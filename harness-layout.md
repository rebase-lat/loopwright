# Harness Layout

Target: OpenCode and compatible agents (AGENTS.md + `.opencode/` conventions).
Operating unit: small team, shared repo conventions, config committed to version control.

This revision folds in the accepted recommendations: the constitution as a concrete artifact, a
traceability ID scheme, a verdict/permissions model, an A2A message schema, and agents promoted
to a full harness piece alongside templates.

---

## 1. The six domains, with gates and artifacts

| Domain      | Command(s)                          | Owner  | Exit gate                              | Artifact                        |
| ----------- | ------------------------------------ | ------ | --------------------------------------- | -------------------------------- |
| **Govern**  | `/constitution`, `/codebase`, `/domain`, `/stack` | Team   | Amendment review (never per-task)       | `docs/constitution.md`, `docs/glossary.md` |
| **Frame**   | `/propose`, `/interview`, `/research`, `/improve` | Human  | Human picks one option                  | `docs/specs/<id>/proposal.md`   |
| **Specify** | `/specs`, `/tasks`                  | Human  | Criteria approved                       | `docs/specs/<id>/spec.md`, `tasks.md` |
| **Execute** | `/implement`, `/diagnose`           | Agent  | Tests pass, scope intact                | diff, run log                   |
| **Verify**  | `/review`, `/goal`, `/release`      | Human  | Ship / block / redirect                 | `docs/specs/<id>/review.md`     |
| **Retain**  | `/commit`, `/teach`                 | Both   | Lesson + state written                  | `docs/state.md`, `docs/lessons/` |

**Running underneath all six**, not owned by any one domain: the traceability ID and the audit
log (Decision 2 and 4 of the recommendations). Every artifact above is filed under one spec ID,
and every agent handoff appends one line to that spec's log.

---

## 2. Placement rule (six pieces now)

Agents join the harness as a full piece — a role bound to a permission set and a model, not a
persona inside one prompt. Templates get the same status they should have had from the start:
answerability needs a fixed record shape, and an unowned shape drifts.

1. **Must it hold even when nobody invokes it?** → Instruction (`AGENTS.md`, `constitution.md`)
2. **Must it hold whether or not the agent cooperates?** → Plugin or hook
3. **Is it a procedure the agent should follow when a situation arises?** → Skill
4. **Is it a human entry point into a domain?** → Command
5. **Is it the shape of an output artifact?** → Template
6. **Is it a role with distinct permissions or model?** → Agent

Prose advises, plugins enforce, agents isolate. That's the whole rule in one line.

---

## 3. Directory layout

```
repo/
├── AGENTS.md                      # protocol + pointer to constitution, never the rules themselves
├── opencode.json                  # models, permissions (table in §6), mcp, instructions
│
├── .opencode/
│   ├── agents/
│   │   ├── build.md               # write, shell (scoped), execute domain
│   │   ├── plan.md                # read-only, frame + specify domains
│   │   ├── neutral.md             # triage seat 1 — no independent view yet
│   │   ├── deep-expert.md         # triage seat 2 — domain truth, "what should happen"
│   │   ├── applied-judge.md       # triage seat 3 — testability, "what would convince me"
│   │   ├── reviewer.md            # read-only, verify domain, standards + specs axes
│   │   └── scout.md               # ephemeral, retrieval only, returns summaries
│   │
│   ├── commands/
│   │   ├── govern/                # constitution, codebase, domain, stack
│   │   ├── frame/                 # propose, interview, research, improve
│   │   ├── specify/                # specs, tasks
│   │   ├── execute/                # implement, diagnose
│   │   ├── verify/                 # review, goal, release
│   │   └── retain/                 # commit, teach
│   │
│   ├── skills/
│   │   ├── writing-ears/SKILL.md
│   │   ├── acceptance-criteria/SKILL.md
│   │   ├── option-triage/SKILL.md
│   │   ├── explain-back/SKILL.md
│   │   ├── diff-reading/SKILL.md
│   │   ├── repro-minimisation/SKILL.md
│   │   ├── boundary-audit/SKILL.md
│   │   ├── root-cause-refactor/SKILL.md
│   │   ├── primary-sources/SKILL.md
│   │   ├── context-economy/SKILL.md
│   │   └── commit-grouping/SKILL.md
│   │
│   ├── plugins/
│   │   ├── trap-flags.ts          # achievement + dislodging trap detection (mechanical only)
│   │   ├── scope-guard.ts         # blocks edits outside the active spec's declared surface
│   │   ├── spec-link.ts           # refuses /implement without an approved spec id
│   │   ├── evidence-log.ts        # appends a2a messages to log.ndjson
│   │   └── context-compactor.ts   # prunes tool output, never prunes diff/tests/logs/why
│   │
│   └── tools/
│
├── docs/
│   ├── constitution.md
│   ├── glossary.md
│   ├── stack.md
│   ├── standards/
│   ├── specs/<id>/                # proposal.md, spec.md, tasks.md, review.md, log.ndjson
│   ├── lessons/<date>-<id>.md
│   └── state.md
│
└── templates/                     # referenced by commands via @, shown in full in §5
    ├── constitution.md
    ├── proposal.md
    ├── spec.md
    ├── tasks.md
    ├── review.md
    ├── lesson.md
    └── state.md
```

---

## 4. Traceability ID and A2A message schema

**ID format:** `<domain>-<sequence>` for a spec (`auth-014`), `<domain>-<sequence>-<n>` for one
of its acceptance criteria (`auth-014-3`). The ID is the worktree name, the branch name, the
`docs/specs/<id>/` folder name, and a required field in every commit message.

**Intent tag vocabulary** — closed set, one per domain, doubles as a cycle-breaker (a
`verify`-tagged handoff can never re-delegate to another `verify` agent):

```
frame | specify | execute | verify | retain | govern
```

**A2A message shape** — three required fields, one optional, payload always a pointer:

```json
{
  "intent": "execute",
  "spec_ref": "auth-014-3",
  "payload": { "type": "artifact_pointer", "value": "docs/specs/auth-014/tasks.md" },
  "confidence": "high"
}
```

**Audit log** — one line per message, appended to `docs/specs/<id>/log.ndjson`:

```jsonc
{"ts":"2026-09-19T14:02:11Z","intent":"execute","spec_ref":"auth-014-3","payload":{"type":"artifact_pointer","value":"docs/specs/auth-014/tasks.md"},"confidence":"high"}
{"ts":"2026-09-19T14:11:47Z","intent":"verify","spec_ref":"auth-014-3","payload":{"type":"artifact_pointer","value":"diff:HEAD~1..HEAD"},"confidence":"medium"}
```

---

## 5. Templates (full content)

### `templates/constitution.md`

```markdown
---
status: approved
last_amended: <date>
---

# Project constitution

Ubiquitous rules — always true, never re-litigated per spec.

## Non-functional floors
- The system shall never log credentials or secrets in plaintext.
- The system shall reject any request without authentication.
- The system shall respond to <critical path> within <threshold>.

## Verdict floor
A spec may be marked "ship" only when:
- every acceptance criterion sub-ID has a passing test referencing it, and
- a human has read the diff in full, not only the test output.

## Verdict authority
- Low-risk changes (docs, config, non-behavioral refactors): self-approval permitted.
- Behavioral changes: one reviewer other than the implementer required.

## Standards enforcement
| Language | Linter | Formatter | CI gate |
| --- | --- | --- | --- |
| <lang> | <tool> | <tool> | <required check name> |

## Glossary pointer
See `docs/glossary.md` — banned substitutes are enforced, not suggested.
```

### `templates/spec.md`

```markdown
---
id: <domain>-<sequence>
status: draft   # draft | approved | superseded
supersedes: null
proposal_ref: docs/specs/<id>/proposal.md
---

# Spec: <title>

## Ubiquitous
- <id>-1: The system shall <always-true behavior>.

## Event-driven
- <id>-2: When <trigger>, the system shall <response>.

## State-driven
- <id>-3: While <state>, the system shall <behavior>.

## Unwanted behavior
- <id>-4: If <condition>, then the system shall <response>.

## Optional features
- <id>-5: Where <feature> is included, the system shall <behavior>.

## Non-goals
- <explicitly out of scope, to prevent scope creep during /implement>

## Acceptance criteria → test binding
| Criterion ID | Test reference (filled by /implement) |
| --- | --- |
| <id>-1 | (pending) |
```

### `templates/tasks.md`

```markdown
---
id: <domain>-<sequence>
spec_ref: docs/specs/<id>/spec.md
---

# Tasks

1. [ ] <task> — satisfies <id>-1
2. [ ] <task> — satisfies <id>-2, <id>-4
3. [ ] <task> — satisfies <id>-3
```

### `templates/review.md`

```markdown
---
id: <domain>-<sequence>
diff_ref: HEAD~<n>..HEAD
---

# Review: <title>

## Standards axis
- [ ] Passes linter / formatter / CI gate named in constitution.md
- Notes: <deviations, if any, and why>

## Specs axis
| Criterion ID | Test reference | Pass? |
| --- | --- | --- |
| <id>-1 | <test> | yes/no |

## Verdict
- [ ] Ship  [ ] Block  [ ] Redirect
- Reasoning: <why the evidence above is or isn't enough>
```

### `templates/lesson.md`

```markdown
---
spec_ref: <domain>-<sequence>
date: <date>
failure_bucket: null   # wrong-spec | wrong-implementation | flaky-check | harness-defect
---

# Lesson

The single highest-value thing learned from this loop — specific to this problem,
not general advice already covered by a skill.
```

### `templates/state.md`

```markdown
# State

## Done
- <id>: <one line>

## In flight
- <id>: <one line, current step>

## Blocked
- <id>: <reason escalated>

## Next
- <id>: <one line>
```

---

## 6. Code snippets

### Permissions model — `opencode.json` excerpt

```jsonc
{
  "agent": {
    "build":         { "permission": { "write": "allow", "bash": "ask", "webfetch": "deny" } },
    "plan":          { "permission": { "write": "deny",  "bash": "deny", "webfetch": "allow" } },
    "neutral":       { "permission": { "write": "deny",  "bash": "deny", "webfetch": "deny" } },
    "deep-expert":   { "permission": { "write": "deny",  "bash": "deny", "webfetch": "allow" } },
    "applied-judge": { "permission": { "write": "deny",  "bash": "deny", "webfetch": "deny" } },
    "reviewer":      { "permission": { "write": "deny",  "bash": "deny", "webfetch": "deny" } }
  }
}
```

### `plugins/scope-guard.ts` — blocks edits outside the active spec's declared surface

```typescript
import type { Plugin } from "@opencode-ai/plugin";

export const ScopeGuard: Plugin = async ({ project }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") return;
      const specId = process.env.OPENCODE_SPEC_ID;
      if (!specId) return; // no active spec — nothing to guard
      const tasksPath = `docs/specs/${specId}/tasks.md`;
      const declaredSurface = await readDeclaredSurface(tasksPath); // glob list
      if (!matchesAny(output.args.filePath, declaredSurface)) {
        throw new Error(
          `Blocked: ${output.args.filePath} is outside the declared surface for ${specId}. ` +
          `Update tasks.md first if scope genuinely changed.`
        );
      }
    },
  };
};
```

### `plugins/trap-flags.ts` — achievement trap (patch count) and dislodging trap (timebox)

```typescript
import type { Plugin } from "@opencode-ai/plugin";

const patchCounts = new Map<string, number>();
const fileTimers = new Map<string, number>();
const TIMEBOX_MS = 15 * 60 * 1000;

export const TrapFlags: Plugin = async () => {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit") return;
      const file = output.args.filePath;

      const count = (patchCounts.get(file) ?? 0) + 1;
      patchCounts.set(file, count);
      if (count > 3) {
        console.warn(`[achievement-trap] ${file}: ${count} consecutive patches — ` +
          `consider a root-cause refactor instead of another incremental edit.`);
      }

      const first = fileTimers.get(file) ?? Date.now();
      fileTimers.set(file, first);
      if (Date.now() - first > TIMEBOX_MS) {
        console.warn(`[dislodging-trap] ${file}: over 15 minutes without resolution — ` +
          `stash and reset strategy per the countermeasure.`);
      }
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash" && /^git commit/.test(output.args.command)) {
        patchCounts.clear();
        fileTimers.clear();
      }
    },
  };
};
```

### `plugins/spec-link.ts` — refuses `/implement` without an approved spec

```typescript
import type { Plugin } from "@opencode-ai/plugin";
import { readFile } from "node:fs/promises";

export const SpecLink: Plugin = async () => {
  return {
    "command.execute.before": async (input, output) => {
      if (output.command !== "implement") return;
      const specId = output.args.specId;
      if (!specId) throw new Error("Blocked: /implement requires a spec id.");
      const raw = await readFile(`docs/specs/${specId}/spec.md`, "utf-8");
      if (!raw.startsWith("---\nstatus: approved")) {
        throw new Error(`Blocked: spec ${specId} is not approved yet.`);
      }
    },
  };
};
```

### `commands/execute/implement.md` — thin command, loads skill and template by reference

```markdown
---
agent: build
---

Implement the tasks in @docs/specs/$SPEC_ID/tasks.md against the approved spec
@docs/specs/$SPEC_ID/spec.md.

Use skill: acceptance-criteria — every task must produce a test referencing its
criterion sub-ID before being marked done.

On completion, append one line to docs/specs/$SPEC_ID/log.ndjson with intent
"execute", spec_ref set to the task's criterion id, and payload pointing to the
diff — do not inline the diff into the message.
```

### `commands/verify/review.md`

```markdown
---
agent: reviewer
---

Review the diff HEAD~1..HEAD against @docs/specs/$SPEC_ID/spec.md using
@templates/review.md. Fill both axes — standards and specs — before rendering
a verdict. Do not render "ship" unless every criterion in the acceptance table
has a passing test reference.
```

### `docs/glossary.md` excerpt — banned substitutes

```markdown
# Glossary

| Term | Definition | Banned substitutes |
| --- | --- | --- |
| Spec | An approved `docs/specs/<id>/spec.md` file | "requirements doc", "ticket", "PRD" |
| Verdict | The human decision recorded in review.md | "approval", "sign-off" (too ambiguous — use verdict) |
```

---

## 7. Team conventions

- **Worktrees per spec ID**, not per person — enforced by `scope-guard.ts` reading
  `OPENCODE_SPEC_ID` from the worktree's environment.
- **Config precedence**: repo `.opencode/` is authoritative for output quality; personal
  `~/.config/opencode/` holds only ergonomics.
- **Harness changes reviewed like code** — a new skill or amended instruction goes through
  `/propose` → `/review`, same as any spec.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is
  binding rather than the orchestration tax being real.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

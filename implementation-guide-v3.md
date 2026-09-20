# Loopwright — Implementation Guide (v3)

Supersedes the command directory structure in the earlier harness layout document (the nested
`commands/<domain>/` path and its `/domain:command` invocation are dropped in favor of a flat,
prefixed command set, closer to OpenSpec's `opsx-*` convention). Everything else previously
established — the six domains' gates, the traceability ID scheme, the A2A schema, the templates'
content — still holds; this document folds in what changed and gives the full, current picture in
one place.

---

## 1. What changed and why

| Change | Reason |
| --- | --- |
| Commands are flat, all in `commands/`, each named `lpwr-<verb>.md` | Straightforward flow like OpenSpec — one flat list to scan, no path depth to remember |
| A `lpwr-` prefix applies to commands and skill folders | Prevents collision with a team's existing commands/skills, same role `opsx-` plays for OpenSpec |
| A new **Bootstrap** stage precedes Govern | Package installation and env config aren't project truth or a code change — they're a precondition for the harness to run at all |
| Three new commands: `lpwr-setup`, `lpwr-onboard`, `lpwr-guide` | Environment bootstrap, one guided entry point into Govern, and a stateless "what's next" helper |
| Plugins and agents keep their existing names, deliberately unprefixed | See §4 — different collision risk profile than commands |

---

## 2. Full stage and command table

| Stage | Command | Purpose | Gate | Reads | Writes |
| --- | --- | --- | --- | --- | --- |
| **Bootstrap** | `lpwr-setup` | Install deps, configure env, for the dev environment itself | None — runs before anything else can | package manifest | local env only, nothing under `docs/` |
| **Govern** | `lpwr-onboard` | Guided first-run: walk codebase, domain language, stack, tools, and draft principles in one pass | None (informational, but should run once before real specs start) | the repo | `docs/context.md`, drafts `docs/constitution.md` |
| **Govern** | `lpwr-codebase` | Refresh the codebase section of `context.md` after structural change | None | the repo | `docs/context.md` (codebase section) |
| **Govern** | `lpwr-domain` | Refresh the domain-language section, updates the glossary | None | the repo, prior glossary | `docs/context.md` (domain section), `docs/glossary.md` |
| **Govern** | `lpwr-stack` | Refresh the stack/tools section | None | the repo | `docs/context.md` (stack section) |
| **Govern** | `lpwr-constitution` | Amend the constitution | Goes through `lpwr-propose` → `lpwr-review` | `docs/context.md` | `docs/constitution.md` |
| **Frame** | `lpwr-propose` | Draft options for a problem worth solving | Human picks one | `docs/context.md`, `docs/lessons/*` | `docs/specs/<id>/proposal.md` |
| **Frame** | `lpwr-interview` | Clarify an ambiguous ask before proposing | None | conversation | feeds `lpwr-propose` |
| **Frame** | `lpwr-research` | Produce a cited memo on a topic | None | primary sources | `docs/memos/*.md` |
| **Frame** | `lpwr-improve` | Surface candidate upkeep work | None | the repo, `docs/state.md` | new candidate in Frame, not code |
| **Specify** | `lpwr-specs` | Write EARS acceptance criteria from the proposal | Human approves criteria | `proposal.md`, `constitution.md`, `glossary.md` | `docs/specs/<id>/spec.md` |
| **Specify** | `lpwr-tasks` | Order the spec into tasks | None (feeds Execute) | `spec.md` | `docs/specs/<id>/tasks.md` |
| **Execute** | `lpwr-implement` | Do the work | Tests pass, scope intact | `spec.md`, `tasks.md`, `stack.md` section | diff, run log, fills test-ref column in `spec.md` |
| **Execute** | `lpwr-diagnose` | Investigate a failure before patching | None | repro, logs | feeds `lpwr-implement` |
| **Verify** | `lpwr-review` | Render a verdict | Ship / block / redirect | diff, `spec.md` | `docs/specs/<id>/review.md` |
| **Verify** | `lpwr-goal` | Check for drift between spec and implementation | None (informational) | `spec.md`, diff | nothing — a check, not an artifact |
| **Verify** | `lpwr-release` | Trigger deploy | Requires a recorded "ship" | `review.md` | deploy record |
| **Retain** | `lpwr-commit` | Close the loop | Requires a "ship" verdict | `review.md` | git commit, `docs/state.md` |
| **Retain** | `lpwr-teach` | Record the loop's one lesson | None | `log.ndjson` for the spec | `docs/lessons/<date>-<id>.md` |
| *(cross-cutting)* | `lpwr-guide` | Suggest the next command to run | None — read-only | `docs/context.md`, `docs/state.md`, active spec's files | nothing |

---

## 3. The three new commands, in detail

### `lpwr-setup` — Bootstrap

Runs once per developer machine or fresh clone, before any other `lpwr-*` command is expected to
work reliably. Installs project dependencies (via whatever package manager the repo already
declares), configures required environment variables (prompting for secrets rather than writing
them to a tracked file), and verifies the plugin runtime (Bun, for OpenCode's plugin loader) is
present.

- **No gate, because it can't have one** — a gate implies something checks the environment is
  correctly set up, but `lpwr-setup` *is* that check. If it fails, it should say plainly what's
  missing (a specific env var, a specific binary) rather than a generic error.
- **Produces nothing under `docs/`.** Its output is a working environment, not a project artifact
  — keep it entirely out of the traceability ID scheme; it has no spec to attach to.
- **Idempotent.** Running it twice on an already-configured machine should be a no-op with a
  confirmation, not an error.

### `lpwr-onboard` — Govern's front door

A single guided pass that produces `docs/context.md` — one file covering codebase structure,
domain language, stack and tooling, and a drafted `docs/constitution.md` built from what it
finds, not invented in a vacuum (this is the direct fix for gap #13 from the earlier analysis:
the constitution is grounded in real discovery, never written first).

- Works on new and existing code the same way: on a fresh repo, most sections come back thin
  (which is fine — the file grows as real code lands); on an existing repo, this is where real
  content — actual lint config, actual test coverage, actual non-functional realities — gets
  captured.
- **Does not gate anything by itself**, but `lpwr-guide` treats the absence of `docs/context.md`
  as the strongest possible signal to run this first — see §3.3.
- The four granular Govern commands (`lpwr-codebase`, `lpwr-domain`, `lpwr-stack`,
  `lpwr-constitution`) remain available afterward for refreshing one section without re-running
  the whole pass — `lpwr-onboard` is the front door, not the only door.

### `lpwr-guide` — the "what's next" helper

Read-only, callable at any point, from any domain. It walks a fixed decision path over file
existence and state, in order, and stops at the first unmet condition:

1. No `docs/context.md` → suggest `lpwr-onboard`.
2. No `docs/constitution.md` → suggest `lpwr-onboard` (or `lpwr-constitution` if context exists
   but the constitution was skipped).
3. `docs/state.md` has nothing "In flight" → suggest `lpwr-propose` to start the next spec.
4. A spec's `proposal.md` exists but no `spec.md` → suggest `lpwr-specs`.
5. `spec.md` is `approved` but no `tasks.md` → suggest `lpwr-tasks`.
6. `tasks.md` exists but the acceptance table has empty test-reference cells → suggest
   `lpwr-implement`.
7. All criteria have test references but no `review.md` verdict → suggest `lpwr-review`.
8. `review.md` verdict is "ship" but no matching commit → suggest `lpwr-commit`.
9. Committed but no lesson filed → suggest `lpwr-teach`.
10. Everything closed → point at `docs/state.md`'s "Next" section or suggest `lpwr-propose`.

```typescript
// lpwr-guide (sketch) — pure read, no side effects, no gate
import { existsSync } from "node:fs";

function suggestNext(specId?: string): string {
  if (!existsSync("docs/context.md")) return "Run lpwr-onboard — no project context yet.";
  if (!existsSync("docs/constitution.md")) return "Run lpwr-onboard — no constitution yet.";
  if (!specId) return "Run lpwr-propose — nothing in flight in docs/state.md.";

  const base = `docs/specs/${specId}`;
  if (!existsSync(`${base}/spec.md`)) return `Run lpwr-specs for ${specId}.`;
  if (!existsSync(`${base}/tasks.md`)) return `Run lpwr-tasks for ${specId}.`;
  if (!allCriteriaHaveTestRefs(`${base}/spec.md`)) return `Run lpwr-implement for ${specId}.`;
  if (!existsSync(`${base}/review.md`)) return `Run lpwr-review for ${specId}.`;
  if (getVerdict(`${base}/review.md`) === "ship" && !hasMatchingCommit(specId)) {
    return `Run lpwr-commit for ${specId}.`;
  }
  if (!existsSync(`docs/lessons/${specId}.md`)) return `Run lpwr-teach for ${specId}.`;
  return "This spec is closed. Check docs/state.md's Next section or run lpwr-propose.";
}
```

- **Never a gate.** `lpwr-guide` suggests; it never blocks. Its value is orientation, not
  enforcement — enforcement stays with `spec-link` and `scope-guard`.
- **Never writes.** Not to `state.md`, not to the log. A suggestion tool that also mutates state
  stops being trustworthy as a stateless check.

---

## 4. Prefix policy — what gets `lpwr-` and what doesn't

| Piece | Prefixed? | Why |
| --- | --- | --- |
| Commands | Yes — flat `lpwr-<verb>.md` | User-typed, shares a global namespace with any other tool's commands — highest collision risk |
| Skill folders | Yes — `skills/lpwr-<name>/` | Not user-typed, but installed alongside a team's own skills; the prefix is for audit/grep clarity, not invocation |
| Plugins (shared package) | Yes — `lpwr-scope-guard.ts`, `lpwr-spec-link.ts`, `lpwr-trap-flags.ts` | Same audit clarity, plus the npm package itself is already scoped (`@yourorg/lpwr-plugins`), so the prefix stays consistent end to end |
| Agents | **No** — `build.md`, `plan.md`, `reviewer.md`, unprefixed | Roles are referenced internally by commands, not typed by a person, and per the naming rule "agents named by role, never brand" — prefixing the role name would be branding it |
| Templates | **No** — `spec.md`, `review.md`, unprefixed | Match the artifact filename they produce; that rule takes precedence over the prefix policy for this one piece |
| The traceability ID (`<domain>-<sequence>`) | **No** | This "domain" is the project's own feature area (`auth`, `billing`), unrelated to Loopwright's six workflow domains — don't conflate the two, and don't prefix an ID a person reads and types constantly |

The rule in one sentence: **prefix what a person or a foreign tool might collide with by name;
don't prefix what's already scoped by role, by convention, or by its own ID.**

---

## 5. Updated directory layout

```
repo/
├── AGENTS.md
├── opencode.json                      # plugin array now lists lpwr-* entries
│
├── .opencode/
│   ├── agents/
│   │   ├── build.md
│   │   ├── plan.md
│   │   ├── neutral.md
│   │   ├── deep-expert.md
│   │   ├── applied-judge.md
│   │   ├── reviewer.md
│   │   └── scout.md
│   │
│   ├── commands/                      # flat — no domain subfolders
│   │   ├── lpwr-setup.md
│   │   ├── lpwr-onboard.md
│   │   ├── lpwr-guide.md
│   │   ├── lpwr-codebase.md
│   │   ├── lpwr-domain.md
│   │   ├── lpwr-stack.md
│   │   ├── lpwr-constitution.md
│   │   ├── lpwr-propose.md
│   │   ├── lpwr-interview.md
│   │   ├── lpwr-research.md
│   │   ├── lpwr-improve.md
│   │   ├── lpwr-specs.md
│   │   ├── lpwr-tasks.md
│   │   ├── lpwr-implement.md
│   │   ├── lpwr-diagnose.md
│   │   ├── lpwr-review.md
│   │   ├── lpwr-goal.md
│   │   ├── lpwr-release.md
│   │   ├── lpwr-commit.md
│   │   └── lpwr-teach.md
│   │
│   ├── skills/
│   │   ├── lpwr-writing-ears/SKILL.md
│   │   ├── lpwr-acceptance-criteria/SKILL.md
│   │   ├── lpwr-option-triage/SKILL.md
│   │   ├── lpwr-explain-back/SKILL.md
│   │   ├── lpwr-diff-reading/SKILL.md
│   │   ├── lpwr-repro-minimisation/SKILL.md
│   │   ├── lpwr-boundary-audit/SKILL.md
│   │   ├── lpwr-root-cause-refactor/SKILL.md
│   │   ├── lpwr-primary-sources/SKILL.md
│   │   ├── lpwr-context-economy/SKILL.md
│   │   └── lpwr-commit-grouping/SKILL.md
│   │
│   └── plugins/
│       ├── lpwr-scope-guard.ts
│       ├── lpwr-spec-link.ts
│       ├── lpwr-trap-flags.ts
│       ├── lpwr-evidence-log.ts
│       └── lpwr-context-compactor.ts
│
├── docs/
│   ├── context.md                     # new — lpwr-onboard's artifact
│   ├── constitution.md
│   ├── glossary.md
│   ├── standards/
│   ├── specs/<id>/                    # proposal.md, spec.md, tasks.md, review.md, log.ndjson
│   ├── memos/
│   ├── lessons/
│   └── state.md
│
└── templates/
    ├── context.md                     # new
    ├── constitution.md
    ├── proposal.md
    ├── spec.md
    ├── tasks.md
    ├── review.md
    ├── lesson.md
    └── state.md
```

Note: `docs/stack.md` from the earlier layout is folded into `docs/context.md`'s stack section —
one file for `lpwr-onboard`'s output, rather than three separate ones, to keep the artifact model
as flat as the command model.

---

## 6. New template — `templates/context.md`

```markdown
---
last_updated: <date>
updated_by: lpwr-onboard   # or lpwr-codebase / lpwr-domain / lpwr-stack for a partial refresh
---

# Project context

## Codebase
<structure, key modules, entry points — what lpwr-codebase maintains>

## Domain
<ubiquitous language, core concepts — what lpwr-domain maintains, feeds glossary.md>

## Stack and tools
<languages, frameworks, package manager, CI, deploy target — what lpwr-stack maintains>

## Principles (summary)
<one-paragraph pointer to docs/constitution.md — the full rules live there, not duplicated here>
```

---

## 7. Rule additions (extends the earlier implementation rules and naming conventions)

33. **`lpwr-setup` never writes under `docs/` and never gets a spec ID.** It configures a
    machine, not a project — keep it entirely outside the traceability scheme.
34. **`lpwr-guide` is read-only by construction — enforce this the same way as any other gate:
    with a plugin that blocks `lpwr-guide` from calling `write` or `edit`, not with an instruction
    asking it not to.**
35. **`lpwr-onboard` may run in a repo with no code yet.** Its sections are allowed to come back
    thin on a greenfield project — don't treat a sparse `context.md` as a failure, treat an
    *unrun* `lpwr-onboard` as the failure.
36. **The `lpwr-` prefix is not applied to agents, templates, or the traceability ID — see the
    table in §4.** Don't "complete the pattern" by prefixing these later; the exceptions are
    deliberate, not oversights.
37. **A command's flat name still declares its stage in its own body (frontmatter or an opening
    line), even though the directory no longer does.** Losing the path-based stage signal from
    the earlier nested layout means the stage now has to be stated explicitly inside each command
    file instead of implied by its folder.

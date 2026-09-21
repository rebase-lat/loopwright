# Loopwright — Cross-Module Connections

Quick reference: what each domain owns, what it reads, what it writes, and who consumes that
output. The traceability ID (`<domain>-<sequence>`) and the audit log (`log.ndjson`) are the two
threads that run through every row — everything below is ultimately joined on one of those two.

> Command names below are the v2 layout; the implemented set is flat `lpwr-*` per
> `implementation-guide-v3.md`. Domain ownership, read/write flow, and gates are unchanged.

---

## Govern

| | |
| --- | --- |
| **Owns** | `/constitution`, `/codebase`, `/domain`, `/stack` — agent: none dedicated, runs on `plan` |
| **Reads** | Nothing upstream — this is the root |
| **Writes** | `docs/constitution.md`, `docs/glossary.md`, `docs/stack.md` |
| **Consumed by** | Every other domain, directly |

**Links out:**
- `constitution.md` → **Specify** (`/specs` loads it before writing EARS statements)
- `constitution.md` → **Verify** (`/review`'s standards axis checks against the linter/CI table)
- `glossary.md` → **Specify** (banned substitutes constrain requirement wording)
- `stack.md` → **Execute** (`/implement` and `/diagnose` scope tool choice to what's listed)

Change path: amendments to any Govern artifact go through `/propose` → `/review`, same loop as a
feature spec — Govern doesn't get a side channel.

---

## Frame

| | |
| --- | --- |
| **Owns** | `/propose`, `/interview`, `/research`, `/improve` — agents: `plan` (primary), `neutral` / `deep-expert` / `applied-judge` (triage) |
| **Reads** | `docs/glossary.md`, `docs/stack.md` (Govern); prior `docs/lessons/*` (Retain, for repeated mistakes) |
| **Writes** | `docs/specs/<id>/proposal.md`; `docs/memos/*.md` (from `/research`) |
| **Consumed by** | **Specify** (`/specs` takes the approved proposal as input) |

**Links out:**
- `proposal.md` → **Specify** (`proposal_ref` field in `spec.md` frontmatter)
- Triage agents (`neutral`, `deep-expert`, `applied-judge`) are read-only and never write directly
  to `docs/` — their debate is presented to the human, and only the human's pick becomes the
  proposal.
- `/improve` output feeds back into Frame itself (a new `/propose` candidate), not into Execute
  directly — upkeep never writes code.

---

## Specify

| | |
| --- | --- |
| **Owns** | `/specs`, `/tasks` — agent: `plan` (read-only) |
| **Reads** | `proposal.md` (Frame), `constitution.md` + `glossary.md` (Govern) |
| **Writes** | `docs/specs/<id>/spec.md`, `docs/specs/<id>/tasks.md` |
| **Consumed by** | **Execute** (`/implement` reads both), **Verify** (`/review` and `/goal` read `spec.md`'s acceptance table) |

**Links out:**
- `spec.md` frontmatter `id` is the same ID `/implement`, `/review`, and `/commit` all key off —
  this is the single strongest cross-domain link in the system.
- `spec.md`'s acceptance-criteria table has an empty "test reference" column at creation time;
  **Execute** is the one domain that fills it in, closing the loop back to Specify's own artifact.
- `spec.md` status field (`draft` → `approved` → `superseded`) gates `spec-link.ts`, which blocks
  **Execute** from starting on anything not `approved`.

---

## Execute

| | |
| --- | --- |
| **Owns** | `/implement`, `/diagnose` — agent: `build` (write + scoped shell) |
| **Reads** | `spec.md`, `tasks.md` (Specify); `stack.md` (Govern) |
| **Writes** | diff, run log, fills the test-reference column in `spec.md`'s acceptance table, appends `intent: execute` lines to `log.ndjson` |
| **Consumed by** | **Verify** (`/review` reads the diff + the now-filled acceptance table) |

**Links out:**
- `scope-guard.ts` reads `tasks.md` to compute the declared surface — a plugin, not a person,
  enforces the Specify → Execute boundary.
- `flag-traps.ts` watches Execute's own edit stream (patch count, elapsed time) and warns inline;
  it doesn't write to any domain's artifact, it's advisory console output only.
- Every `edit`/`write` tool call inside Execute is a candidate `log.ndjson` line — but only
  handoffs (not every file write) get logged, to keep the audit trail meaningful rather than noisy.

---

## Verify

| | |
| --- | --- |
| **Owns** | `/review`, `/goal`, `/release`, `/threat-review` (high tier only) — agents: `reviewer` (read-only checks), `scribe` (writes review + threat-review), `build` (release) |
| **Reads** | diff (Execute), `spec.md` acceptance table (Specify + Execute's fill-ins), `constitution.md` (Govern) |
| **Writes** | `docs/specs/<id>/review.md`, the verdict (ship / block / redirect) |
| **Consumed by** | **Retain** (`/commit` requires a "ship" verdict to proceed); **Frame** (a "redirect" verdict can re-open the spec via a new `/propose`) |

**Links out:**
- `review.md`'s verdict is the one gate in the entire system that nothing downstream can route
  around — `/commit` and `/release` both check for it before running.
- `/goal` is the only command that reads *two* spec-adjacent things at once (spec vs. a fixed
  implementation point) purely to detect drift — it produces no artifact of its own, only a
  pass/fail consumed inline by the human running it.
- `/release` is the only command permitted to trigger deploy, and only fires on a recorded "ship."

---

## Retain

| | |
| --- | --- |
| **Owns** | `/commit`, `/teach` — no dedicated agent, runs on whichever agent closed Verify |
| **Reads** | `review.md` verdict (Verify), full `log.ndjson` for the spec (all domains) |
| **Writes** | git commit (tagged with spec ID), `docs/state.md`, `docs/lessons/<id>.md` |
| **Consumed by** | **Govern/Frame**, on the next run — `state.md` and `lessons/` are the only artifacts every domain is expected to re-read at the start of its next invocation |

**Links out:**
- `docs/state.md` is the one file with a single writer (`/commit`) but many readers — every
  domain command should glance at it before starting, since it's the fastest way to see what's
  already in flight for a related spec.
- `docs/lessons/*.md` is the direct implementation of "constraints and learning feed the next
  run" — **Frame** is the domain most likely to consult it, since a repeated lesson usually means
  the next proposal should avoid a previously-tried option.
- `log.ndjson` for a completed spec is archival after `/commit` — nothing writes to it again, but
  it remains the answerability record if `/goal` or a future review needs to reconstruct why a
  decision was made.

---

## The two threads that hold it together

**Traceability ID** (`<domain>-<sequence>`, e.g. `auth-014`) — appears in: the worktree name, the
branch name, the `docs/specs/<id>/` folder, every template's frontmatter, every commit message,
every `log.ndjson` line's `spec_ref`, and `state.md`'s entries. If you can only check one thing
when a cross-domain link looks broken, check whether the ID matches on both ends.

**Audit log** (`docs/specs/<id>/log.ndjson`) — the only artifact every domain writes to and every
domain can read from. It's what makes the six domains a system rather than six disconnected
folders: Frame's triage debate, Execute's handoffs, and Verify's verdict all leave a line in the
same file, in call order, so a lesson written in Retain can point back to the exact moment
something went sideways.

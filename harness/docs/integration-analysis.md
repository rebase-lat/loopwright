# Integration Analysis — workflow phase cross-wiring

Ongoing audit of how harness phases (domains) feed each other: what artifacts exist, what claims an integration, and whether the wiring is mechanical, prose-only, or missing. One domain per pass, in stage order.

Status legend: **Wired** (command/template/plugin enforces it) · **Prose** (stated, not enforced) · **Gap** (claimed or needed, absent) · **Ephemeral** (output has no durable home).

Last updated: 2026-09-24 — Round 2 (consistency gaps) plan appended; Round 1 plan (below) shipped in `e404877`–`c07af04`.

### Decisions (human-confirmed)

- **Scope:** all findings (gaps + prose + ephemeral).
- **Priority axis:** blast radius (silent failure / broken traceability first), effort second.
- **Ephemeral outputs (B2, F2):** append-only audit log; `commit` reconciles into `state.md` (respects rule 19).
- **Non-criterion deferrals (S1, V5):** promote to criteria — open questions and threat findings become real criterion IDs at specify/review time so the existing `deferred:` path works unchanged.
- **Plan location:** this file.

---

## Domain 1 — Bootstrap (`lpwr-setup`, `lpwr-install`)

Artifacts: machine report (inline), `docs/{constitution,context,state}.md` materialized empty.

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| B1 | Setup verifies stack inventory | `setup` ↔ `context.md` Stack | **Gap** | Stack section says "the inventory `lpwr-setup` verifies against", but setup step 4 reads `opencode.json` + `opencode mcp list` only — never diffs against the stack section. Drift either direction is invisible. |
| B2 | Suggested MCP permission keys persist | `setup` → future session | **Ephemeral** | Copy-pasteable snippets emitted inline only. No artifact slot; `state.md` single-writer rule (commit) blocks filing there. Lost if conversation ends. |
| B3 | Audit binary check ↔ constitution | `setup` ← `onboard` | **Wired** | Setup step 6 verifies `Audit command:` binaries from constitution; onboard drafts them; setup says re-run after onboard. Correct one-way dependency. |
| B4 | Install unblocks domain commands | `install` → plugins | **Wired** | Materializing foundation files releases `lpwr-guard-bootstrap`. |
| B5 | Missing foundation → guide | `setup`/`install` → `guide` | **Wired** | Setup warns; guide steps 2–3 route to install/onboard. |

**Verdict:** B3–B5 solid. Real gaps: **B1** (prose claims a diff setup doesn't perform), **B2** (no durable home for suggested keys).

---

## Domain 2 — Govern (`lpwr-onboard`, `lpwr-constitution`, `lpwr-domain`, `lpwr-stack`)

Artifacts: `docs/context.md` (Codebase / Domain / Stack / Principles), `docs/constitution.md`, `docs/glossary.md`.

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| G1 | Context Domain section ownership | `domain` ↔ `context.md` Domain | **Gap** | `context.md` template comment: "Domain by lpwr-domain (feeds glossary.md)". But `lpwr-domain` writes only `docs/glossary.md` ("writes nothing else"). Context's Domain section is onboard-only and goes stale when the glossary is sharpened — ownership claim contradicts the command. |
| G2 | Stack constrains tool choice in Execute | `stack` → `implement`/`diagnose` | **Prose** | "may only choose tools listed there" — no plugin checks tool selection against the stack section (`scope-guard` covers file edits, not tooling). Rule 5: prose advises, plugins enforce. |
| G3 | Constitution initial approval path | `onboard` → approved constitution | **Prose** | "approved by a human on demand, never here"; only a placeholder-free file "confirmed by a human" becomes approved — no command step or `question` round owns that confirmation. Guide step 3 routes to onboard/constitution but doesn't close the approval. |
| G4 | Audit command loop | `onboard` → constitution → `setup` → `security-scan` | **Wired** | Onboard drafts `Audit command:` lines → setup verifies binaries → security-scan runs them at implement. Stated end-to-end in onboard body. |
| G5 | Banned substitutes enforced at specs | `domain` → `specs` | **Wired** | Glossary exact terms rejected at specs time (rule 26); specs command: reject, don't correct. |
| G6 | Constitution amendments no side channel | `constitution` → `propose`/`review` | **Wired** | Rule 25; constitution command: amendments travel with a spec ID. |
| G7 | Onboard refresh deltas → propose | `onboard` → `propose` | **Wired** | Approved-but-delta reported as `lpwr-propose` candidate, never silently edited. |
| G8 | Stack ↔ setup bidirectional check | `stack` ↔ `setup` | **Gap** | Same root as B1, Govern side: stack records MCP + binaries for setup to verify; setup never reads stack. Half a loop. |
| G9 | Govern unkeyed, no handoff | all Govern → log | **Wired** | Spec-ID exemption stated in each command. |

**Verdict:** G4–G7, G9 solid. Real gaps: **G1** (template/command ownership contradiction), **G2** (stack constraint prose-only), **G3** (approval step implicit), **G8** (= B1 other half).

---

## Domain 3 — Frame (`lpwr-propose`, `lpwr-interview`, `lpwr-research`, `lpwr-improve`, `lpwr-diagnose` entry)

Artifacts: `docs/memos/<topic>.md`, `docs/specs/<id>/proposal.md`, improve report (inline).

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| F1 | Memos ground propose | `interview`/`research`/`diagnose` → `propose` | **Gap** | Memo producers all say "feed into lpwr-propose" / Next: propose — but propose's required reading is glossary + context + lessons only. Memos never read unless the human pastes them. Motion's memory check (constitution, lessons) skips memos too. |
| F2 | Improve candidates persist | `improve` → `propose`/state | **Ephemeral** | Report is inline, writes nothing by design (rule 32: don't automate discovery until proven). Candidates with `Proposed via` lines die with the conversation; state.md blocked (single writer). Guide step 5 won't surface them next session. |
| F3 | Deferred → memo grounding before propose | `review` deferred → `guide` → memo → `propose` | **Prose** | Guide step 18 suggests propose directly for deferred IDs. Optional memo step (diagnose/research) exists as side door but isn't suggested from the deferred branch — works, not automatic. |
| F4 | Redirect verdict → memo | `review` redirect → `guide` → `propose` | **Prose** | Guide step 17 suggests re-frame; review's redirect reasoning is the natural grounding but no memo step is named. Same class as F3. |
| F5 | Improve lesson-bucket → constitution | `lessons` → `improve` → `constitution` | **Wired** | Improve queries `failure_bucket`; 3 sharing a bucket (esp. `security-gap`) → constitution candidate. |
| F6 | Unkeyed Frame work unlogged | interview/research/diagnose-unkeyed → log | **Wired** | Spec-ID exemption stated in each; keyed research journals `frame`. |
| F7 | ID assigned at propose | `propose` → `specs` | **Wired** | Rule 1; proposal never exists without ID; specs consumes it. |

**Verdict:** F5–F7 solid. Real gaps: **F1** (memo→propose link claimed by producers, not consumed by propose), **F2** (improve output has no home), **F3/F4** (optional grounding steps not on the guide branch).

---

## Domain 4 — Specify (`lpwr-specify`, `lpwr-specs`, `lpwr-tasks`, `lpwr-design`, `lpwr-explore`, `lpwr-amend`)

Artifacts: `spec.md` (criteria, tasks, surface, open questions), `adr.md`.

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| S1 | Open questions → deferred path | `explore`/`specs` → `review` deferred | **Gap** | Spec template has `Open questions`; explore files ambiguities there. Deferred mechanism only accepts criterion IDs (`<id> -> follow-up`). Unresolved open questions have no ID, so they can't defer at review — they silently die with the spec or get invented into criteria. |
| S2 | Optional features pre-declared deferral | `specs` → `review` | **Wired** | Specs flags Optional-features criteria as deferral candidates so reviewer expects them; reviewer still confirms. |
| S3 | ADR gates tasks | `design` → `tasks`/`specify` | **Wired** | `design_review: required` without accepted `adr.md` refuses approval; specify step 2: tasks wait for ADR. |
| S4 | Amend voids review | `amend` → re-approval | **Wired** | Rule 38; review.md deleted, status→draft, test refs cleared on reworded rows. |
| S5 | Explored behavior wrong → propose | `explore` → `propose` | **Wired** | Approval is accuracy-only; desirability routes to propose with draft as grounding (rule 45). |
| S6 | Tasks bound to criterion IDs | `tasks` ↔ criteria | **Wired** | Rule 3; surface lives in Tasks section so it can't drift (rule 46). |
| S7 | ADR consequences → threat-review | `adr` → `threat-review` | **Gap** | ADR records consequences; threat-review asks for failure modes specific to the diff. No step reads prior ADR consequences when drafting threat-review — knowledge re-derived. |

**Verdict:** S2–S6 solid. Real gaps: **S1** (open questions can't use deferred mechanism), **S7** (ADR consequences not consumed by threat-review).

---

## Domain 5 — Execute (`lpwr-implement`, `lpwr-diagnose`)

Artifacts: code + test refs, per-criterion `execute` journals, diagnose memos.

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| E1 | Tasks → todowrite seed | `tasks` → `implement` | **Wired** | Implement seeds one todo per task line; check off only after passing test ref; never journals `todo.updated` (rule 48/22). |
| E2 | Criterion journals → review | `implement` → `review` | **Wired** | Per-criterion `execute` handoffs; review reads acceptance table test refs. |
| E3 | Security scan → review security axis | `security-scan` → `review` | **Wired** | Secrets block; audit findings trace to `audit.md`; review axis 3 checks audit.md + constitution floors. |
| E4 | Diagnose regression targets → test refs | `diagnose` memo → `implement` | **Prose** | Diagnose writes "regression-test targets" into memo; implement fills test refs per criterion. No step maps memo targets → criterion IDs; works only if human/builders carry them across. |
| E5 | Diagnose → implement (approved) / propose | `diagnose` → next | **Wired** | Branch on approved spec vs none; no handoff without spec ID. |
| E6 | Implement explain-back → lesson | `implement` → `teach`/`commit` lesson | **Prose** | Explain-back + "why" live in chat/log; commit drafts one lesson per spec. No mechanical link from explain-back insights to the lesson draft — teach/commit re-derive. |
| E7 | Scope guard + spec-link on entry | gates → implement | **Wired** | Approved status, state, design review, surface containment — plugin-enforced before first tool call. |

**Verdict:** E1–E3, E5, E7 solid. Weaker: **E4** (diagnose targets → test refs hand-carried), **E6** (explain-back → lesson re-derived).

---

## Domain 6 — Verify (`lpwr-review`, `lpwr-goal`, `lpwr-threat-review`, `lpwr-release`)

Artifacts: `review.md` (verdict, waived, deferred), `threat-review.md`, release ref (journaled).

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| V1 | Deferred → state.md Next → guide → propose | review → commit → guide | **Wired** | Full chain: frontmatter format gate → commit step 7 files targets → guide step 18 suggests propose citing IDs. |
| V2 | Waived/deferred ignored by goal | `review` frontmatter → `goal` | **Wired** | Goal: intended drift, not deviation; never writes review. |
| V3 | Threat-review gates release (high) | `threat-review` → `release` | **Wired** | Verdict-gate: high without threat-review.md refuses; guide step 13. |
| V4 | Threat findings → review security axis | `threat-review` → `review` | **Wired** | Review axis 3: high-tier requires threat-review exists + findings addressed. |
| V5 | Threat findings → deferred criteria | `threat-review` → deferred | **Gap** | Findings are prose in threat-review.md, not criterion IDs — can't use `deferred:` frontmatter. Accepted-but-unfixed findings have no follow-up-spec path (unlike criteria). |
| V6 | Block → diagnose grounding | `review` block → `guide` → `diagnose` | **Prose** | Guide step 16: block → implement (rework). Hard-bug blocks would benefit from diagnose first; side door exists but isn't suggested from the block branch. Same class as F3/F4. |
| V7 | Release ref → state.md Done | `release` → `state.md` | **Gap** | Commit (single writer) runs before release; Done entry has no release URL/tag. Ref lives only in `log.ndjson`. Guide step 15 checks journal, not state — works, but state's Done line is incomplete. |
| V8 | Ship gate mechanical | verdict → commit/release | **Wired** | `lpwr-verdict-gate.ts`: ship required, format-checked deferred entries, high-tier threat gate. |

**Verdict:** V1–V4, V8 solid. Real gaps: **V5** (threat findings bypass deferred mechanism), **V7** (release ref never reaches state.md); softer: **V6** (block doesn't suggest diagnose).

---

## Domain 7 — Retain (`lpwr-commit`, `lpwr-teach`)

Artifacts: commits, `state.md` update, `lessons/<date>-<id>.md`, deferred→Next filing.

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| R1 | Deferred targets → state.md Next | `review` → `commit` | **Wired** | Commit step 7; survives spec closure. |
| R2 | Lesson failure_bucket → improve | `commit`/`teach` → `improve` | **Wired** | Improve queries buckets; 3+ → constitution candidate. |
| R3 | Teach = lesson recovery path | `commit` missing lesson → `teach` | **Wired** | Teach drafts when commit didn't file; guide step 19: committed-but-no-lesson → teach. |
| R4 | state.md single writer | all → `commit` | **Wired** | Rule 19; other commands append to audit log, commit reconciles. |
| R5 | Waived → no follow-up filing | `review` waived → commit | **Wired** | Terminal by design; commit doesn't second-guess (step 1). |
| R6 | Retain-only log → no merge | `commit` gate 2 | **Wired** | Requires upstream non-retain handoff for this spec_ref. |
| R7 | Explain-back/chat insight → lesson | Execute → lesson | **Prose** | See E6 — lesson drafted fresh at commit/teach, prior chat insights not consumed. |

**Verdict:** Domain clean. R1–R6 wired; R7 overlaps E6.

---

## Domain 8 — Cross-cutting (`lpwr-guide`)

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| C1 | Guide as integration hub | all stages → suggestion | **Wired** | 20-step decision path + side doors; read-only by construction (orchestrator edit/bash deny). |
| C2 | Deferred branch grounding | guide step 18 → memo | **Prose** | See F3 — suggests propose directly; memo side door available but unnamed here. |
| C3 | Block branch grounding | guide step 16 → diagnose | **Prose** | See V6 — block → implement only; diagnose is a side door, not step-16 alternative. |
| C4 | Improve candidates not visible to guide | improve → guide | **Gap** | See F2 — guide reads files/state; improve output is chat-only, so next-session guide can't surface leftover candidates. |
| C5 | B1/G8 checkable from guide? | guide → stack/setup drift | **Gap** | Guide checks file existence/state, not stack↔setup consistency — drift never surfaced even at orientation. |

---

## Summary — highest-leverage gaps (all domains)

1. **F1** — Memos never read by propose (producers point at it; consumer doesn't).
2. **B1/G8/C5** — Stack ↔ setup verification loop is claimed but not implemented; guide blind to it.
3. **S1/V5** — Open questions and threat findings can't use the deferred mechanism (not criterion IDs).
4. **F2/C4** — Improve candidates have no durable home; invisible next session.
5. **G1** — Context Domain section ownership contradicts `lpwr-domain`'s write scope.
6. **V7** — Release ref never reaches `state.md` Done (single-writer ordering).
7. **G2** — Stack tool-choice constraint is prose, not enforced.
8. **G3** — Constitution initial approval has no owning step.
9. **B2** — Setup's suggested MCP keys are ephemeral.
10. **S7/E4/E6/V6/F3/F4** — Soft links: knowledge produced in one phase not consumed by the next (ADR→threat, diagnose targets→test refs, explain-back→lesson, block→diagnose, deferred/redirect→memo).

---

## Status

- [x] Domain 1 — Bootstrap
- [x] Domain 2 — Govern
- [x] Domain 3 — Frame
- [x] Domain 4 — Specify
- [x] Domain 5 — Execute
- [x] Domain 6 — Verify
- [x] Domain 7 — Retain
- [x] Domain 8 — Cross-cutting
- [x] Prioritization / fix waves (plan below)
- [x] Wave 1 — Critical
- [x] Wave 2 — High
- [x] Wave 3 — Medium

---

# Implementation plan

16 unique work items (cross-domain IDs deduped: C5=G8=B1, C4=F2, C2=F3, C3=V6, R7=E6). Ordered by blast radius: silent failure and broken traceability first, then missing homes/enforcement, then soft knowledge links. Each item names files, the change, and how to verify.

Convention per rule 5: if it must hold mechanically, it gets a plugin gate; prose-only items either gain a gate or are consciously re-labeled as advice in the same change.

---

## Wave 1 — Critical (silent failure, broken or claimed-but-absent traceability)

### W1-1. Stack ↔ setup verification loop (B1 + G8 + C5)

**Blast radius:** `context.md` Stack claims setup verifies it; setup never reads it. Drift in either direction is invisible at every phase including orientation.

- **Files:** `commands/lpwr-setup.md` (step 4), `commands/lpwr-guide.md` (new early check), `docs/context.md` template comment (only if wording needs aligning after the real check lands).
- **Change:**
  1. Setup step 4 gains a diff: read Stack section of `docs/context.md` when present; report MCP servers / external binaries / audit tools recorded there but not found on the machine, and found-but-unrecorded (two directions). Missing context → skip with confirmation (bootstrap-safe).
  2. Guide gains a check before/independent of step 5: if stack inventory and last setup report disagree — or stack exists but runtime clearly lacks a listed binary — surface drift and suggest `lpwr-setup` (or `lpwr-stack` if the stack file is stale). Keep guide read-only; it only names the drift.
  3. Fix the template comment only if the implemented behavior differs from "the inventory setup verifies against" — goal is comment becomes true, not softer.
- **Mechanical?** Setup-side: prose step inside a builder command (acceptable — setup is the verification moment). Guide-side: suggestion only, consistent with guide's read-only mandate.
- **Verify:** fixture repo with a stack entry for a binary that doesn't exist → setup reports it by name; guide (orientation) points at setup; remove binary from stack → setup reports found-but-unrecorded.

### W1-2. Context Domain section ownership (G1)

**Blast radius:** template promises `lpwr-domain` owns the Domain section; the command writes only `glossary.md`. Section silently goes stale; ownership lie compounds.

- **Files:** `templates/context.md` (comment), `commands/lpwr-domain.md`.
- **Change (pick one, implemented as the honest one):**
  - **A (preferred):** `lpwr-domain` also refreshes the Domain section of `context.md` (bump `last_updated`, `updated_by: lpwr-domain`) alongside `glossary.md` — matches the template claim, keeps glossary as the enforcement surface.
  - **B:** drop the Domain-section claim from the template; Domain section is onboard-only, glossary is the living artifact; comment says so.
- Human decision at execution time if A widens write scope more than wanted; default A (claim already public).
- **Verify:** glossary sharpen via `lpwr-domain` → either context Domain updated in the same run (A) or comment no longer names `lpwr-domain` (B); no third writer appears for glossary.

### W1-3. Memos consumed by propose (F1)

**Blast radius:** three producers route to propose with "feed into lpwr-propose"; propose never reads memos. Grounding produced at Frame is dropped at the highest-leverage handoff in the same stage.

- **Files:** `commands/lpwr-propose.md` (required reading + motion step), `skills/lpwr-motion/SKILL.md` (memory-check inputs), `commands/lpwr-guide.md` step 5/18 (point at memo when one exists for the topic — light touch).
- **Change:**
  1. Propose required reading adds: relevant `docs/memos/*.md` for the topic at hand (name by $ARGUMENTS slug / state Next line; "none found" is fine).
  2. Motion's "Checked against memory" gains a `Memos:` line (none | pointer + one-line what it establishes) — constitution and lessons stay as-is.
  3. Guide step 18 (deferred) and step 5 (loose idea): when a memo already covers the topic, name it as grounding before propose; otherwise unchanged.
- **Mechanical?** Prose in propose/motion (reading list), guide already names artifacts — no new plugin.
- **Verify:** interview → memo → propose in one session: motion output contains the Memos line with the pointer; propose without memos still runs (no empty-state failure).

### W1-4. Promote open questions to criteria (S1)

**Blast radius:** unresolved `Open questions` have no criterion ID → cannot defer → die with the spec or get invented late as criteria with no design history.

- **Files:** `commands/lpwr-specs.md`, `commands/lpwr-specify.md`, `commands/lpwr-explore.md`, `skills/lpwr-acceptance-criteria/SKILL.md` (or writing-ears — whichever owns criterion minting), `templates/spec.md` (comment on Open questions), `AGENTS.md` rule 8 wording if needed.
- **Change:** approval gate gains: every `Open questions` entry is resolved before `status: approved` — each becomes (a) a criterion with a real sub-ID, (b) an explicit non-goal, or (c) struck with one-line resolution. `lpwr-explore` drafts questions as now but must not seek approval while any remain open. Review unchanged (deferred path already works on real IDs).
- **Mechanical?** Start as explicit command gate (specs/specify refuse approval); promote to plugin check in verdict/spec-link only if it proves missable.
- **Verify:** draft with one open question → approval refused naming the entry; convert to criterion or non-goal → approval proceeds; deferred flow unchanged for the new ID.

### W1-5. Promote threat findings to criteria (V5)

**Blast radius:** accepted-but-unfixed threat findings are prose in `threat-review.md` → no `deferred:` path → no follow-up-spec survival after ship.

- **Files:** `commands/lpwr-threat-review.md`, `templates/threat-review.md`, `commands/lpwr-review.md` (security axis), `skills/lpwr-acceptance-criteria/SKILL.md` if criterion language lives there.
- **Change:** threat-review findings that are not fixed in-diff must be bound to criterion IDs before review can ship: either existing criteria (point at them) or new criteria added via the normal specify/amend path (human pick via `question`). Findings left as free prose with no ID and no fix → review security axis cannot tick "findings addressed" → no ship (existing checkbox becomes load-bearing).
- **Mechanical?** Review checkbox already exists; make its wording exact ("every finding: fixed, or bound to a criterion ID that is passing / waived / deferred"). Verdict-gate optional later.
- **Verify:** threat-review with one unfixed unbound finding → review refuses ship ticking that box; bind to deferred criterion → ship path opens as with normal criteria.

---

## Wave 2 — High (no durable home, missing enforcement, missing owning step)

### W2-1. Append-only audit log for ephemeral outputs (B2 + F2 + C4)

**Blast radius:** setup's suggested MCP keys and improve's candidates die with the conversation; guide cannot surface them next session; `state.md` single-writer blocks direct filing (rule 19).

- **Files:** new `docs/audit.md` (append-only, global — distinct from per-spec `docs/specs/<id>/audit.md` which stays security-scan's), `templates/audit.md` holds the entry shape (live file materialized by `lpwr-install`; shape moved from `docs/` 2026-09-24); `commands/lpwr-setup.md` (step 4 output also appends), `commands/lpwr-improve.md` (report + append), `commands/lpwr-commit.md` (reconcile step), `commands/lpwr-guide.md` (read step), `docs/implementation-rules.md` rule 19 (name the file).
- **Change:**
  1. Create `docs/audit.md`: append-only sections/entries, newest last, each with date + kind (`setup-suggestion` | `improve-candidate`) + payload pointer/inline block as appropriate. Security findings do **not** move (stay per-spec).
  2. Setup step 4: after emitting suggested keys, append the same block as `setup-suggestion`.
  3. Improve: after the chat report, append each candidate as `improve-candidate` (same shape as `templates/improve.md` entry) — chat report stays primary, file is the durable mirror.
  4. Commit reconcile: fold unconsumed `improve-candidate` entries into `state.md` Next (or mark consumed when a proposal ID appears for them); leave `setup-suggestion` in place (machine-level, no spec ID) unless already applied — cheap "applied?" strikethrough.
  5. Guide: before step 20 (everything closed), read `docs/audit.md` for unconsumed `improve-candidate` → suggest `lpwr-propose` citing them (fixes C4).
  6. Rule 19 reworded to name `docs/audit.md` as the append target.
- **Mechanical?** File + command steps; commit reconcile is prose in the single-writer command (already owns state). Optional plugin later if entries rot.
- **Verify:** run improve → candidate in `docs/audit.md` + chat; kill session, new session guide → names the candidate; commit with unconsumed candidate → state Next updated, audit entry marked consumed.

### W2-2. Release ref reaches state.md Done (V7)

**Blast radius:** commit (single writer) runs before release; Done line never gets URL/tag; humans reading state see "done" with no artifact. Guide step 15 already checks the journal — state stays incomplete.

- **Files:** `commands/lpwr-release.md`, `commands/lpwr-commit.md` (note only), rule 19 wording already covered by W2-1 if consolidated, `templates/state.md` (optional: Done line format allows trailing release ref).
- **Change (respect single-writer):** release does **not** write `state.md`. Instead release appends a `release-ref` line to `docs/audit.md` (same file as W2-1, kind `release-ref`, keyed by spec ID); **next** commit reconcile — or a tiny explicit "reconcile release refs" step at the top of any later commit for that ID — folds it into the Done line. If no later commit exists, guide step 15 can show the audit entry as the ref (it already checks journal; audit is the human-facing twin). Pick the smaller of: commit auto-reconciles open release-refs on any run vs guide-only display. **Default: commit reconcile** (one writer, one place).
- **Mechanical?** Prose in release + commit; verdict-gate untouched.
- **Verify:** ship → commit → release → Done line still lacks ref; run any later commit activity for the ID (or a second commit) → Done gains ref; guide step 15 still passes on journal alone.

### W2-3. Stack tool-choice constraint (G2)

**Blast radius:** "implement/diagnose may only choose tools listed there" is prose; builders can silently pick unlisted tools. Rule 5: gates are plugins.

- **Files:** `commands/lpwr-implement.md`, `commands/lpwr-diagnose.md`, possibly `plugins/lpwr-scope-guard.ts` (if tool choice can hook) or new light check, `docs/implementation-rules.md` if re-labeled.
- **Change (decision at execution):**
  - **Enforce:** before/at first tool-using step, compare intended runtime tools (package manager, containers, CLIs about to be invoked) against Stack section; mismatch → toast + name the stack entry or stop (scope-guard-style). Hard to do fully pre-emtively for freeform builder work — may only catch bash command prefixes; still better than nothing.
  - **Or re-label:** change "may only choose" to "should prefer; unlisted tools need a human ok via `question`" and keep prose — honest advice, not a fake gate.
- Default: attempt enforce for **bash-invoked binaries** (detectable), prose for everything else; say so in the command.
- **Verify:** stack lists `docker`, command tries `podman` → blocked or questioned; unlisted-but-human-ok path still works.

### W2-4. Constitution initial approval owning step (G3)

**Blast radius:** "approved by a human on demand" has no command/step; guide routes to onboard but approval can be forgotten → file sits in draft forever while downstream treats it as present (guard only checks existence + placeholders).

- **Files:** `commands/lpwr-onboard.md` (end), `commands/lpwr-constitution.md` (clarify amend vs first approve), `commands/lpwr-guide.md` step 3, optionally `AGENTS.md`/constitution template `status:` comments.
- **Change:** onboard's final act when constitution is placeholder-free draft: offer approval via `question` (approve / keep draft / send to `lpwr-propose` for changes) — on approve, scribe sets `status: approved`. Constitution command documents it is amendments-only (rule 25 path) and points first-approval at onboard (or a one-line approve if draft already clean). Guide step 3: if constitution draft + no placeholders → suggest onboard (or the approve moment) explicitly, not just "onboard".
- **Mechanical?** Command step + `question`; guard already keys off placeholders — no new plugin unless draft-without-approval proves sticky (then spec-link-style check: domain commands warn if constitution still `draft`).
- **Verify:** fresh onboard → approval question appears; approve → status flips; decline → still draft, guide keeps pointing at it.

---

## Wave 3 — Medium (soft links: knowledge produced, not consumed)

One pattern across six items: name the handoff on the guide branch and/or add a reading step to the consumer. No new artifacts.

### W3-1. Guide branches name grounding steps (F3 + F4 + V6 + C2 + C3)

- **Files:** `commands/lpwr-guide.md` steps 16, 17, 18.
- **Change:**
  - Step 16 (block): if block reasoning indicates a bug/unknown root cause → suggest `lpwr-diagnose` first, then implement; else implement as now.
  - Step 17 (redirect): name review's redirect reasoning as grounding; if a memo would help re-frame and none exists → suggest `lpwr-research`/`lpwr-interview` before propose when the redirect cites missing facts (keep it one suggestion — diagnose/research/interview only when clearly indicated, else propose + "read review reasoning first").
  - Step 18 (deferred): if a memo already covers the follow-up topic → name it (ties to W1-3); else propose as now.
- **Verify:** fixture block review with "root cause unknown" → guide names diagnose; ordinary block → implement unchanged.

### W3-2. ADR consequences → threat-review (S7)

- **Files:** `commands/lpwr-threat-review.md`.
- **Change:** required reading adds `docs/specs/<id>/adr.md` when present; findings must call out ADR consequences that materialize in this diff (or "none" explicitly).
- **Verify:** high-tier spec with ADR → threat-review body references consequences section.

### W3-3. Diagnose regression targets → criterion IDs (E4)

- **Files:** `commands/lpwr-diagnose.md` (memo content / handoff wording), `commands/lpwr-implement.md` (reading list).
- **Change:** diagnose writes regression targets with an explicit "bind to criterion ID at implement" note (existing IDs or note they require amend/new criteria); implement's required reading includes the diagnose memo when one exists for the spec — map targets → test-ref cells before marking tasks done.
- **Verify:** diagnose memo targets appear as test references against named criteria after implement.

### W3-4. Explain-back insights → lesson (E6 + R7)

- **Files:** `commands/lpwr-commit.md` step 6, `commands/lpwr-teach.md`.
- **Change:** commit's lesson draft step: skim the spec's `execute` handoffs / session explain-back notes for the single highest-value insight before drafting (pointer language, not pasting chat); teach already is the recovery path — add one line: prefer insights already explained back during implement over re-deriving.
- **Verify:** commit after an implement with a notable explain-back → lesson matches that insight when it's the highest-value one.

### W3-5. Deferred / redirect memos already covered

F3/F4 land in W3-1; no separate task. C2/C3 are the same guide lines.

---

## Execution order (within waves)

1. **Wave 1:** W1-1 → W1-2 → W1-3 → W1-4 → W1-5 (traceability lies first, then Frame grounding, then ID promotions — W1-4/5 share criterion-minting language, do back-to-back).
2. **Wave 2:** W2-1 first (audit log is dependency for W2-2) → W2-2 → W2-4 → W2-3 (enforcement last; may re-label instead).
3. **Wave 3:** W3-1 (guide branches) → W3-2 → W3-3 → W3-4 (cheap reads, batch possible).

After each wave: `npm run lint` && `npm run typecheck`; wave commit only when asked ("Create the GIT commit").

## Out of scope / already fine

- All **Wired** rows (B3–B5, G4–G7/G9, F5–F7, S2–S6, E1–E3/E5/E7, V1–V4/V8, R1–R6, C1): no change.
- Rule 32 (don't automate improve discovery): respected — W2-1 only persists the report, doesn't schedule it.
- Per-spec `audit.md` (security-scan): untouched; global `docs/audit.md` is a different file — name collision noted, keep comments explicit to avoid future confusion (consider `docs/audit.md` header: "project audit trail — not the per-spec security audit").

---

# Round 2 — consistency gaps (memory & evidence)

Goal: **same question + same repo state → same answer.** Round 1 wired the phases to each other; Round 2 closes the gaps a memory/evidence review found — places where the harness records something but never checks it, claims a mechanism that doesn't exist, or leaves a cross-file contradiction to prose. Each gap is a variance source: two sessions reading different halves of a pair (spec vs review, receipt vs no receipt) reach different conclusions from the same repo.

Status legend as above (Wired / Prose / Gap / Ephemeral).

### Decisions (human-confirmed, Round 2)

- **Plan location:** this file (this section).
- **Risk-tier (D3):** strict equality — verdict-gate blocks commit/release when `spec.md` and `review.md` tiers differ; changing tier travels through `lpwr-amend` (rule 9). `spec.md` is the single source of truth.
- **Memory receipt (D6):** mechanical at spec-link — implement entry blocks on an incomplete `Checked against memory` receipt; specs keeps a prose refusal as the earlier checkpoint.
- **`confidence` (D1):** consume — advisory (non-blocking toast) at commit listing low-confidence handoffs; commit prose gains a matching checklist line.
- **`audit.md` collision (D5):** path discipline only — both names stay; every short reference gets qualified with its full path.

---

## Round 2 findings

| ID | Opportunity | From → To | Status | Notes |
|----|-------------|-----------|--------|-------|
| D1 | Handoff confidence never read | `log.ndjson` → commit | **Gap** | Writers + rubric in `lpwr-log-handoffs.ts` (108–157); zero consumers. `origin: "hook"` same class — provenance recorded, never inspected. |
| D2 | `diff_ref` never validated | `review` → commit/release | **Gap** | Sole occurrence is the template comment (`templates/review.md:4`). Nothing checks the review was rendered against the change being committed. |
| D3 | Risk-tier cross-check missing | `spec.md` ↔ `review.md` | **Prose** | Rule 39: tier "re-confirmed against the actual diff at `lpwr-review`"; verdict-gate:466 reads `review.md` only — a stray `risk_tier: low` in review silently disables the high-tier threat gate. Security box is human-attested only. |
| D4 | "then the log goes archival" | `commit` step 4 | **Gap** | Phrase implies an archiving process; no mechanism, gitignore rule, or glossary term exists (`lpwr-commit.md:13` is the only hit). |
| D5 | Two files named `audit.md` | project ↔ per-spec | **Prose** | Headers + full paths in most refs; short refs remain: onboard:8, implement:8, review security box, security-scan comments. |
| D6 | Memory receipt unchecked | `proposal.md` → implement | **Gap** | `### Checked against memory` (Constitution/Lessons/Memos) is template prose — no plugin verifies it; the model can skip the memory check with no gate noticing. Root gap for the consistency goal. |

**Verdict:** all six live. D6 is the direct "same answer" lever (grounding consulted or not at model discretion); D3/D2 are the security/evidence pair (cross-file contradictions unenforced); D1/D4/D5 are recorded-but-unconsumed / claimed-but-absent / ambiguous-name hygiene.

---

## Round 2 plan

Convention per rule 5 (same as Round 1): anything that must hold mechanically gets a gate; prose items either gain a gate or get honestly re-labeled. Ordered: mechanical gates first (Wave A), prose alignment second (Wave B) — Wave B references Wave A's behavior in its wording.

### Wave A — Mechanical gates

#### A1. Risk-tier strict equality (D3)

**Blast radius:** `review.md` is the only tier the release threat gate reads — one wrong frontmatter line de-risks a high-tier spec with no trace; the same spec answers "needs threat review?" differently depending on which file you open.

- **Files:** `plugins/lpwr-verdict-gate.ts` (`enforceVerdictGate`), `docs/implementation-rules.md` (rule 39 — name the enforcement).
- **Change:**
  1. Read `risk_tier` from `docs/specs/<id>/spec.md` and `review.md` (both via `frontmatterValue`). Missing `spec.md` while `review.md` exists → block (broken traceability — name the missing file).
  2. Values differ, or either side missing/unknown → block with both values named: `risk_tier mismatch — spec.md says "X", review.md says "Y" — carry the tier over, or change it via lpwr-amend (rule 9), then re-review.`
  3. Position: with the other cross-file checks, **before** the high-tier threat check (line ~466) — a mismatch must not be dodgeable by editing review first. Applies on commit and release paths (shared function). After equality holds, the existing threat check reading `review.md` is safe unchanged.
- **Mechanical?** Yes — verdict-gate block.
- **Verify:** fixture `spec: medium` + `review: low` → commit blocked naming both; align review → passes; `high`/`high` → release threat gate still fires; review without spec.md → blocked.

#### A2. `diff_ref` validated at the gate (D2)

**Blast radius:** a review copied from another branch, or rendered against the wrong diff, ships the wrong change — the field that would catch this is never read.

- **Files:** `plugins/lpwr-verdict-gate.ts`.
- **Change:** parse `diff_ref` from review frontmatter; missing/empty → block both paths (template ships the field).
  - **Commit path (`!release`):** value must normalize to `HEAD (uncommitted)` — review runs against `git diff HEAD` pre-commit (changelog 0.7.0). Anything else → `review.md diff_ref is "<value>" but must be "HEAD (uncommitted)" at commit — re-run lpwr-review against the change being committed.`
  - **Release path:** accept `HEAD (uncommitted)` **or** an `A..B` / `A..` range whose endpoints resolve via `git rev-parse --verify <rev>^{commit}` (timeout-bounded, same pattern as `shippedInGit`). Unresolvable → block naming the value.
  - Default noted: byte-level proof (hashing the reviewed diff) is explicitly out of scope — see below.
- **Mechanical?** Yes — verdict-gate block.
- **Verify:** `HEAD (uncommitted)` → commit passes; `main` → blocked; release with resolvable `a1b2c3..d4e5f6` → passes; release with bogus SHA → blocked.

#### A3. Memory receipt checked at spec-link (D6)

**Blast radius:** the consistency root — constitution floors, lessons, and memos are consulted or not at model discretion; a proposal can reach implement with the receipt untouched.

- **Files:** `plugins/lpwr-spec-link.ts`, `commands/lpwr-specs.md` (prose refusal — lands in Wave B).
- **Change:** after the existing status/state/design checks:
  1. `basis: observed` → skip (explore path has no proposal by design: `proposal_ref: null`).
  2. `basis: proposed` (or basis absent → treat as proposed): read `docs/specs/<id>/proposal.md` — missing → block (spec claims a proposal that doesn't exist).
  3. Require a `Checked against memory` section whose `Constitution:` / `Lessons:` / `Memos:` lines are all present and carry no unfilled template placeholder (`<…>` metavars — same detection idea as `templateLeftovers`, code spans stripped first so backticked `<id>` can't false-positive).
  4. Block message: `proposal.md for <id> has no completed "Checked against memory" receipt (Constitution / Lessons / Memos) — complete the motion's memory check before implementing.`
- **Mechanical?** Yes — spec-link block at implement entry; specs refusal is the earlier prose checkpoint.
- **Verify:** proposed spec + untouched receipt → blocked naming the section; fill with `none relevant`-style values → passes; `basis: observed` without proposal → passes; proposed but proposal.md deleted → blocked.

#### A4. Low-confidence advisory at commit (D1)

**Blast radius:** `confidence` exists as evidence metadata with a rubric ("high only with a passing check behind the claim") and zero consumers — low-confidence work is indistinguishable from high at the exit gate.

- **Files:** `plugins/lpwr-verdict-gate.ts` (helper + call under `!options.release`; `toastWarning` from `shared.js`).
- **Change:** read `docs/specs/<id>/log.ndjson`, collect lines with `confidence === "low"`; if any → one aggregated **non-blocking** `toastWarning`: `N low-confidence handoff(s) in <id>: <intent>@<ts>, … (capped at 5) — confirm before ship.` Missing log → skip (the non-retain-handoff block already fires). Commit path only — release follows commit and would double-toast.
- **Mechanical?** Yes, but advisory (warning) — the human still decides; nothing blocks.
- **Verify:** log line with `confidence: low` → commit emits one toast (and a structured `logWarn` if cheap); all medium/high → silent; release after commit → no duplicate.

### Wave B — Prose alignment

#### B1. Reword "the log goes archival" (D4)

- **Files:** `commands/lpwr-commit.md` step 4.
- **Change:** replace the phrase with the mechanism that actually exists: the `retain` handoff closes the spec's active loop; the log stays in the repo as append-only history and `state.md` Done is the durable "shipped" signal (guide stops suggesting steps for a Done spec). One sentence, no new process.
- **Verify:** `rg archival harness/` → 0 hits; step still reads as closing the loop.

#### B2. `audit.md` path discipline (D5)

- **Files:** `commands/lpwr-onboard.md` (~:8), `commands/lpwr-implement.md` (gates line), `templates/review.md` (security box), plus whatever `rg -n '\baudit\.md\b' harness/ --glob '!node_modules'` surfaces (security-scan comments, goal, etc.).
- **Change:** every short `audit.md` reference qualifies as either `docs/audit.md` (project trail) or `docs/specs/<id>/audit.md` (per-spec security). The review box becomes `` `docs/specs/<id>/audit.md` `` — safe for verdict-gate because `templateLeftovers` strips code spans before matching `<…>` (the backticked `<id>` never counts as a placeholder).
- **Verify:** the rg sweep returns only full paths, backticked full paths, or the two headers that self-disambiguate.

#### B3. Prose companions for Wave A

- **Files:** `commands/lpwr-specs.md` (approval refusal), `commands/lpwr-review.md` (frontmatter instruction), `commands/lpwr-commit.md` (checklist line), `docs/implementation-rules.md` (rule 39).
- **Change:**
  1. Specs: approval refusal gains — motion's `Checked against memory` must be completed (Constitution/Lessons/Memos filled); note it's mechanically checked at implement (A3).
  2. Review: frontmatter instruction — `risk_tier` carried over verbatim from `spec.md`; a tier change travels through `lpwr-amend` (matches A1's block message).
  3. Commit: checklist line — name any low-confidence handoffs in the commit summary when the advisory (A4) fired.
  4. Rule 39: append one clause — carry-over is enforced by `lpwr-verdict-gate.ts` (review tier must equal spec tier).
- **Verify:** wording lands; `npm run lint` && `npm run typecheck` after the wave.

---

## Round 2 execution order

1. **Wave A:** A1 → A2 → A3 → A4 (one file dominates: verdict-gate takes three of the four — do them in one pass; spec-link A3 separate). `npm run lint` && `npm run typecheck` after the pass.
2. **Wave B:** B1 → B2 → B3 (md/template only; B3 wording cites Wave A behavior, so it lands second).
3. Wave commits only when asked ("Create the GIT commit"); A and B as two commits (code gate, then prose alignment).

**Status (2026-09-24):** Waves A + B implemented. Lint + typecheck green; 24-fixture gate suite green (A1 tier equality, A2 diff_ref forms/ranges, A3 receipt, A4 advisory); B1 archival phrase gone from live prose (this doc keeps the historical quotes), B2 sweep clean outside this dated record, B3 wording landed. Commits pending the human's ask.

## Round 2 out of scope

- **Byte-identical answers:** the harness delivers same grounding + same decisions; wording variance is the generation layer (temperature, prompts) — a different problem, not wiring.
- **Diff content hashing:** proving the review saw the exact committed bytes (vs `diff_ref` form checks) — heavier machinery; revisit only if form checks prove insufficient.
- **`origin: "hook"` consumer:** provenance field, no decision rides on it — stays write-only.
- **Renaming either `audit.md`:** explicitly decided against (D5 = path discipline).
- **Confidence consumed at review/goal:** commit advisory covers the exit gate; revisit if low-confidence work slips through in practice.
- **Guide surfacing low-confidence:** guide stays read-only with a tight step list; the commit toast is the surface.

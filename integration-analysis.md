# Integration Analysis — workflow phase cross-wiring

Ongoing audit of how harness phases (domains) feed each other: what artifacts exist, what claims an integration, and whether the wiring is mechanical, prose-only, or missing. One domain per pass, in stage order.

Repo-level history: this is development material for this repository, not harness boilerplate — `harness/` ships without it, and no command, plugin, skill, or template reads it.

Status legend: **Wired** (command/template/plugin enforces it) · **Prose** (stated, not enforced) · **Gap** (claimed or needed, absent) · **Ephemeral** (output has no durable home).

Last updated: 2026-09-26 — Round 7 (1.4.4 fixing-plan review) added below; Round 6 (third runtime simulation, post-1.4.0) added and implemented in waves; Round 5 table below is the as-found record (statuses not rewritten retroactively).

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

**Round 2 close-out (2026-09-25):** all six implemented — D1/A4 low-confidence advisory, D2/A2 `diff_ref`, D3/A1 tier equality, D4/B1 archival reword, D5/B2 path discipline, D6/A3 memory receipt; plus F1 (memos → propose) from Wave 1. The findings table above is kept as the as-found record; statuses are not rewritten retroactively.

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

---

# Round 3 — 1.3.0 mechanism consistency (worktrees / single orchestrator / TUI)

Goal: the 1.3.0 mechanisms (branch-per-spec worktrees, single-orchestrator delegation, TUI pulse) landed on top of gates and prose written before them. Round 3 makes the new surface internally consistent — a Retain-stage write blocked by a worktree guard's own surface rule, a Verify command that escapes its worktree, a trunk name hardcoded to `develop`, and a reconcile step that can never fire. Integration-analysis itself stopped at Round 2 and is now stale against 1.3.0; this section is the overdue pass.

**1.3.0 is held unreleased until Waves A and B land.** Existing 1.3.0 work stays uncommitted; folds into the 1.3.0 release. Wave C + D follow as 1.3.1 unless folded by human decision.

Status legend as above (Wired / Prose / Gap / Ephemeral).

### Decisions (human-confirmed)

- **Release split:** A + B fold into 1.3.0 (still unreleased); C + D land as 1.3.1.
- **Retain sandbox (R3-01):** harness bookkeeping paths (`docs/lessons/**`, `docs/state.md`, `docs/audit.md`, `docs/memos/**`) are always inside a spec branch's allowed surface — they are the audit trail, not product surface.
- **Trunk (R3-03):** trunk is derived from the main worktree's current branch, never hardcoded; a small `shared.ts` helper names it once.
- **Release-ref (R3-04):** `lpwr-commit` reconciles *any* open `release-ref` into the matching spec's Done line, not only the committing spec's — the only ordering that ever fires.
- **Rule 33 carve-out (R3-05):** `lpwr-setup` may append machine-level suggestions to `docs/audit.md` (no spec ID, append-only); rule 33 reworded to exempt that one file rather than leaving setup three-way self-contradictory.
- **Per-spec audit shape (R3-12):** gets `templates/audit-per-spec.md` (full name keeps the D5 path discipline), not a rename of either `audit.md`.
- **MCP grants (R3-16):** setup stays report-only; no agent is granted `mcp_*` in this round — the deny default is intentional until a phase needs a server.
- **Tests (R3-17):** gate predicates get exported and covered by a committed `node:test` fixture harness; the ad-hoc 46-fixture runs are not enough to catch worktree regressions.

---

### Round 3 findings

| ID | Finding | File(s) | Blast radius | Status |
|----|---------|---------|--------------|--------|
| R3-01 | Retain writes (lesson, state, audit) fall outside the spec-branch declared surface → `lpwr-scope-guard` blocks `lpwr-commit` | `plugins/lpwr-scope-guard.ts:19-52,178-224`, `commands/lpwr-commit.md:14,18-19` | Commit cannot complete in the worktree | **Gap** |
| R3-02 | `lpwr-threat-review` (and keyed `lpwr-diagnose`) absent from worktree `WORK_STAGE`; spec folder is worktree-only after mint; threat-review `Next:` skips commit | `plugins/lpwr-worktree-guard.ts:43-53`, `commands/lpwr-threat-review.md:10,16` | Diverging `docs/specs/<id>/` written on trunk; wrong route | **Gap** |
| R3-03 | `lpwr-review` hardcodes trunk as `develop` | `commands/lpwr-review.md:10` | Non-portable; review rebases a non-existent branch off `develop` | **Gap** |
| R3-04 | `release-ref` reconcile targets "the next `/commit` for this ID" — commit precedes release and the worktree prunes at next propose | `commands/lpwr-release.md:12`, `commands/lpwr-commit.md:18,25` | Release ref never reaches `state.md` Done on the happy path | **Gap** |
| R3-05 | `lpwr-setup` writes/seeds `docs/audit.md` while `:10,28,30` and rule 33 say it never writes under `docs/` | `commands/lpwr-setup.md:10,21,28,30`, `docs/implementation-rules.md:126-127` | Self-contradiction; a rule is violated by its own command | **Gap** |
| R3-06 | `lpwr-stack` claims implement/diagnose "may only choose tools listed there"; both use a `question` checkpoint and no plugin enforces | `commands/lpwr-stack.md:10` vs `lpwr-implement.md:12`, `lpwr-diagnose.md:12` | Prose masquerading as a gate (rule 5) | **Prose** |
| R3-07 | `lpwr-amend` never deletes `review.md` despite rule 38; a stale `ship` can survive re-approval | `commands/lpwr-amend.md:10-14`, `docs/implementation-rules.md:143-147` | Voided verdict not mechanically voided | **Gap** |
| R3-08 | `lpwr-improve` / `lpwr-interview` write files with no `Delegation:` line while pinned to deny-edit orchestrator; `lpwr-propose` same but recovers in prose | `commands/lpwr-improve.md:8`, `lpwr-interview.md:10`, `lpwr-propose.md:12` | Write has no route on the pinned agent | **Gap** |
| R3-09 | `conventions.md:4` cites "AGENTS.md rules 1, 7–12" for a set that includes handoffs (= rule 3) | `docs/conventions.md:4` | Stale cross-ref | **Prose** |
| R3-10 | README says "13 `lpwr-*` plugins" (12 `lpwr-*` + `shared.ts`) | `README.md:72-73` | Count wrong | **Prose** |
| R3-11 | Integration-analysis stops at Round 2; D1–D6/F1 tables still read Gap though implemented; guide step refs shifted (16/17/18 → 17/18/19); worktree-guard comment names a non-existent `tasks.md` | this file, `plugins/lpwr-worktree-guard.ts:563` | Audit artifact contradicts reality | **Gap** |
| R3-12 | Per-spec `docs/specs/<id>/audit.md` has no template; shape only in a code comment | `plugins/lpwr-security-scan.ts:144-156` | Security trace has no contract | **Gap** |
| R3-13 | TUI reads handoff `confidence` as a number but the journal writes the enum `high|medium|low`; `countList` mishandles `[]` | `tui/lpwr-tui.tsx:110-115,146-148`, `plugins/lpwr-log-handoffs.ts:135,157` | Confidence never renders; phantom "waived 1" | **Gap** |
| R3-14 | `lpwr-voice` referenced by no command/agent by name — rule 12 only | `AGENTS.md:18`, `skills/lpwr-voice/SKILL.md` | Name-level orphan | **Prose** |
| R3-15 | `templates/constitution.md:2` says it "never ships approved", against onboard's approval flow; root `constitution.md` still `draft` + placeholders | `templates/constitution.md:2`, `commands/lpwr-onboard.md:14` | Template contradicts the owned approval path | **Prose** |
| R3-16 | Root `opencode.json` untracked and absent from README layout; all configured MCP servers unusable under `mcp_*: deny` | root `opencode.json`, `harness/opencode.json:26`, `README.md:55-81` | Dev config invisible; MCP surface inert | **Gap** |
| R3-17 | No committed test/fixture harness for the mechanical gates; verification is ad-hoc | repo root (no `test/`), `package.json` | Gate regressions uncatchable | **Gap** |

---

## Round 3 plan

Same convention as prior rounds: anything that must hold mechanically gets a gate; prose items either gain a gate or are honestly relabeled. Ordered by blast radius — the 1.3.0 mechanism is wrong before its documentation is.

### Wave A — 1.3.0 mechanism correctness (P0)

#### A1. Retain sandbox in scope-guard (R3-01)

- **Files:** `plugins/shared.ts` (new `RETAIN_PATHS` export), `plugins/lpwr-scope-guard.ts` (`readDeclaredSurface` seed list).
- **Change:** seed the allowed surface with `docs/specs/<id>/**` **plus** `docs/lessons/**`, `docs/state.md`, `docs/audit.md`, `docs/memos/**`. These are harness bookkeeping, not declared product surface, so they must not be required in the Tasks section. Keep the Tasks-backtick extraction as-is.
- **Mechanical?** Yes — plugin allow-list.
- **Verify:** fixture spec branch: edit `docs/lessons/<date>-<id>.md`, `docs/state.md`, `docs/audit.md` → allowed; edit an undeclared source file → still blocked naming it. Re-run the commit flow end-to-end in a throwaway worktree.

#### A2. Worktree WORK_STAGE completeness + threat-review route (R3-02)

- **Files:** `plugins/lpwr-worktree-guard.ts:43-53`, `commands/lpwr-threat-review.md:16`.
- **Change:** add `lpwr-threat-review` and `lpwr-diagnose` to `WORK_STAGE` (the guard's `wrongTree` already no-ops when the first arg is not a spec ID, so unkeyed diagnose stays runnable from anywhere). Fix `lpwr-threat-review` `Next:` → `lpwr-commit` (high-tier path is review → threat-review → commit → release).
- **Mechanical?** Yes — command gate.
- **Verify:** from trunk with a minted worktree, `/lpwr-threat-review <id>` → blocked with the restart-in-worktree message; from the worktree → runs. Threat-review `Next:` names commit.

#### A3. Derive trunk, never hardcode it (R3-03)

- **Files:** `plugins/shared.ts` (new `trunkBranch(plugin)` helper: `git -C <mainRoot> branch --show-current`), `commands/lpwr-review.md:10`; audit `lpwr-commit.md:17` and `lpwr-worktree-guard.ts` mint for the same helper.
- **Change:** replace `git rebase --autostash develop` with the derived trunk. Worktree-guard already mints from `git branch --show-current` on the main worktree — reuse the helper there for one definition.
- **Mechanical?** Partly — the command is prose; the helper is code. Optionally fail `lpwr-review` from a shared plugin check when trunk can't be derived (detached HEAD).
- **Verify:** fixture repo whose trunk is `main` → review rebases `main`; detached-HEAD main worktree → review refuses with a named reason.

#### A4. Make release-ref reconcile reachable (R3-04)

- **Files:** `commands/lpwr-commit.md:18`, `commands/lpwr-release.md:12`.
- **Change:** commit step 7 reconciles **any** open `release-ref` entry (for any spec) into that spec's `state.md` Done line and marks it consumed — not only the committing spec's. Release keeps appending the audit entry (single-writer intact). Reword release's prose accordingly.
- **Mechanical?** Prose in the single-writer command; acceptable (commit already owns state).
- **Verify:** ship → commit → release (open `release-ref` remains) → next commit anywhere folds it into the Done line; no second commit for the same ID required.

**Wave A gate:** `npm run lint` && `npm run typecheck`; run the A1 fixture end-to-end.

### Wave B — 1.3.0 contradictions (P1)

#### B1. Setup ↔ rule 33 (R3-05)

- **Files:** `commands/lpwr-setup.md:10,28,30`, `docs/implementation-rules.md:126-127`.
- **Change:** reword rule 33 to exempt `docs/audit.md` (append-only machine suggestions, no spec ID) and make setup's "writes nothing under docs/" lines say "writes nothing under `docs/` except `docs/audit.md`". `lpwr-install` seeding stays.
- **Verify:** `rg -n "never writes under|writes nothing under" harness/` returns only the qualified wording; setup step 4 still appends the suggestion block.

#### B2. Stack tool-choice relabel (R3-06)

- **Files:** `commands/lpwr-stack.md:10`.
- **Change:** "implement/diagnose **prefer** the tools recorded there; before invoking an unlisted system binary via bash, confirm with the human via `question` (see `lpwr-implement` step line). Freeform non-bash tooling is advice." — matches the actual checkpoint; no plugin.
- **Verify:** the word "may only" is gone from `lpwr-stack.md`; the three commands agree on "prefer + question".

#### B3. Amend deletes the voided review (R3-07)

- **Files:** `commands/lpwr-amend.md`, `skills/lpwr-spec-amendment/SKILL.md` (if it restates the sequence).
- **Change:** add an explicit step: after approval returns to draft, delete `docs/specs/<id>/review.md` (delegated to a worker); the missing review is what re-blocks commit/release until re-review. Keep the `question` re-approval.
- **Mechanical?** Command step; verdict-gate already blocks a missing `review.md` (`lpwr-verdict-gate.ts:576-581`), so the delete is the only missing half.
- **Verify:** amend → `review.md` absent → `/lpwr-commit <id>` blocked "no review.md"; re-review → commit opens.

#### B4. Delegation lines (R3-08)

- **Files:** `commands/lpwr-improve.md`, `commands/lpwr-interview.md`, `commands/lpwr-propose.md`.
- **Change:** add the standard `Delegation: all steps below run on workers you spawn — you hold no shell or write.` line. Propose already says "scribe writes"; line makes it uniform.
- **Verify:** all 25 commands that write now carry `Delegation:`; `lpwr-guide`/`lpwr-teach` remain the legitimate read-only exceptions.

**Wave B gate:** `npm run lint` && `npm run typecheck`. Then update `CHANGELOG.md` 1.3.0 with a "Round 3 review" bullet and commit the whole 1.3.0 tree (see D2).

### Wave C — consistency, docs, TUI (P2, = 1.3.1)

#### C1. Doc cross-refs and counts (R3-09, R3-10)

- **Files:** `docs/conventions.md:4`, `README.md:72-73`.
- **Change:** conventions → "AGENTS.md rules 1, 3, 7–12"; README → "12 `lpwr-*` plugins + `shared.ts` helper".
- **Verify:** refs name the rules they mean; counts match `ls`.

#### C2. Refresh this analysis (R3-11)

- **Files:** this file, `plugins/lpwr-worktree-guard.ts:563`.
- **Change:** re-status Round 2 D1–D6/F1 as implemented (or move to a closed table); fix guide step references to 17/18/19 and "22-step"; change the guard's overlap message/comment from "tasks.md" to "`spec.md`'s Tasks section".
- **Verify:** no stale Gap remains for shipped items; guard message names the real file.

#### C3. Per-spec audit template (R3-12)

- **Files:** new `templates/audit-per-spec.md`; reference from `plugins/lpwr-security-scan.ts:144-156` comment, `commands/lpwr-implement.md:10`, `commands/lpwr-review.md:14`, `templates/review.md` security box, `commands/lpwr-onboard.md:10`.
- **Change:** materialize the existing comment shape as a real template (frontmatter `spec_ref`; `## <timestamp>` / command / result / bounded output). It is not installed into `docs/`, so no `lpwr-install` change.
- **Verify:** `rg "docs/specs/<id>/audit.md"` refs point at the template; a fresh security trace matches the template's shape.

#### C4. TUI pulse correctness + worktree awareness (R3-13)

- **Files:** `tui/lpwr-tui.tsx`.
- **Change:** (1) `Handoff.confidence` becomes `string | null`, parse the enum, display it; (2) `countList` treats `[]`, `null`, `~` as 0 and strips brackets before splitting; (3) optional worktree block: read `.git/worktrees/*/gitdir` + each `HEAD` ref to list open spec branches and mark `state.md`-Done as shipped, mirroring the guard's `guideStatus`.
- **Verify:** log with `confidence: "low"` renders `(conf low)`; `waived: []` shows nothing, not "waived 1"; two open worktrees render with shipped/in-flight.

#### C5. Voice wiring (R3-14)

- **Files:** `AGENTS.md:18` (already names it) or each `agents/*.md` Skills line.
- **Change:** smallest honest fix — either accept rule 12 as the wiring (mark Wired in this doc) or name `lpwr-voice` in each agent's `## Skills`. Prefer naming it in the agents' voice line; a shared-voice rule with zero named consumers is fragile.
- **Verify:** `rg -l "lpwr-voice" agents/` is non-empty; the skill is no longer name-orphaned.

#### C6. Constitution template wording (R3-15)

- **Files:** `templates/constitution.md:2`.
- **Change:** comment → "starts `draft`; becomes `approved` only through `lpwr-onboard`'s first-approval question (rule 25 governs amendments after that)". Root `constitution.md` approval is a human project action, out of harness scope — note it, don't auto-approve.
- **Verify:** template comment matches `lpwr-onboard.md:14`; no "never ships approved".

#### C7. Root config and MCP surface (R3-16)

- **Files:** root `opencode.json`, `README.md` repo layout, `commands/lpwr-setup.md:19-21`.
- **Change:** commit the root `opencode.json` (dev config) and add it to the README layout with a one-line note that it is the developer's MCP config, distinct from `harness/opencode.json` (shipped matrix). Keep `mcp_*: deny`; setup already reports suggested per-agent grants. No grant this round.
- **Verify:** `git ls-files opencode.json` non-empty; README layout lists it; no agent gains `mcp_*: allow`.

### Wave D — missing opportunities (1.3.1)

#### D1. Committed gate fixture harness (R3-17)

- **Files:** new `harness/.opencode/lib/gates.ts` (or export predicates from the plugins), new `test/` with `node:test`, `package.json` `test` script.
- **Change:** extract the pure predicates already living inline — `parseWaived` / `parseDeferred` / `tableComplete` / `verdictCheck` / `receiptIncomplete` / `diffRefProblem` / `declaredSurface` / `overlaps` — into exported helpers the plugins import; cover them with `node:test` fixtures (the same cases the ad-hoc 46-fixture runs used) plus the new Round 3 cases (Retain sandbox, WORK_STAGE, release-ref). Add `npm run test`.
- **Verify:** `npm test` green in CI/local; deleting a guard case fails a named fixture.
- **Mechanical?** This is the regression net the whole harness currently lacks — highest-value follow-up.

#### D2. Finalize 1.3.0 (from the hold decision)

- **Files:** `CHANGELOG.md` 1.3.0, `package.json`.
- **Change:** after Wave A + B are green, add a 1.3.0 "Round 3 review" bullet (scope-guard Retain sandbox, worktree WORK_STAGE completeness, derived trunk, release-ref reconcile, setup/amend/delegation fixes), run lint + typecheck, and commit the previously-untracked `lpwr-worktree-guard.ts` plus all pending 1.3.0 files. Then bump to 1.3.1 for Wave C + D.
- **Verify:** `git status` clean; README/CHANGELOG claims match tracked files; 1.3.0 plugin count and command counts true.

---

## Round 3 execution order

1. **Wave A** (A1 scope-guard → A2 WORK_STAGE → A3 trunk → A4 release-ref). Code gates, one pass per file; lint + typecheck; A1 end-to-end fixture.
2. **Wave B** (B1 → B2 → B3 → B4) — prose + one mechanical delete step; then update CHANGELOG 1.3.0 and commit 1.3.0 (D2).
3. **Wave C** (C1 → C2 → C3 → C4 → C5 → C6 → C7) as 1.3.1.
4. **Wave D** (D1 harness) as 1.3.1.

After each wave: `npm run lint` && `npm run typecheck`. Commits only when asked.

## Round 3 out of scope

- **Byte-identical reviews / diff hashing:** unchanged from Round 2.
- **`origin: "hook"` consumer:** stays write-only.
- **`confidence` at review/goal:** still the commit advisory (now rendered by the TUI); revisit only if low-confidence work slips.
- **Auto-granting MCP servers:** setup remains report-only and human-applied.
- **Approving the root constitution:** a project-governance action, not a harness change.
- **Renaming either `audit.md`:** D5 path discipline holds; R3-12 adds a template, not a rename.

### Status

- [x] Wave A — mechanism correctness (commit `ccc87d8`)
- [x] Wave B — contradictions (commit `c7910a5`)
- [x] Finalize 1.3.0
- [x] Wave C — consistency/docs/TUI (commit `6242e04`)
- [x] Wave D — fixture harness (`npm test`)

---

# Round 4 — runtime simulation (workflow dry-run)

Ran the workflow end-to-end from `harness/` (opencode 1.18.32): fresh-state bootstrap, a full spec lifecycle traced against the gate code, and empirical repros driving the compiled guards in throwaway git repos. Deployment model confirmed by the human: `harness/` contents are copied to the **project root**; the nested `loopwright/harness` layout is a repo-dev convenience only.

| ID | Finding | Evidence | Fix |
|----|---------|----------|-----|
| S4-01 | `lpwr-worktree-guard` `tool.execute.after` threw on every `frame`/`specify` handoff in a worktree session (trunk check ran before the existing-worktree lookup) | repro: trunk → no throw; worktree → `Refused: worktree creation runs from the trunk session` | mint only in trunk; worktree journal is a no-op (`lpwr-worktree-guard.ts`) |
| S4-02 | `lpwr-scope-guard` read the spec from the git root; with the harness in a subdirectory the spec was not found and **all** edits blocked | repro (nested): declared file → BLOCKED; root layout → ALLOWED | read from `plugin.directory` (same anchor as spec-link); parser shared in `lib/gates.ts` |
| S4-03 | Restart instructions wrong: prose hardcoded `../<id>/harness`; mint note reported the worktree root, not the harness dir | worktree created at `dirname(mainRoot)/<id>` + `rel` | mint returns/reports the harness path; commands say "the path the guard reported" |
| S4-04 | Bootstrap gate released domain commands on placeholder foundation after `lpwr-install` (existence-only check) | `lpwr-guard-bootstrap.ts` `existsSync` only | advisory `logWarn` when constitution is `status: draft` (not a hard gate — avoids the greenfield never-placeholder-free trap) |
| S4-05 | `lpwr-explore` routed to implement, but an empty Tasks/declared-surface makes scope-guard block every edit | gate trace | `Next: lpwr-tasks` first |
| S4-06 | Two declared-surface parsers (scope-guard backticks in `## Tasks`; worktree-guard bullets under `### Declared surface`) | code | unified `declaredSurfaceFrom` in `lib/gates.ts`, fixture added |
| S4-07 | Convoluted: at-cap guidance told the human to "close a shipped worktree" but only `lpwr-propose` prunes | gate trace | guide step 0 names `lpwr-propose` as the prune action |

**Verified working:** all 9 agents load and opencode regenerates `.opencode` deps on startup; standard-layout scope-guard (declared allowed, undeclared blocked, Retain sandbox allowed); trunk mint creates the worktree and reports the correct path.

**Out of scope / left as-is:** writing through foundation symlinks (assumed to follow links; `fs.writeFile` does).

---

# Round 5 — workflow simulation (second pass, post-1.3.2)

A second end-to-end dry-run (same method as Round 4: real plugin hooks, throwaway clones, both the nested `harness/` layout and the consumer root layout) found 10 issues — 3 proven empirically, the rest code-traced. The nested-layout exclusion from Round 4 is retired: with S5-01 fixed, containment matches from the project directory (`plugin.directory`), the same anchor the surface patterns are written from, so root and nested layouts behave alike.

| ID | Finding | Evidence | Status |
|----|---------|----------|--------|
| S5-01 | Scope-guard containment compared `path.relative(gitDir, …)` (git-root-relative) against harness-relative patterns (`docs/specs/<id>/**` + `RETAIN_PATHS`) — in a nested layout every harness-internal write was blocked once a spec branch was active (`Blocked: harness/docs/specs/… is outside the declared surface`); root layout passed. 1.3.2 fixed only the spec-*read* anchor, not the path-*match* anchor; CHANGELOG 1.3.2 implied subdirectory support while Round 4's out-of-scope note declared it unsupported | `lpwr-scope-guard.ts` (match loop), `shared.ts` `RETAIN_PATHS`; nested repro vs root control | **Fixed 1.3.3** — match from `plugin.directory`; Round 4 nested exclusion removed |
| S5-02 | At the 2-worktree cap with no state-Done tree, guide step 0 said to run `lpwr-propose`; its prune is a no-op → the cap block fired with no named way out (manual `git worktree remove` never mentioned) — a dead loop | guide step 0; `capBlocked` sites in `lpwr-worktree-guard.ts` | **Fixed 1.3.3** — cap block and injected status name every recovery (resume / mark Done / manual remove); guide branches shipped vs none-Done |
| S5-03 | Harness ships no `.gitignore` and `EXPECTED` didn't check one → a root install carries the 5 foundation files untracked, so `pruneShipped`'s clean check never passes (cap fills after 2 specs), and `git add -A` staged `.env` + absolute foundation symlinks into the branch | dry-run status + staged-diff inspection | **Fixed 1.3.3** — `harness/.gitignore` ships (foundation, secrets, deps) + `EXPECTED` row |
| S5-04 | Log-handoffs creates phantom `docs/specs/<slug>/log.ndjson` folders for any ID-shaped first arg (`lpwr-diagnose null-pointer-500`, interview/research slugs ending in digits): `resolveSpecDir` accepts `-<digits>` with no existing folder and `writeHandoff` `mkdir -p`s it | `lpwr-log-handoffs.ts` `resolveSpecDir`, `writeHandoff` | Open |
| S5-05 | `docs/memos/**` and `docs/glossary.md` are absent from the worktree `FOUNDATION` link set — invisible from spec worktrees; edits made on trunk dirty it right before the commit gate | `lpwr-worktree-guard.ts` `FOUNDATION` | Open |
| S5-06 | Trunk-dirty refusal at the squash-merge is prose-only (`lpwr-commit` step 6) — no plugin enforces it | `lpwr-commit.md` step 6; no `dirty` check in verdict/worktree guards | Open |
| S5-07 | Guide step 11 detects an *empty* Tasks section only — template placeholder Tasks pass as real | `lpwr-guide.md` step 11 | Open |
| S5-08 | Raw `git commit` secret gate scans `git diff --cached` in the session's project dir, but the worktree squash-commit stages in the trunk worktree's index — the scan misses the staged squash | `lpwr-security-scan.ts` `scanStagedDiff` on the bash git-commit gate | Open |
| S5-09 | `lpwr-specify`: existing `spec.md` → "stop and use `lpwr-amend`"; `lpwr-specs`: `status: draft` → "resume it". Contradictory resume paths for the same file | `lpwr-specify.md`, `lpwr-specs.md` | Open |
| S5-10 | `.opencode/package.json` ships without `"type": "module"` | `harness/.opencode/package.json` | Open |

Verified working in the same run: mint + move + restart note, no-op specify in the worktree, spec-link, verdict gates (including raw `git commit`), state-through-symlink, release from trunk, prune with a Done entry; `npm test` 10/10, typecheck + lint clean.

---

# Round 6 — workflow simulation (third pass, post-1.4.0)

A third end-to-end dry-run of the spine from `harness/`, method extended with
opencode-runtime evidence: the hook model was read from opencode's source
(`plugin/index.ts` `getLegacyPlugins` + `Plugin.trigger`; `prompt.ts`
`command.executed` publish), plugin load order captured from two
`opencode debug config` runs, and the headline blockage reproduced in a
throwaway git repo. All four decisions below were confirmed through the
`question` tool before implementation.

## Decisions (human-confirmed, Round 6)

- **Journal timing (S6-03):** event-based. Auto-handoffs move from
  `command.execute.before` to opencode's `command.executed` event —
  published only after every before-gate passed and the command actually ran
  — so a blocked command never journals, in any install order. No plugin
  relocation; `lpwr-commit` is exempt (its step-5 retain line rides the
  merge; an end-of-command line would dirty the prunable worktree).
- **In-flight record (S6-04):** worktrees are the source. Guide preamble and
  the TUI derive the active spec from the session `.env`, then optional
  state `In flight` bookkeeping, then the open worktree list;
  `templates/state.md` ships empty sections; rule 19 untouched.
- **Verdict pick (S6-06):** `lpwr-review` gains the `question` round —
  rule 48's "verdicts go through the question tool" claim becomes true.
- **Memos (S5-05):** `docs/memos/` joins FOUNDATION — gitignored,
  provision-symlinked like `state.md` (rule 49 pattern); `.gitkeep`
  untracked; `lpwr-install` materializes the dir.

## Round 6 findings

| ID | Finding | Evidence | Status |
|----|---------|----------|--------|
| S6-01 | `plugins/shared.ts` failed plugin discovery on every startup (`Plugin export is not a function` — opencode requires every export to be a function; `SPEC_ID`/`EXPECTED`/`RETAIN_PATHS` are not) — the 1.0.0 "no-op default loads safely" claim was false | opencode source `getLegacyPlugins`; 23 ERROR lines in the local opencode log incl. 2026-09-26T03:06 from `harness/` | **Fixed (W1)** — moved to `lib/shared.ts`; `test/plugin-shape.test.ts` keeps `plugins/` default-export-only |
| S6-02 | Keyed `lpwr-research` / `lpwr-constitution` (legitimately run from trunk) journaled into a phantom `docs/specs/<id>/log.ndjson` on trunk — the later `git merge --squash` aborted on the untracked collision and the handoff line was lost | `resolveSpecDir` mkdir semantics; reproduced: `error: The following untracked working tree files would be overwritten by merge … Aborting` | **Fixed (W1)** — journal resolves through session root + every registered worktree (`specWorktreeBases`), refuses (never mints) folderless refs; `gates.specDirNames` + fixtures |
| S6-03 | Hook registration order is per-install (directory scan; dev order ≠ consumer order — two `opencode debug config` captures) and `Plugin.trigger` aborts at the first throw, so side-effect-before-gate behavior and block-message precedence silently varied per install | config captures; opencode source | **Fixed (W1)** — post-command journaling (order-independent); `lpwr-spec-link` diagnoses foundation/worktree/unknown-ID itself instead of trusting which hook ran first |
| S6-04 | `state.md` "In flight" had no writer (rule 19 gives state to `lpwr-commit` alone) — guide's stated primary orientation path and the TUI active-spec read never populated; template placeholders rendered as a phantom `blocked:` sidebar line | grep: no command writes In flight; TUI `sectionBullets` | **Fixed (W2)** — worktrees are the live record (decision above); empty template sections with comment hints |
| S6-05 | A redirect verdict never closes its spec — only shipped specs prune, so the redirected spec's worktree occupied a cap slot until manual removal, and guide step 0 suggested resuming it (looping back to step 18) | gate trace; `pruneShipped` needs state Done | **Fixed (W2)** — guide step 18 names the manual closure and why the prune will never take it |
| S6-06 | Rule 48 + conventions + CHANGELOG 1.1.1 claimed the verdict is a `question` pick; `lpwr-review` never mentioned the tool | grep: 0 hits in lpwr-review | **Fixed (W3)** — question round added to review; claim now true |
| S6-07 | `lpwr-release` / `lpwr-teach` append journal tails to trunk's `docs/specs/<id>/log.ndjson` after their commits, leaving trunk permanently dirty — commit step 6's prose "refuse while trunk is dirty" then tripped on every later spec with no documented resolution | code trace (release runs post-merge from trunk; nothing commits the tail); kintsugi consumer shows no tails only because no release has run there | **Fixed (W2)** — step 6 stages tails into the squash; `lpwr-worktree-guard` gates `merge --squash` on remaining trunk dirt (tails allowed; staged strangers blocked — empirically they would ride the ID-tagged commit silently) |
| S6-08 | `builder.md` said journal `artifact = diff pointer`; `lpwr-implement.md` says `artifact = criterion id` | side-by-side | **Fixed (W3)** |
| S6-09 | Guide step 3 suggested `lpwr-constitution` for a skipped constitution (contradicting its amendments-only rule and dead-ending at guard-bootstrap); `lpwr-amend`'s `Next:` skipped the `lpwr-specs` re-approval hop spec-link demands | guide:16 vs lpwr-constitution:10; spec-link status check | **Fixed (W3)** |

**Round 5 close-out (2026-09-26):** all seven open items closed in Waves 1–2 —
S5-04 (folderless refs refused, `gates.specDirNames`), S5-05 (memos join
FOUNDATION; glossary/trunk-doc dirt handled by the merge gate message),
S5-06 (`merge --squash` dirty gate in `lpwr-worktree-guard`), S5-07 (guide
step 11 detects template placeholders), S5-08 (staged-squash scan follows the
command's `-C` target via `gitCommandDir`), S5-09 (specify/specs share one
resume rule), S5-10 (`.opencode/package.json` gains `"type": "module"`).
The Round 5 table keeps its as-found statuses.

## Round 6 wave status

- [x] Wave 1 — S6-01 (shared relocation + shape fixture), S6-02 (worktree-aware
  journal), S6-03 (event journal + spec-link self-diagnosis), conventions model line
- [x] Wave 2 — S6-04 (in-flight = worktrees), S6-05 (redirect closure),
  S6-07 (tail reconcile + merge gate), S5-04…S5-10
- [x] Wave 3 — S6-06/S6-08/S6-09 prose alignments + this record
- [x] Post-review pass — restored `lpwr-amend`'s backstop auto-journal (dropped
  when `lpwr-commit` was exempted); TUI `lastHandoff` prefers explicit
  handoffs over `origin: hook` tails; guide step 6 conditions on "no active
  spec" instead of the (always-empty) state section; README's plugins line
  drops the shared-helper claim; `gitCommandDir` honors `cd <dir> &&` so the
  staged scan and merge gate find the right tree for that spelling too

Each wave gated with `npm run lint` && `npm run typecheck` && `npm test`
(20 tests after Wave 1) — all green.

## Round 6 migration note

Existing installs that still track `docs/memos/.gitkeep` keep the old
unlinked memo behavior (the worktree dir materializes, so the foundation
symlink is skipped) until the human runs `git rm --cached
docs/memos/.gitkeep` and re-mints; `loopwright.sh update` merges the new
gitignore lines automatically. The nested-install guard and its test now key
on `lib/shared.ts` (old `plugins/shared.ts` path still accepted).

---

# Round 7 — 1.4.4 fixing-plan review (post-1.4.4)

A read-and-verify pass over the shipped 1.4.2–1.4.4 worktree lifecycle work
— `npm run typecheck` clean, `npm run lint` 0 warnings/errors, `npm test`
35/35 — plus a citation audit of this round's own review (renamed from
`loopwright-1.4.4-fixing-plan.md` in Round 8). Three findings; all closed here.
Earlier tables keep their as-found statuses.

Round 9 folded both documents this round produced — the fixing plan as written
and the review of it — into the two `##` sections at the end of this round, so
every `integration-analysis.md Round 7 P0-1` style citation in
`lib/worktree.ts`, `plugins/lpwr-worktree-guard.ts`, and both worktree tests
resolves to text a reader can open. Neither exists as a root file any more.

## Round 7 findings

| ID | Finding | Evidence | Status |
|----|---------|----------|--------|
| S7-01 | `docs/glossary.md` absent from the worktree `FOUNDATION` link set — carried from S5-05 as "the worktree can't see glossary edits at all" | `lib/worktree.ts` FOUNDATION; `harness/.gitignore`; README ("glossary + conventions + implementation-rules, kept in git"); conventions' shared-foundation line names exactly `docs/{state,context,constitution,audit}.md` + `docs/memos/` | **Closed — exclusion confirmed.** FOUNDATION is exactly the gitignored set; the glossary is tracked, so every worktree checks it out and a link would be a no-op for it (for an untracked one it would hand the branch an absolute symlink to stage — the S5-03 hazard). The Round 6 close-out stands: trunk-side glossary dirt is named by the merge-gate message. The FOUNDATION comment and the glossary's Foundation row now state the boundary, so the flag does not recur. |
| S7-02 | `builder.md` still claimed Verify ("Write-isolated builder for Bootstrap, Execute, Verify, and Retain") — wrong tier for `review.md` writes, which belong to `scribe` (`edit: ask`) | `agents/builder.md:2` vs `agents/scribe.md:2`; `harness/opencode.json` delegation map (Verify→reviewer/scribe) | **Fixed** — the description drops Verify; Bootstrap, Execute, Retain stay. |
| S7-03 | `fixes.md` cited by four files, never committed — the 1.4.4 audit's reasoning gone while its fixes shipped | citations in `lib/worktree.ts`, `plugins/lpwr-worktree-guard.ts`, `test/worktree.test.ts`, `test/worktree-integration.test.ts`; CHANGELOG 1.4.4 | **Fixed** — reconstructed at the repo root as `fixes.md`: Phase 0 premises, P0-1…P3-2 (problem / change / verification each), the three human-confirmed decisions, release gate — from CHANGELOG 1.4.2–1.4.4, the shipped code, the fixtures, and the application session's record, provenance noted in the file. |

Companion note (Round 8 correction): `analysis.md` §5 (the W1–W9 / D1–D7 /
T1–T7 17-item audit behind 1.4.2) and `verification.md` (the 1.4.3 re-check)
were reported lost here as "untracked working documents" — **both have since
been restored and are committed**, alongside the original `fixes.md` (which
Round 7 recorded as reconstructed; the reconstruction has been replaced by the
authentic pre-implementation plan). `fixes.md` carries no scope section; the
1.4.2–1.4.4 outcomes remain in CHANGELOG 1.4.2–1.4.4, and `fixes.md`'s new
header points there.

Round 9 completed the consolidation this note was working toward: all four
standalone root documents (`fixes.md`, `loopwright-1.4.4-review.md`,
`analysis.md`, `verification.md`) are folded into this file — the plan and
its review under Round 7, the restored 1.4.2/1.4.3 originals under Round 8 —
and deleted from the repo root. Citations that named them now name a round
(see Round 9).

## Loopwright 1.4.4 Fixing Plan (as written, pre-implementation)

*Provenance: folded here verbatim in Round 9 from the former root file
`fixes.md` (headings demoted one level; the title above is that file's own).
The `P0-1…P3-2` IDs below are what `lib/worktree.ts`,
`plugins/lpwr-worktree-guard.ts`, `test/worktree.test.ts`, and
`test/worktree-integration.test.ts` cite as `integration-analysis.md Round 7
P0-1`. This is the plan as written, not a record of what shipped — as-built
outcomes and the three human decisions taken while applying it live in
`CHANGELOG.md` 1.4.4. The companion review of its output is folded in
immediately below.*

> **Read this before citing an item.** This is the plan as it was written, not
> a record of what shipped. The `P0-1…P3-2` IDs are what the code comments in
> `lib/worktree.ts`, `plugins/lpwr-worktree-guard.ts`, and both worktree tests
> resolve to; the as-built outcomes and the three human decisions taken while
> applying it live in `CHANGELOG.md` 1.4.4. Two details below never shipped as
> written: `lpwr-worktree-status --audit` (see Phase 0 and P0-1/P1-3) never
> existed — the audit shipped always-on in `lpwr-worktree-status`; and P1-1's
> `\d{3}` / `auth-14 is a bad shape` example was decided against — `SPEC_ID`
> stayed `/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/`. The companion review of this
> plan's output is the section immediately below.

Derived from the v1.4.3 verification pass. Items are ordered by risk: P0 = data-loss/stranding risk, P1 = workflow correctness, P2 = discoverability/docs, P3 = hygiene. Each item includes the exact target, the change, the test, and the acceptance criterion so it can be ticked off without re-litigating scope.

A short **Phase 0** precedes the fixes: three of the P0/P1 items were identified from the changelog and markdown, not from direct code inspection (tool access was limited during the review). Those must be confirmed against the actual source before patching, otherwise the plan is chasing ghosts.

---

### Phase 0 — Verify Before Patching

| # | Claim to confirm | Where to look | If false |
|---|---|---|---|
| V1 | `.env` write failure raises a TUI toast, not just `logWarn` | `lib/worktree.ts` → `provision` / `writeEnv` path | Downgrade to P1 and add the toast as part of item P0-2's pattern |
| V2 | `lpwr-commit` writes the manifest via `command.executed` → `markPendingCleanup` | `lpwr-worktree-guard.ts` event handler + `lib/worktree.ts` | Item P1-3 becomes a real code change, not just docs |
| V3 | `resolveCap` handles `abc`, `0`, `-1`, and unset correctly | `lib/worktree.ts` → `resolveCap` + tests | Item P0-1 expands to cover cap resolution too |

**Deliverable:** a one-line note in the PR description confirming each, with a file:line reference. No code changes in this phase.

---

### P0 — Correctness / Data-Loss Risk

#### P0-1. `readManifest` must not silently swallow a malformed manifest

**Problem.** A corrupted or truncated `.loop-worktrees/manifest.json` returns `{}`. Every pending-cleanup mark is lost, so `lpwr-worktree-prune` reports "nothing to prune" and the worktrees leak until the cap is hit. This is the same silent-catch pattern (W2) that 1.4.3 removed elsewhere, reappearing in the one place where losing state is worst.

**Target.** `lib/worktree.ts` → `readManifest`.

**Fix.**
```ts
export function readManifest(root: string): Manifest {
  const file = manifestPath(root);
  if (!existsSync(file)) return { pendingCleanup: {} };
  const raw = readFileSync(file, "utf8");
  try {
    const parsed = JSON.parse(raw);
    if (!isManifestShape(parsed)) {
      throw new Error("manifest shape mismatch");
    }
    return parsed;
  } catch (err) {
    // Do not lose marks. Surface and continue with an empty manifest
    // so the caller can still enumerate worktrees by git, but tell the human.
    toast({
      level: "warn",
      message:
        "Pending-cleanup manifest could not be read; some shipped worktrees may not be prunable. " +
        "Run `lpwr-worktree-status --audit` to reconcile.",
    });
    logWarn("worktree.manifest.read_failed", { file, error: String(err) });
    return { pendingCleanup: {}, _corrupt: true };
  }
}
```

Add `isManifestShape` as a small type guard. Add a `_corrupt` flag (or a separate return channel) so `worktreePrune` can refuse to claim "clean" when the manifest is unreadable.

**Test.** Fixture: manifest containing `{"pendingCleanup": {` (truncated). Assert: (a) a warning is emitted, (b) `worktreePrune` does not report "nothing pending" silently, (c) the process exits non-zero if invoked with `--strict`.

**Acceptance.** A corrupted manifest produces a visible warning and a non-ambiguous prune result. No path returns an empty manifest without a side-channel signal.

---

#### P0-2. `provision` must not leave broken symlinks

**Problem.** From the 1.4.2 audit (T7 / W2). If `provision` creates a symlink to a non-existent target (e.g. `mainHarness/.opencode/node_modules` missing), some filesystems still create the link, and the worktree is broken until a command fails mysteriously. The 1.4.3 changelog claims this was addressed, but the pattern of "try symlink, catch, warn" does not guarantee a pre-check.

**Target.** `lib/worktree.ts` → `provision`.

**Fix.** Pre-check every link target with `fs.existsSync(target)` **before** `symlink`. On miss, append to the same foundation-gap list the sidebar already renders.

```ts
for (const link of FOUNDATION_LINKS) {
  const target = join(mainHarness, link.rel);
  const dst = join(worktree, link.rel);
  if (!existsSync(target)) {
    gaps.push({ rel: link.rel, reason: "missing on trunk" });
    continue; // do not create a dangling symlink
  }
  try { symlinkSync(target, dst); }
  catch (err) { gaps.push({ rel: link.rel, reason: String(err) }); }
}
if (gaps.length) emitFoundationGaps(gaps); // same channel as existing gap UI
```

**Test.** Fixture repo where `mainHarness/.opencode/node_modules` does not exist. Assert: (a) `node_modules` symlink is **not** created in the worktree, (b) a gap entry is emitted, (c) the gap is visible in `lpwr-worktree-status`.

**Acceptance.** `find <worktree> -type l ! -exec test -e {} \; -print` returns empty after provisioning any worktree.

---

### P1 — Workflow Correctness

#### P1-1. Validate spec ID in `lpwr-explore` before `worktree_mint`

**Problem.** `lpwr-explore.md` instructs the agent to "assign the traceability ID now" then mint, without a validation gate. If the agent assigns a malformed ID (or an ID that collides with an existing spec), the worktree is created against a bad key, and the wrong-tree checks downstream compare against a value that no longer matches the branch.

**Target.** `lpwr-explore.md` + `lib/worktree.ts` → `worktreeMint` (or the guard's mint handler).

**Fix.** Two layers:

1. **Command layer.** Add an explicit step in `lpwr-explore.md`:
   > Before calling `worktree_mint`, confirm the assigned ID matches `^[a-z][a-z0-9-]*-\d{3}$` and does not already exist in `docs/specs/` or the worktree list. If it does, re-derive from the module name and a fresh counter.

2. **Service layer.** `worktreeMint` validates `SPEC_ID` and rejects collisions with an actionable error:
   ```ts
   if (!SPEC_ID.test(specId)) throw new Error(`invalid spec id: ${specId}`);
   if (await specExists(specId)) throw new Error(`spec id already exists: ${specId}`);
   ```

**Test.** Call `worktreeMint("auth-14")` (bad shape) and `worktreeMint("auth-001")` when that spec exists. Both must throw before any git worktree command runs. Assert no `.git/worktrees/` entry is created.

**Acceptance.** `lpwr-explore` on a module whose derived ID is malformed fails at the command layer with a human-readable message; `worktreeMint` refuses bad IDs at the service layer even when called directly.

---

#### P1-2. Make `worktreePrune` idempotent and resumable

**Problem.** From the 1.4.3 audit (item: "New prune command failure mode"). If `worktreePrune` is invoked on N worktrees and fails at the 3rd, the manifest still lists all N. Re-running must not double-remove or skip the un-pruned tail.

**Target.** `lib/worktree.ts` → `worktreePrune` and the manifest writer.

**Fix.**
- Remove the manifest entry **per worktree**, immediately after a successful `git worktree remove`. Do not batch the manifest write at the end.
- If `git worktree remove` fails, keep the entry and continue to the next; collect failures and exit non-zero if any.
- Add `--dry-run` that prints the plan without mutating.

```ts
for (const id of candidates) {
  const res = await removeWorktree(id);
  if (res.ok) deleteManifestEntry(root, id);   // durable per-item
  else failures.push({ id, reason: res.reason });
}
return { failures, removed: candidates.length - failures.length };
```

**Test.** Fixture with 3 pending worktrees; stub `removeWorktree` to fail on the 2nd. Assert: after the call, manifest contains only the 2nd; re-running prunes the 2nd and reports success; no worktree removed twice.

**Acceptance.** A prune interrupted at any index can be re-run and converges to zero pending entries.

---

#### P1-3. Document the manifest write in `lpwr-commit.md`

**Problem.** The manifest write is a side-effect of the commit flow. An agent or human reading `lpwr-commit.md` has no reason to know it exists, so debugging "why didn't my worktree prune" starts from a wrong assumption.

**Target.** `lpwr-commit.md`.

**Fix.** Add a short subsection after the Done-landing step:

> **Pending cleanup.** On successful commit, this command records the worktree in `.loop-worktrees/manifest.json` (gitignored) as *pending cleanup*. The next `lpwr-worktree-prune` will offer to remove it. If the file is corrupted or missing, `lpwr-worktree-status --audit` reconciles against git's worktree list.

**Test.** Doc-only; add a link from `lpwr-worktree-prune.md` back to this section.

**Acceptance.** Grep for `manifest.json` in `docs/` returns `lpwr-commit.md`, `lpwr-worktree-prune.md`, and the worktree section of `AGENTS.md`.

---

### P2 — Discoverability

#### P2-1. Cross-reference `lpwr-worktree-status` from prune

**Target.** `lpwr-worktree-prune.md` → `Next:` footer and step 1.

**Fix.** In the `Next:` footer, add: "To inspect without pruning, run `lpwr-worktree-status`." In step 1, name the status command explicitly rather than only the underlying `worktree_status` tool call.

**Acceptance.** A reader who lands on the prune command knows the read-only sibling exists within one screen.

---

#### P2-2. Surface `LPWR_MAX_WORKTREES` and `lpwr.max_worktrees` in the quickstart

**Target.** `README.md` quickstart section, or a dedicated "Worktree cap" note linked from it.

**Fix.** One paragraph:

> The open-worktree cap defaults to 2. Raise it for the session with `LPWR_MAX_WORKTREES=4`, or persistently in `opencode.json`:
> ```json
> { "lpwr": { "max_worktrees": 4 } }
> ```
> The env var wins; invalid values fall through to config; if both are absent, the default applies.

**Acceptance.** A user hitting the cap message can find the override without opening `PRINCIPLES.md`.

---

#### P2-3. Normalise remaining terminology drift

**Target.** Grep across `docs/` and command markdown for the banned variants from the 1.4.2 glossary plan:

- `main branch`, `main worktree` → `trunk`
- `Cap reached` → `Worktree cap reached (max: N)`
- `close one by hand` → `prune with lpwr-worktree-prune`
- `mint the ID` / `create the ID` → pick **mint** for ID, **create** for worktree

**Acceptance.** Grep returns zero hits for the banned strings. Add a `docs/glossary.md` if not present, defining trunk / worktree / mint / prune / shipped / open.

---

### P3 — Hygiene

#### P3-1. Confirm test coverage for the invalid-cap matrix

**Target.** `lib/worktree.test.ts` (or equivalent).

**Fix.** Ensure the fixture set covers `LPWR_MAX_WORKTREES` ∈ {unset, `""`, `"abc"`, `"0"`, `"-1"`, `"1"`, `"10"`} × {config unset, config `0`, config `5`}. Expected: only positive integers win; everything else falls through per `resolveCap`'s documented precedence.

**Acceptance.** The matrix is a single `describe.each` with explicit expected outputs; no case relies on `NaN` coercion.

---

#### P3-2. Add a mint→commit→prune integration test

**Target.** `test/integration/worktree-lifecycle.test.ts`.

**Fix.** Against a temp git repo:
1. `worktreeMint("auth-001")` → assert worktree exists, `.env` written, foundation links present (or gaps recorded).
2. `markPendingCleanup("auth-001")` → assert manifest entry.
3. `worktreePrune()` → assert worktree removed, manifest entry gone, no orphan in `git worktree list`.

**Acceptance.** The test runs in CI and fails if any of the three stages leaves residue.

---

### Sequencing and Estimated Effort

| Order | Item | Effort | Blocking |
|---|---|---|---|
| 1 | Phase 0 verification (V1–V3) | S | all P0 |
| 2 | P0-1 malformed manifest | S | — |
| 3 | P0-2 broken symlinks | S | — |
| 4 | P1-1 explore ID validation | S | — |
| 5 | P1-2 prune idempotency | M | — |
| 6 | P1-3 commit docs | XS | — |
| 7 | P2-1…P2-3 discoverability + terms | S | — |
| 8 | P3-1 cap matrix | S | — |
| 9 | P3-2 integration test | M | after P1-2 |

**Release gate for 1.4.4:** all P0 and P1 merged; P2 merged; P3-1 and P3-2 green in CI. Nothing in this plan changes a public command name, so 1.4.4 is a drop-in patch.

---

### Summary

The plan closes the one genuine data-loss risk introduced in 1.4.3 (`readManifest` swallowing corruption), hardens provisioning against dangling symlinks, adds the missing validation gate to `lpwr-explore`, makes prune resumable, and finishes the terminology and discoverability work that 1.4.3 started. Phase 0 exists because three of the findings were inferred from the changelog rather than the source — confirm those first, and the rest of the plan can proceed without rework.

## Loopwright 1.4.4 — Fixing-plan review (drove 1.4.5)

*Provenance: folded here verbatim in Round 9 from the former root file
`loopwright-1.4.4-review.md` (headings demoted one level; the title above is
that file's own). Item 3 of this review demanded exactly this fold — it has
been done: the plan is above, the four dangling `fixes.md` citations now read
`integration-analysis.md Round 7 P0-1`, and neither file exists at the repo
root. Findings 1 and 2 closed in the Round 7 table above.*

Review of what the 1.4.4 fixing plan (folded in the section above) actually shipped; renamed
from `loopwright-1.4.4-fixing-plan.md` so it cannot be confused with that
plan.

Verified empirically, not just read: dependencies installed, `npm run typecheck` (clean),
`npm run lint` (0 warnings/errors, 26 files), `npm test` (35/35 passing). The worktree lifecycle
rework in 1.4.2–1.4.4 is solid on its own technical merits. What follows are the gaps that survive
that — two carried over untouched from the last review, and one new to this pass.

---

### 1. Carried over, still open: `docs/glossary.md` excluded from `FOUNDATION`

**Where:** `harness/.opencode/lib/worktree.ts:728` — `FOUNDATION = ["state", "context",
"constitution", "audit"]`

This array physically moved during the 1.4.2 rework (`lpwr-worktree-guard.ts` → the new
`worktree.ts` service) but its membership didn't change. Flagged last time as a mitigation
(a clearer error message when it goes wrong) standing in for a fix (the worktree still can't see
glossary edits at all). The rework touched this exact array and every other foundation-visibility
concern around it (P0-2's "always-on audit," the dangling-symlink fixture) without anyone
revisiting whether glossary belongs in it — worth a five-minute look now that the surrounding
code is fresh in mind, one way or the other.

### 2. Carried over, still open: `builder.md` still claims Verify

**Where:** `harness/.opencode/agents/builder.md:2` — unchanged: "Write-isolated builder for
Bootstrap, Execute, Verify, and Retain."

`scribe.md` independently and correctly claims Verify's writes, and the permission matrix backs
that up (`scribe`: `edit: ask`, matching "every write needs human confirmation" — the right tier
for `review.md`; `builder`: `edit: allow`, the wrong tier for the same job). Untouched by the
1.4.2–1.4.4 work, which was scoped to worktree lifecycle rather than agent personas — reasonable
that it wasn't in scope, but it's a trivial fix whenever someone's next in that file.

### 3. New this pass: `fixes.md` is cited four times, exists nowhere

**Where:** `harness/.opencode/lib/worktree.ts`, `harness/.opencode/plugins/lpwr-worktree-guard.ts`,
`test/worktree.test.ts`, `test/worktree-integration.test.ts` — all reference specific items by
name: `fixes.md P0-1`, `P0-2`, `P1-1`, `P1-2`, `P3-1`, etc. The changelog for 1.4.2–1.4.4
describes this as a genuine, substantial audit (W1–W9 workarounds, D1–D7 drift, T1–T7 traps,
17 items total) that drove real, verified fixes — the same kind of exercise as the plan I wrote
last round. But the document itself was never committed to the repository.

This matters because `integration-analysis.md` — the project's own established audit trail,
carefully maintained through six rounds — stops at Round 6 (post-1.4.0). *[Round 9 note: it no longer does — Rounds 7, 8, and 9 of this file now carry everything after Round 6, including this review.]* The actual work that
produced 1.4.2 through 1.4.4 happened entirely outside that record, in a document that's now
gone. Anyone reading `worktree.ts` six months from now and hitting a comment like `// fixes.md
P0-2 acceptance: every symlink in the worktree resolves` has no way to find out what P0-2 was, why
it mattered, or what else was in the same plan. The fix landed; the reasoning behind it didn't.

**Fix:** either commit `fixes.md` to the repo (even as a closed/historical record, the way
`integration-analysis.md` keeps its Round 5 table "as-found" rather than deleting it), or fold its
content into `integration-analysis.md` as the Round 7 entry that's currently missing. Either way,
the four dangling citations should point at something a reader can actually open.

---

### What I checked and didn't flag

- **The symlink write-through concern from last round** is not directly round-trip tested by
  name, but the new integration test does verify something adjacent and real — no dangling
  symlinks survive provisioning, checked via a `find`-based fixture against a live temp repo. The
  changelog states this premise was reviewed and judged already sound (Node's `fs.writeFile`
  following symlinks is standard platform behavior, not project-specific risk). That's a
  defensible call, not a dodge — I'm downgrading this from "open" to "reasonably settled."
- **The custom tools (`worktree_mint`, `worktree_prune`, `worktree_status`)** aren't named
  anywhere in `opencode.json`'s permission matrix, which looked suspicious at first — but the
  orchestrator's `edit`/`bash`/`webfetch` are all `deny` while these clearly work (35 passing
  tests exercise them), so they're evidently registered as first-class tool calls outside the
  file-edit/shell permission surface, the same way `journal_handoff` and `question` already work.
  Not a bug.
- **PRINCIPLES.md's new "Worktree lifecycle" section** — read it against the actual command
  names and behavior in `worktree.ts`. Consistent throughout: mint/work/commit/prune, the cap
  resolution order, the "session never prunes its own worktree" rule. No drift found.

---

### Priority

Items 1 and 2 are each a few minutes of work whenever someone's next in those files — neither is
urgent, both have been sitting for one review cycle already. Item 3 is worth doing before the next
round of fixes happens the same way — otherwise this pattern repeats: real work, real verification,
and a growing pile of comments citing a document nobody committed.

---

# Round 8 — restore + gate hardening (post-1.4.5)

A full-remediation pass over the harness, executed in six gated waves —
lint + typecheck + tests after each (35 → 56 tests), one commit per wave.
Scope started as an independent audit of `harness/` looking for workarounds
dressed as fixes, technical debt, and misaligned implementations; Waves 1–2
reconciled the restored audit records and doc drift, Waves 3–4 rebuilt the
enforcement layer's testability and closed four gate gaps, Wave 5 corrected
Round 7's own close-out wording.

## Round 8 findings

| ID | Finding | Evidence | Status |
|----|---------|----------|--------|
| S8-01 | The 1.4.2/1.4.3 audit originals were still lost and `fixes.md` existed only as a reconstruction, while code cited it as the record; the Round 7 close-out and companion note asserted the loss as permanent, and two near-identical titles (`fixes.md` "Loopwright 1.4.4 Fixing Plan" vs `loopwright-1.4.4-fixing-plan.md` "Loopwright 1.4.4 — Fixing Plan") named a plan and a review of that plan | untracked `analysis.md` / `verification.md`, modified `fixes.md`; `CHANGELOG.md` 1.4.5; this file's companion note; README layout | **Fixed (Wave 1)** — originals committed; `fixes.md` reverted to the authentic pre-implementation plan with a header naming what did not ship as written (`lpwr-worktree-status --audit`, the `\d{3}`/`auth-14` rule) and pointing outcomes at CHANGELOG 1.4.4; review file renamed `loopwright-1.4.4-review.md` (+3 refs); README layout and the companion note corrected. All six code-cited IDs (P0-1…P3-2) resolve in the restored file. |
| S8-02 | Root `context.md` described one root that does not exist: counts of 8 agents / 26 commands / 11 plugins (actual 9/27/12), "`docs/` holds constitution, glossary, context, specs, lessons, state" with no `docs/` at the repo root, "MCP servers: none configured" against four in root `opencode.json`, and a `docs/constitution.md` pointer that resolves nowhere | `context.md:8-32` vs `ls`, README's correct counts, root `opencode.json` | **Fixed (Wave 2)** — rewritten to document both roots (repo root vs `harness/`), scoped the MCP claim to `harness/opencode.json`, repointed Principles at the root constitution and stated the enforced-path split (this workspace stays bootstrap-gated by design). |
| S8-03 | `AGENTS.md:3` pointed "the rules" at `docs/constitution.md` (which holds floors, not numbered rules, and does not exist in this repo), while two rule-numbering spaces (AGENTS 1–13, implementation-rules 1–52) share numbers with different meanings and code/commands cited bare `rule N` for N ≤ 13 | `AGENTS.md:3`; bare citations in conventions, glossary (6), lpwr-review/propose/explore/commit, verdict-gate (2), worktree (2) | **Fixed (Wave 2)** — AGENTS.md states the three-way split and requires citing by source; every ambiguous citation qualified (`AGENTS rule 1/2/4/7/9`, `implementation-rules 2/5`); `worktree.ts`'s "(rule 1)" on the shipped-ID claim dropped — neither rule 1 states single-use, now spelled out from AGENTS 1 + implementation-rules 2. |
| S8-04 | Rule 47 exempted four commands from `lpwr-guard-bootstrap`; the guard exempts six | `implementation-rules.md:197` vs `lpwr-guard-bootstrap.ts:14-21` | **Fixed (Wave 2)** — rule 47 lists `lpwr-worktree-prune` and `lpwr-worktree-status` with the same reason as guide. |
| S8-05 | Rule 48 claimed "the matrix names every known builtin" while `todowrite` was in neither the permission matrix nor `lpwr-setup`'s audit list — the completeness check could not see its own hole (omitted ⇒ default-allow for all nine agents) | `harness/opencode.json` (no `todowrite`), `lpwr-setup.md:20` (13 keys), `implementation-rules.md:205` | **Fixed (Wave 2)** — `"todowrite": "allow"` added to all nine agent blocks, to the setup checklist, and the known set spelled out in the rule. |
| S8-06 | No plugin could be loaded by a test: they imported `../lib/*.js` NodeNext specifiers plain `node` cannot resolve to `.ts`, so `plugin-shape.test.ts` regex-scanned source instead of importing it and every hook shipped with zero behavioral coverage; the helper split also left three `stateSectionHasEntry` copies (worktree, verdict-gate, spec-link) and `frontmatterBlock`/`normalizeEol`/the spec-ID regexes duplicated between `shared.ts` and `gates.ts` | `plugin-shape.test.ts`'s own comment; `lib/worktree.ts:9-12` proving `.ts` works under both runners; `tsconfig.json` `allowImportingTsExtensions` | **Fixed (Wave 3)** — all 12 plugins + TUI import `../lib/*.ts`; the shape test dynamic-imports every entry module; primitives centralized in `gates.ts` (`SPEC_ID`/`SPEC_REF`, `escapeRegExp`, `frontmatterBlock`, `frontmatterValue`, `normalizeEol`, `stateSectionHasEntry`) with `shared.ts` re-exporting; new fixtures drive spec-link, scope-guard, verdict-gate, and the state parser (35 → 48 tests). |
| S8-07 | `specIdArgument` existed, was tested, and was motivated by `lpwr-commit --amend auth-014` — but only `wrongTree` used it (analysis T2 / verification F11 scoped it to that one call site); spec-link, verdict-gate ×2, security-scan, and log-handoffs still read token[0]. security-scan's `if (specId && !SPEC_ID.test) return` silently skipped the dependency audit on a flag-prefixed invocation — the failure the helper's comment says it prevents | `shared.ts:78-86`; call sites in 4 plugins + log-handoffs' inline split | **Fixed (Wave 4)** — adopted at all five sites; the now-unreachable SPEC_ID re-checks collapse into one message naming the expected shape; `firstArgument` deleted (no callers). Parser tests already covered the flag cases. |
| S8-08 | `lpwr-scope-guard` unconditionally allowed `docs/specs/<id>/**` and re-read the surface per edit — the one agent with `edit: allow` could rewrite its own allow-list (criteria, `### Declared surface`, `status`) mid-Execute; `builder.md`'s "Never widen the Tasks surface" was prose (implementation-rules 5's own test) | `lpwr-scope-guard.ts:24` (+ the old always-allow surface array) | **Fixed (Wave 4)** — `status: approved` freezes spec.md to test-reference cells and lpwr-amend's approved→draft flip, validated against pending content (write compares whole files, edit applies `oldString`/`newString` first, apply_patch checked per marker section, unverifiable fails closed). `lpwr-amend` flips before amending; `lpwr-tasks` now flips, writes, and collects the package approval `lpwr-specify` gives, so the human approves the surface the gate enforces. |
| S8-09 | `review.md` was bound to nothing — no hash, timestamp, or version ties it to the `spec.md` it reviewed; a post-approval spec edit sailed through commit as long as `risk_tier` matched, so AGENTS rule 9 / implementation-rules 38's "review voided" held only by prose | `templates/review.md` frontmatter (id, date, diff_ref, risk_tier, waived, deferred); `verdict-gate` cross-checked only tier equality and diff_ref *form* | **Fixed (Wave 4)** — verdict-gate compares spec.md's acceptance table to the review's Specs axis at commit and release: criterion sets equal, two present test references agree (blanks legitimate for waived/deferred). |
| S8-10 | Rule 8 ("No other command path, including manual runs of the builder agent, should have deploy permission") had no mechanism — the matrix gives `builder` unscoped `bash: ask`, and verdict-gate gated only the `lpwr-release` command and `git commit` | `implementation-rules.md:30`; `opencode.json` builder block | **Fixed (Wave 4)** — the constitution declares `Deploy command:` (one `gates.constitutionCommands` parser serves it and `Audit command:`, which also fixes a CRLF leak in the audit reader); verdict-gate blocks that command outside a window opened only after release's own gate passes, closed on `command.executed` and on the next command, expiring after 10 minutes. Rule 8, `lpwr-release`, and the constitution template name the mechanism. |
| S8-11 | Round 7's S7-01 close-out asserted two things the code does not do: FOUNDATION is "exactly harness/.gitignore's set" (that file also ignores `.env*`, `node_modules/`, `secrets/`, `*.pem`/`*.key`, `.loop-worktrees/`), and tracked docs "reach every worktree through checkout" — checkout happens once at `git worktree add`, so trunk glossary/conventions/implementation-rules commits after mint are invisible in an open worktree (the original finding) | `lib/worktree.ts:711-717` (pre-fix); `harness/.gitignore` | **Fixed (Wave 5)** — comment and the glossary's Foundation row now state the mint-time-snapshot limit and the real membership (the gitignored foundation-docs subset); the exclusion decision itself stands (a link would stage an absolute symlink — S5-03). CHANGELOG 1.4.5 keeps its as-written claim as released history; this row is the correction. |

## Round 8 open items (carry forward)

- **T6 (from the folded 1.4.2 audit below, §4 T6)** — nothing verifies that `harness/.env`'s
  `OPENCODE_SPEC_ID` is actually *loaded*; `lpwr-scope-guard` reads
  `process.env`, `lpwr-install`/provision writes the file, the TUI parses it
  directly, and the only test asserts the file's contents
  (`worktree-integration.test.ts:169`). Needs an opencode-side answer about
  dotenv scope.
- **D4 (declined)** — `surfaceOverlap` stays advisory, now justified as
  implementation-rules 50's planning-time decision rather than a gap.
- **F12 (not done)** — `TAIL_ALLOWED` is declared data + rule 51, which
  satisfies W9/D6's contract requirement; F12's stricter form (derived from
  the spec's own journal path) was not built.
- **Optional, not built** — a tracked-doc staleness advisory in
  `foundationGaps`/`statusReport` (blob-compare against trunk) would report
  the mint-time-snapshot gap S8-11 documents; Wave 5 shipped docs-only, per
  plan.
- **B5 residual** — `review.md` tampering between review and commit is
  covered by scribe's `edit: ask` plus the S8-09 table binding; gates still
  cannot see who acts.

## Round 8 wave status

- [x] Wave 1 — S8-01 (restore + reconcile)
- [x] Wave 2 — S8-02…S8-05 (doc/rule drift)
- [x] Wave 3 — S8-06 (plugin testability + one shared gate core), 35 → 48 tests
- [x] Wave 4 — S8-07…S8-10 (specIdArgument, approved-spec freeze, review↔spec
  binding, deploy gate), 48 → 56 tests
- [x] Wave 5 — S8-11 (FOUNDATION/glossary wording)
- [x] Wave 6 — this record, CHANGELOG 1.4.6, version bump

Each wave gated with `npm run lint` && `npm run typecheck` && `npm test` —
all green. Committed directly on the default branch, out of process per
implementation-rules 4 (this repo has never run its own spec flow —
`docs/specs/` and `docs/lessons/` remain empty), which Rule 21's
propose→review path still contradicts; noted, not resolved here.

## The 1.4.2 audit (`analysis.md`)

*Provenance: folded here verbatim in Round 9 from the former root file
`analysis.md` (headings demoted one level; that file carried no title of its
own, so the heading above is added). This is the W1–W9 / D1–D7 / T1–T7
seventeen-item audit behind 1.4.2, restored in Round 8 Wave 1 (S8-01); §5 item
17, T6, D4, and W9 are the identifiers the Round 8 open items above refer to.*

Based on my analysis of the `loopwright` repository, particularly the worktree implementation in `lpwr-worktree-guard.ts` and its surrounding commands, I've identified several classes of issues: workarounds disguised as fixes, inconsistent terminology, workflow drift, and traps. Below are my findings and a phased fixing plan.

---

### 1. Workarounds Dressed as Fixes

| # | Location | Workaround | Why it's a problem |
|---|----------|-----------|-------------------|
| W1 | `lpwr-worktree-guard.ts` lines 16–17 | `// there is no command.execute.after hook to read a command result from` — the guard hooks `tool.execute.after` on `journal_handoff` to infer when a worktree should be created. | The worktree lifecycle is coupled to a tool's side‑effect rather than an explicit lifecycle event. If the journal tool changes its args or ordering, worktree creation silently breaks. This is a workaround for a missing command‑completion hook. |
| W2 | Lines 63–64 | `catch { // Raced or unsupported FS — lpwr-install/lpwr-setup remain the fallback. }` | Symlink failures are swallowed. The "fallback" (install/setup) is not invoked here; the user is left with a broken worktree until they happen to run another command. |
| W3 | Lines 82 | Empty catch after trying to copy `.opencode/.gitignore`. | The comment says "Trunk has no local .gitignore to copy", but if the file exists and the copy fails for another reason, the error is lost. This masks real filesystem issues. |
| W4 | Lines 92–95 | Manually materializing `docs/memos` on trunk because a "pre‑memos‑foundation install never ran lpwr-install". | This is a patch for missing installation steps. It creates a directory that should have been created by a proper setup command, introducing hidden state. |
| W5 | Lines 101–102 | If `.env` cannot be written, it logs a warning and falls back to branch‑derived spec ID. | The `.env` file is a convenience, not a requirement. The fallback is acceptable, but the warning is buried in `logWarn` and may be missed in headless runs. |
| W6 | Lines 108–109 | If the copied spec folder is empty, it logs a warning and leaves the source in place. | This creates a partial state: the worktree exists but the spec folder is still on trunk. The user must manually reconcile. |
| W7 | Lines 113–114 | `lpwr-commit` cannot remove the worktree its own session is running from; cleanup is deferred to the next `lpwr-propose`. | This is a fundamental limitation being treated as a design choice. It means worktrees accumulate until the next propose, and if that command is never run, they leak. |
| W8 | Lines 135–136 | The cap‑blocked error message is the "sole in‑band recovery path" for a full worktree cap. | Error messages should not be the primary recovery mechanism. The system should provide a command or self‑service path to prune. |
| W9 | Lines 164–170 | Special handling for `log.ndjson` tails: "empirically confirmed" that staged files ride the squash, so they are filtered out. | This is a fragile heuristic based on observed git behavior, not a documented contract. A git update could break it. |

---

### 2. Inconsistent Re‑wording and Terminology

| Term | Inconsistent variants | Impact |
|------|----------------------|--------|
| **Primary branch** | "trunk", "main branch", "main worktree", "trunk session" | Users may not realise "trunk" is just the branch checked out in the main worktree. The code resolves it dynamically but docs sometimes imply a fixed name. |
| **Worktree creation** | "mint", "create", "add", "mint the ID" | "Mint" is used for creating the spec ID and the worktree, but "create" and "add" are also used. The command names (`lpwr-propose`/`lpwr-explore`) "mint" the ID, while the guard "creates" the branch+worktree. |
| **Worktree cleanup** | "prune", "remove", "delete", "close" | `pruneShipped` removes clean worktrees; the cap message says "close one by hand"; the guide says "prune". This variation obscures the fact that they are the same operation. |
| **Worktree state** | "shipped", "Done", "closed", "clean", "dirty" | "Shipped" and "Done" are used interchangeably, but "Done" refers to a `state.md` section while "shipped" is a derived condition. "Clean" and "dirty" are git terms but are not consistently paired with the state check. |
| **Work‑stage commands** | "work‑stage", "work stage", "WORK_STAGE", "workstage" | Minor, but the hyphenation varies across comments and identifiers. |
| **Cap** | "cap", "CAP", "2‑worktree cap" | The constant is `CAP = 2`, but the error says "2‑worktree cap" and the guide says "Cap reached". Consistent casing would help. |
| **Spec ID** | "spec ID", "traceability ID", "spec ID (`-`)" | The placeholder `-` is sometimes shown as `auth-014` and sometimes as `<spec-id>`. |
| **Worktree session** | "worktree session", "worktree's session", "session in the worktree" | The phrase "restart opencode in the worktree session" appears in multiple forms. |

---

### 3. Workflow Drift

| # | Drift | Evidence |
|---|-------|----------|
| D1 | **Worktree lifecycle is scattered across three commands.** | `lpwr-propose`/`lpwr-explore` mint the ID; the guard creates the worktree on `journal_handoff`; `lpwr-commit` defers cleanup; the next `lpwr-propose` prunes. There is no single "worktree lifecycle" module or state machine. |
| D2 | **Cleanup depends on a future command.** | `lpwr-commit` cannot delete its own worktree. The user must remember to run `lpwr-propose` later, or the worktree leaks. The guide warns about this, but it is a workflow trap. |
| D3 | **The cap is a hard block with no self‑service escape.** | When `open >= CAP`, the only ways out are: resume an open session, mark a spec Done in `state.md`, or manually run `git worktree remove`. There is no `lpwr-worktree-prune` command. |
| D4 | **`surfaceOverlap` scans all worktrees but is only triggered by `lpwr-tasks`.** | The overlap check reads every worktree's spec folder, which is O(n) in the number of worktrees and may be slow. It is also advisory‑only (pushes a text part), not a gate. |
| D5 | **`guideStatus` duplicates logic from `pruneShipped` and `capBlocked`.** | The guide independently computes open worktrees, shipped status, and cap notes. If the pruning logic changes, the guide can fall out of sync. |
| D6 | **`mergeBlockingFiles` has a special case for `log.ndjson` that is not documented in the command's contract.** | `lpwr-commit.md` step 6 mentions staging journal tails, but the guard's filter logic (lines 170–182) is the actual enforcement. This is a hidden coupling. |
| D7 | **`provision` creates symlinks for foundation files, but the worktree is expected to have its own copy of `.opencode/.gitignore`.** | The copy of `.gitignore` is a special case that is not covered by the symlink logic. It is easy to miss when adding new foundation files. |

---

### 4. Traps

| # | Trap | Why it bites |
|---|------|-------------|
| T1 | **`mintGate` blocks minting from a worktree session and tells the user to "restart opencode in ${mainHarness}".** | If the user is already in a worktree session, the message says to restart in the main harness, but the actual path is the trunk worktree, not the harness directory inside it. The phrasing is misleading. |
| T2 | **`wrongTree` uses `firstArgument(args)` to extract the spec ID.** | If the command is invoked with flags before the spec ID (e.g. `lpwr-commit --amend auth-014`), `firstArgument` returns `--amend`, which fails the `SPEC_ID` test, and the wrong‑tree check is skipped. |
| T3 | **`mergeBlockingFiles` treats untracked `docs/specs/*/log.ndjson` as non‑blocking only if the state is `??` or ` M` with the tail pattern.** | Any other untracked file in `docs/specs/` will block the merge. This can trap users who have stale phantom journal copies. |
| T4 | **The `CAP` is hardcoded to 2.** | There is no configuration option. In a large project with many parallel specs, 2 may be too low, but the user has no way to raise it without editing the source. |
| T5 | **`pruneShipped` only prunes worktrees whose spec is in the `Done` section of `state.md`.** | If the state file is out of sync (e.g. the human forgot to mark Done), the worktree will never be pruned, and the cap will be hit. |
| T6 | **The `.env` file is written with `OPENCODE_SPEC_ID`, but the guard does not verify that the environment variable is actually loaded.** | The fallback is branch‑derived, so it may work, but the intent is unclear. |
| T7 | **`provision` creates symlinks to `mainHarness/.opencode/node_modules` etc., but if the main harness has no `node_modules`, the link target does not exist and the symlink is skipped.** | This silently leaves the worktree without dependencies, and the user may only discover it when a command fails. |

---

### 5. Fixing Plan

#### Phase 1 — Stabilise the Worktree Lifecycle (High Priority)

1. **Introduce a `worktree` service module.**
   - Move all worktree‑related logic (`listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, `ensureWorktree`, `provision`) into a dedicated `lib/worktree.ts`.
   - Expose a small API: `mint(specId)`, `prune(specId)`, `listOpen()`, `capStatus()`.
   - The guard plugin becomes a thin adapter that calls this service from hooks.

2. **Replace the `journal_handoff` hook with an explicit minting command.**
   - Add a dedicated `lpwr-worktree-mint` command (or make `lpwr-propose` call the service explicitly after it has the spec ID).
   - Remove the `tool.execute.after` hook for `journal_handoff`. This eliminates the W1 workaround and makes the flow deterministic.

3. **Add a self‑service prune command.**
   - Introduce `lpwr-worktree-prune` that lists open worktrees and lets the human prune shipped+clean ones, or force‑remove dirty ones after confirmation.
   - Update the cap error message to point to this command instead of manual `git worktree remove`.

4. **Make `CAP` configurable.**
   - Read the cap from `opencode.json` or an environment variable (e.g. `LPWR_MAX_WORKTREES`), defaulting to 2.

#### Phase 2 — Eliminate Workarounds

5. **Replace silent catches with structured warnings.**
   - In `provision`, if a symlink fails, log a warning with the target and link path, and record it in the audit log. Do not silently skip.
   - In the `.gitignore` copy, if the file is missing on trunk, log an informational message; if the copy fails, log an error.

6. **Remove the manual `docs/memos` creation.**
   - Move the `docs/memos` creation into `lpwr-install` (or a dedicated `lpwr-setup` step) so that the guard does not have to patch missing state.

7. **Decouple cleanup from the next `lpwr-propose`.**
   - Allow `lpwr-commit` to mark the worktree as "pending cleanup" in a manifest (e.g. `.loop-worktrees/manifest.json`).
   - A separate `lpwr-worktree-gc` command (or the prune command from step 3) can read the manifest and prune without requiring a propose.

8. **Document the `log.ndjson` tail contract.**
   - Add a section to `PRINCIPLES.md` or `implementation-rules.md` that explicitly states which trunk‑dirty files are allowed to ride the squash merge, and why. The guard's filter should reference this rule by number.

#### Phase 3 — Unify Terminology

9. **Create a glossary.**
   - Add a `docs/glossary.md` (or extend the existing one) with canonical terms:
     - **Trunk** — the branch checked out in the main worktree; resolved dynamically, never hardcoded.
     - **Worktree** — a linked working tree created for a spec.
     - **Mint** — the act of creating a spec ID and its worktree.
     - **Prune** — the act of removing a shipped and clean worktree.
     - **Shipped** — a spec that has a `Done` entry in `state.md`.
     - **Open** — a worktree that is not the main worktree.
   - Use these terms consistently in all commands, comments, and error messages.

10. **Normalise error and advisory strings.**
    - Replace "close one by hand" with "prune it with `lpwr-worktree-prune`".
    - Replace "restart opencode in ${mainHarness}" with "restart opencode in the trunk worktree (${mainHarness})".
    - Replace "Cap reached" with "Worktree cap reached (max: N)".

#### Phase 4 — Fix Traps

11. **Fix `wrongTree` argument parsing.**
    - Use a proper argument parser that skips flags. For example, find the first argument that matches `SPEC_ID`, not just the first token.

12. **Make `mergeBlockingFiles` configurable.**
    - Instead of a hardcoded `TAIL_LOG` regex, allow the command contract to declare which files are tail‑allowed. This can be derived from the spec's `log.ndjson` path.

13. **Ensure `provision` verifies link targets.**
    - Before creating a symlink, check that the target exists. If not, log a warning and record the gap in the TUI sidebar (the same mechanism used for foundation gaps).

14. **Add a `lpwr-worktree-status` command.**
    - Expose the same status that the guide prints, but as a standalone command. This makes the worktree state inspectable without running a full guide.

#### Phase 5 — Documentation and Tests

15. **Update `AGENTS.md` and `PRINCIPLES.md`.**
    - Add a "Worktree Lifecycle" section that describes the full flow: mint → work → commit → prune.
    - Document the cap, the prune conditions, and the manual recovery path.

16. **Add unit tests for the worktree service.**
    - Test `listWorktrees`, `findWorktree`, `pruneShipped`, and `capBlocked` with mocked git output.
    - Test the argument parser for `wrongTree`.

17. **Add an integration test for the mint–commit–prune cycle.**
    - Use a temporary git repository to verify that a worktree is created, committed, and pruned without leaving orphans.

---

### Summary

The worktree implementation is functional but carries significant technical debt: it relies on a fragile tool‑hook for creation (W1), silently swallows filesystem failures (W2–W4), and scatters lifecycle logic across commands (D1). The terminology is inconsistent, which makes the workflow harder to reason about, and several traps (T2, T5) can leave users stuck. The fixing plan above addresses these in phases, starting with a stable lifecycle service and moving through workaround removal, terminology unification, trap fixes, and finally documentation and tests.

## Verification (`verification.md`)

*Provenance: folded here verbatim in Round 9 from the former root file
`verification.md` (headings demoted one level; the title above is that file's
own). This is the F1–F17 fake-fix checklist that drove 1.4.3; Round 8's open
item F12 refers to F12 below.*

---

### How to verify each fix (and the "fake fix" patterns to watch for)

#### Phase 1 — Lifecycle

**F1. `lib/worktree.ts` service module exists and owns all lifecycle logic**
- ✅ Pass: `listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, `ensureWorktree`, `provision` are all in the new module; the guard plugin imports from it and contains no duplicated git parsing.
- ⚠️ Fake fix: a `lib/worktree.ts` is created but the guard still contains a second copy of `listWorktrees` "for convenience". Grep for `git worktree list` in the guard — it should appear **zero** times after the refactor.
- ⚠️ Fake fix: the service exists but `guideStatus` still recomputes cap/overlap locally (D5 not resolved).

**F2. Explicit minting, no `tool.execute.after` hook on `journal_handoff`**
- ✅ Pass: grep for `journal_handoff` in the guard — the worktree creation path should not reference it. A new `lpwr-worktree-mint` command or an explicit call inside `lpwr-propose`/`lpwr-explore` should be the trigger.
- ⚠️ Fake fix: the hook is renamed but still fires on a tool side‑effect. Check what event triggers minting.
- ⚠️ Regression risk: minting now happens *before* the spec folder is written, causing an empty worktree. Verify ordering.

**F3. `lpwr-worktree-prune` command exists and cap error points to it**
- ✅ Pass: the cap error message text contains `lpwr-worktree-prune` (or the equivalent command name), and the command is registered in `opencode.json` / the command directory.
- ⚠️ Fake fix: the command is registered but delegates to `git worktree remove` without the shipped+clean gate — that reintroduces the "leak" trap in reverse (data loss).
- ⚠️ Fake fix: the message says "use the prune command" but the command is not discoverable via `--help`.

**F4. `CAP` is configurable**
- ✅ Pass: `CAP` reads from a config source with a default of 2. Check the schema — is it typed? Is there a validation range?
- ⚠️ Fake fix: env var is read but not documented, or read as a string without `parseInt`/`Number()` guard (so `LPWR_MAX_WORKTREES=abc` silently becomes `NaN` and every comparison is false → cap never blocks, or always blocks).

---

#### Phase 2 — Workarounds

**F5. Silent catches replaced with structured warnings**
- ✅ Pass: every `catch {}` in `provision` / `ensureWorktree` logs a warning with the operation, target, and error. Bonus if it's also recorded in the audit log.
- ⚠️ Fake fix: the catch is now `catch (e) { logWarn(String(e)) }` — technically not silent, but loses the target/link path. Look for the actual context in the message.
- ⚠️ Fake fix: warnings are emitted but the function still returns success, so callers can't branch on partial failure.

**F6. `docs/memos` creation moved to install/setup**
- ✅ Pass: grep for `memos` in the guard — if it still appears in `provision`, the workaround is still there. It should only appear in install/setup.
- ⚠️ Fake fix: the directory is created in both places "just in case" — that's still hidden state.

**F7. Cleanup decoupled from next `lpwr-propose`**
- ✅ Pass: a manifest (e.g. `.loop-worktrees/manifest.json`) or equivalent marker records "pending cleanup", and `lpwr-worktree-prune` / `lpwr-worktree-gc` reads it.
- ⚠️ Fake fix: `lpwr-commit` now calls `prune` directly on itself — this reintroduces W7 (you can't remove the worktree your session is in). Verify the commit command does **not** attempt to remove its own worktree.
- ⚠️ Fake fix: manifest is written but nothing reads it → orphans still leak.

**F8. `log.ndjson` tail contract documented**
- ✅ Pass: a numbered rule in `PRINCIPLES.md` or `implementation-rules.md` and a comment in the guard referencing that rule number.
- ⚠️ Fake fix: the regex is now a named constant but the doc doesn't exist — the hidden coupling (D6) remains.

---

#### Phase 3 — Terminology

**F9. Glossary exists and is referenced**
- ✅ Pass: `docs/glossary.md` (or equivalent) defines trunk, worktree, mint, prune, shipped, open. Commands link to it.
- ⚠️ Fake fix: glossary exists but error strings still say "close one by hand" / "Cap reached" / "main branch". Grep for those exact strings.

**F10. Normalised strings**
- Run these greps and confirm zero hits (or justified hits):
  - `close one by hand`
  - `Cap reached`
  - `restart opencode in` (followed by a harness path without "trunk worktree")
  - `main branch`, `main worktree` (should be `trunk worktree` or `trunk`)
  - `mint the ID` vs `create the ID` — pick one verb per concept.

---

#### Phase 4 — Traps

**F11. `wrongTree` argument parsing**
- ✅ Pass: uses a parser that skips flags; a spec‑id‑shaped token is found even with `--amend` / `-m msg` before it.
- ⚠️ Fake fix: `firstArgument` renamed to `firstSpecLikeArgument` but still returns token[0] if no match — verify the fallback.
- Test case to run manually: `lpwr-commit --amend auth-014` → should still detect the correct worktree.

**F12. `mergeBlockingFiles` configurable**
- ✅ Pass: tail‑allowed files come from the spec's declared journal path, not a hardcoded regex.
- ⚠️ Fake fix: regex moved to a constant at top of file — still hardcoded, still a hidden coupling.

**F13. `provision` verifies link targets**
- ✅ Pass: `fs.existsSync(target)` (or `fs.access`) is checked before `symlink`. Missing targets produce a warning and appear in the sidebar gap list.
- ⚠️ Fake fix: check is done with `try { symlink } catch { warn }` — that still leaves a broken symlink on some filesystems (the symlink may be created pointing to a nonexistent target). You need an explicit pre‑check.

**F14. `lpwr-worktree-status` command exists**
- ✅ Pass: registered, and its output matches the guide's worktree section (ideally by calling the same service function — otherwise D5 reappears).
- ⚠️ Fake fix: the command shells out to `git worktree list` and re‑implements status.

---

#### Phase 5 — Docs & Tests

**F15. `AGENTS.md` / `PRINCIPLES.md` updated**
- Look for a "Worktree Lifecycle" section describing: mint → work → commit → prune, the cap, and the manual recovery path.

**F16. Unit tests for the service**
- `listWorktrees`, `findWorktree`, `pruneShipped`, `capBlocked`, and the argument parser. Confirm they mock git output rather than hitting a real repo.

**F17. Integration test for mint–commit–prune**
- Runs against a temp git repo; asserts no orphan worktrees after prune. This is the single best regression guard against W7/D2.

---

### Common cross‑cutting regressions to check when you paste the code

1. **Circular imports** — if `lib/worktree.ts` imports from the guard and the guard imports from the service, you'll get load‑order bugs. Check the dependency direction: service → guard, never the reverse.
2. **Two sources of truth for "shipped"** — `pruneShipped` and `guideStatus` must call the same `isShipped(state)` helper. If either parses `state.md` independently, D5 is back.
3. **Cap read timing** — if `CAP` is read at module load, changing it in `opencode.json` mid‑session won't take effect. Decide and document.
4. **The new prune command's failure mode** — if it fails halfway through a multi‑worktree prune, is it idempotent? Can it resume?
5. **Backwards compatibility** — existing users may have worktrees created by the old hook with no manifest entry. Does `lpwr-worktree-prune` still find them? If not, document a migration.
6. **`.env` fallback** — W5 was a warning buried in `logWarn`. Confirm the new version surfaces it visibly (TUI notice, not just a log line) or removes the fallback entirely.

---

# Round 9 — audit-trail consolidation + consistency gates (post-1.4.6)

Three buildable items from `loopwright-resolution-plan.md` (A, B, C), closed in
one pass: the audit trail folded into a single file, the two prose documents
that describe delegation bound to one structured source, and the security scan
given a second input to the human's tier judgment. `npm run lint`,
`npm run typecheck`, and `npm test` (57 → 68) all green. The plan's D, E, and F
items each need a product decision first and were deliberately not started.

## Round 9 findings

| ID | Finding | Evidence | Status |
|----|---------|----------|--------|
| S9-01 | S7-03's own fix compounded: reconstructing `fixes.md` at the root left four standalone audit documents sitting beside the `integration-analysis.md` that README calls "the single audit trail" — `fixes.md`, `analysis.md`, `verification.md`, `loopwright-1.4.4-review.md` — each cited from code or from each other, so the audit had four parallel homes and no rule against a fifth | root listing; citations in `lib/worktree.ts` (×10), `plugins/lpwr-worktree-guard.ts`, `plugins/lpwr-spec-link.ts`, `lib/shared.ts`, `test/worktree.test.ts`, `test/worktree-integration.test.ts`; this file's Round 7 companion note | **Fixed** — `fixes.md` + `loopwright-1.4.4-review.md` folded as Round 7 sections, `analysis.md` + `verification.md` as Round 8 sections (provenance noted under each heading; the Round 7 intro, companion note, and Round 8 open item T6 rewritten to point at the folded sections). Every live citation rewritten to name a round; no `*.ts` / `*.mjs` / `*.sh` reference to the four names remains. The files are deleted (`git rm`), and `CONTRIBUTING.md` (new, named in README's layout and `context.md`'s repo-root list) carries the one rule: audit findings from any review or simulation pass go into `integration-analysis.md` as the next round, never a new file. `loopwright.sh`'s doctor guard keeps checking `integration-analysis.md`, which still exists. |
| S9-02 | S7-02 fixed one symptom (`builder.md` claimed Verify) with no mechanism behind it: delegation is described in two prose places — each agent's `description:` line and `orchestrator.md`'s Responsibilities section — no command names an agent, and nothing checked either against the `Stage:` lines the command surface actually declares | `agents/*.md` description lines; `orchestrator.md:18-23`; 27 `Stage:` lines across `commands/*.md` | **Fixed** — new `lib/agent-stages.ts` holds `STAGES` (the 8 distinct `Stage:` values) and `AGENT_STAGES` (builder, planner, reviewer, scribe), and `test/agent-stages.test.ts` (7 fixtures) asserts that each mapped description's stage set equals its entry, that every unmapped agent names no stage, that orchestrator's Responsibilities names every mapped agent, and that `STAGES` equals the distinct `Stage:` lines. The map is deliberately partial — the triage seats and `scout` describe their role by function and `orchestrator` names no stage — so the "unmapped ⇒ names no stage" fixture is what keeps that partiality honest instead of aspirational. |
| S9-03 | `risk_tier` is set once, by a human, at `lpwr-specs` time and re-confirmed at review, but `lpwr-security-scan` ran on every spec regardless of tier and never fed anything back — a spec mislabeled `low` that went on to add network, permission, or process code got exactly the same signal as any other `low` spec (plan Weakness 4 / Opportunity 5) | `templates/spec.md:4`; `lpwr-security-scan.ts` before this round (secret scan + dependency audit only); `templates/review.md:24` — the Security-axis box "Risk tier still looks correct given the actual diff" | **Fixed** — `ESCALATION_SIGNALS` + `checkTierMismatch` live in `gates.ts` (pure predicates, so `gates.test.ts` exercises them directly: each of the three signals fires for a non-high tier, `high` short-circuits, a signal-free diff says nothing, and repeated calls on one diff return the same answer — the last one guards against an accidental `g` flag). `lpwr-security-scan` calls it from `command.execute.before` on `lpwr-review`, where `git diff HEAD` is the change under review and the checkbox has not been ticked yet, and surfaces it as a toast + `logWarn` naming the reason and that checkbox. Advisory only: it never edits the tier, because AGENTS rule 11 keeps the human authoritative — this is a second, independent input to a confirmation they were already asked to make. |

### Deliberate deviations from the plan's snippets

- `checkTierMismatch` sits in `lib/gates.ts`, not in the plugin. `test/plugin-shape.test.ts`
  (S6-01) requires every plugin module to default-export exactly one function, so a second
  export from `lpwr-security-scan.ts` would throw "Plugin export is not a function" on startup —
  the same failure that moved the shared helpers to `lib/` in Round 6.
- The check runs at `lpwr-review`, not at implement time. The plan says the signal lands as a
  `review.md` note, and at `lpwr-implement` the working-tree diff is empty; review is the moment
  the diff exists and the tier is about to be re-confirmed. Only added lines are fed to the
  patterns, so a URL already in the tree is context rather than a new network call.

## Round 9 open items (carry forward)

- **D (command surface complexity)** — no decision taken. The plan recommends documenting a
  "core" ~12 vs "extended" ~15 split first, since it targets the felt size of the workflow
  without touching tested code; the alternatives are leaving the 27/9/12/16 surface as is, or
  merging near-duplicate commands (behaviour-change risk in a well-tested system).
- **E (visual/UX proposal variant)** — blocked on what counts as the verdict for a visual
  proposal: an informal human pick from an image, or the structured `question`-tool confirmation
  Verify uses for code. That choice decides whether it is a small `lpwr-propose`/`lpwr-motion`
  extension or a new artifact-type integration.
- **F (metrics roll-up)** — blocked on a consumer. Rework rate, time-to-verdict, and
  patches-per-file are derivable from the traceability ID plus existing `log.ndjson`/`state.md`
  with no new instrumentation, but "derivable" is not "worth a command".
- **Carried from Round 8** — T6 (`harness/.env` load path / dotenv scope, needs an opencode-side
  answer), F12's stricter form, and the optional tracked-doc staleness advisory.

## Round 9 status

- [x] A — fold four documents into Rounds 7/8, rewrite citations, delete them, add the
  recurrence rule to a new root `CONTRIBUTING.md`
- [x] B — `lib/agent-stages.ts` + `test/agent-stages.test.ts`, 57 → 64 tests
- [x] C — tier-escalation signal in `gates.ts` + `lpwr-security-scan`, 64 → 68 tests
- [ ] D / E / F — waiting on a decision

Lint, typecheck, and tests gated green after each of A, B, and C, committed directly on the
default branch out of process per implementation-rules 4 (this repo has never run its own spec
flow), as Round 8 recorded.

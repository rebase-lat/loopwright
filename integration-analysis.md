# Integration Analysis — workflow phase cross-wiring

Ongoing audit of how harness phases (domains) feed each other: what artifacts exist, what claims an integration, and whether the wiring is mechanical, prose-only, or missing. One domain per pass, in stage order.

Repo-level history: this is development material for this repository, not harness boilerplate — `harness/` ships without it, and no command, plugin, skill, or template reads it.

Status legend: **Wired** (command/template/plugin enforces it) · **Prose** (stated, not enforced) · **Gap** (claimed or needed, absent) · **Ephemeral** (output has no durable home).

Last updated: 2026-09-25 — Round 3 (1.3.0 mechanism consistency) added and landed; Round 1 plan shipped in `e404877`–`c07af04`, Round 2 in `afedc61`/`94d4571`.

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


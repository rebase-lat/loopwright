# Team conventions

Enforced by harness pieces where mechanical, by agreement where human.

- **Worktrees per spec ID**, not per person — `lpwr-scope-guard.ts` reads `OPENCODE_SPEC_ID` from the worktree's environment.
- **Config precedence**: repo `.opencode/` is authoritative for output quality; personal `~/.config/opencode/` holds only ergonomics.
- **Permissions single source**: the matrix lives in `opencode.json`; agent `.md` files carry role prompts only and must not duplicate `permission` blocks.
- **Scribe authors, build implements**: authoring commands run on `scribe` (`edit: ask`, human confirms each write); `build` stays the only `allow`-writer. Scribe and reviewer also hold ask-level `bash` (and scribe ask-level `webfetch`) so review/goal can read git history, research can reach primary sources, and onboard can list MCP servers — every call still human-approved.
- **Only orchestrators spawn**: leaf subagents carry `task: deny`; only `plan` (triage/scout fan-out) and `build` (scout delegation) may invoke subagents.
- **Blocked entries are human escalations**: `lpwr-commit` is the only agent writer of `docs/state.md`, and it never files `Blocked` — a human adds an entry there to escalate; `lpwr-spec-link` and `lpwr-verdict-gate` refuse the spec until it is removed.
- **Toasts inform, logs record**: gate blockages and trap crossings raise best-effort TUI toasts; the thrown error and `log.ndjson` remain the record of what happened.
- **Gates can't see who acts**: tool hooks carry no agent identity, so frontmatter fields (`status`, verdict) can't be origin-restricted by plugin. They rely on scribe ask-checkpoints plus re-validation at commit/release instead — forging a ship means fabricating the full evidence chain a human re-reads, not flipping one field unnoticed.
- **Risk tier is a human call, the scan is not**: tiers are set at specs and re-confirmed at review; the secret/dependency scan runs on every spec regardless of tier.
- **Exact once, plain once**: state exact things exactly; explain plainly, once, then move on. Firing messages name what happened and what to do — never restate the concept behind the gate.
- **One voice**: every agent writes per skill `lpwr-voice` — outcome first, flat register, no filler. Severity language is reserved for actual severity.
- **Models unset by default**: all agents inherit the runtime default until the team pins providers in `opencode.json` (decision 2026-09-19).
- **Permission matrix enumerates known tools**: `edit`, `bash`, `webfetch`, `task` are pinned per agent; any tool opencode adds later defaults to allow for everyone until the matrix names it — re-read `opencode.json` after opencode upgrades.
- **Diagnose never patches**: `lpwr-diagnose` produces the repro, ranked hypotheses, and fix plan; the patch itself runs through `lpwr-implement` against an approved spec (grounding a new spec from the diagnosis via `lpwr-propose` when none fits).
- **Harness changes reviewed like code** — a new skill or amended instruction goes through `lpwr-propose` → `lpwr-review`, same as any spec.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is binding rather than the orchestration tax being real.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

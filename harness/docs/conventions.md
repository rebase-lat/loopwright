# Team conventions

Enforced by harness pieces where mechanical, by agreement where human.
Protocol rules (spec ID, handoffs, verdict, voice, exact-once, risk tier): `AGENTS.md` rules 1, 7–12.

- **Worktrees per spec ID**, not per person — `lpwr-scope-guard.ts` reads `OPENCODE_SPEC_ID` from the worktree's environment.
- **Config precedence**: repo `.opencode/` is authoritative for output quality; personal `~/.config/opencode/` holds only ergonomics.
- **Permissions single source**: the matrix lives in `opencode.json`; agent `.md` files carry role prompts only and must not duplicate `permission` blocks.
- **Scribe authors, builder implements**: authoring commands run on `scribe` (`edit: ask`); `builder` stays the only `allow`-writer. Scribe and reviewer hold ask-level `bash` (scribe also ask-level `webfetch`) so git history, primary sources, and MCP listings stay human-approved — rationale per agent in `opencode.json`.
- **Only orchestrators spawn**: leaf subagents carry `task: deny`; only `planner` (triage/scout) and `builder` (scout) may invoke subagents.
- **Permission denials are logged**: `lpwr-audit-denials` writes `[permission-denied] …` via `client.app.log` (service `lpwr-audit-denials`) — advisory only, never overrides the decision; no toast (denials can spam).
- **Blocked entries are human escalations**: `lpwr-commit` never files `Blocked` in `docs/state.md` — a human escalates there; `lpwr-spec-link` and `lpwr-verdict-gate` refuse until it is removed.
- **Toasts inform, logs record**: gate blockages raise best-effort TUI toasts; advisories go through `logWarn` (`client.app.log`) — never raw `console.*`; the thrown error and `log.ndjson` remain the record.
- **Gates can't see who acts**: tool hooks carry no agent identity — frontmatter fields rely on scribe ask-checkpoints plus re-validation at commit/release.
- **Models unset by default**: agents inherit the runtime default until the team pins providers in `opencode.json` (decision 2026-09-19).
- **Permission matrix enumerates known tools**: any tool opencode adds later defaults to allow until the matrix names it — re-read `opencode.json` after upgrades.
- **MCP tools default deny**: global `mcp_*` is `deny`; `lpwr-setup` step 4 evaluates enabled servers and reports phase-slot suggestions (report-only — setup never patches `opencode.json`). Grant `allow` only on the agent whose phase needs the server.
- **Harness changes reviewed like code** — a new skill or amended instruction goes through `lpwr-propose` → `lpwr-review`.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is binding.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

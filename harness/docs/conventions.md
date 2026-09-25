# Team conventions

Enforced by harness pieces where mechanical, by agreement where human.
Protocol rules (spec ID, handoffs, verdict, voice, exact-once, risk tier): `AGENTS.md` rules 1, 3, 7–12.

- **Worktrees per spec ID**, not per person — `lpwr-scope-guard.ts` resolves the spec ID from the worktree's branch (the ID *is* the branch name, rule 2); `OPENCODE_SPEC_ID` in the worktree's `.env` is belt-and-braces, written by the guard at creation.
- **Mint from trunk, work in the worktree**: `lpwr-propose` / `lpwr-explore` run only on trunk (guard-enforced); the first journal handoff creates `../<id>` and the human restarts opencode there — work-stage commands are blocked outside their spec's worktree.
- **Shared foundation, per-spec branches**: `docs/{state,context,constitution,audit}.md` are trunk-owned, gitignored, and symlinked into every worktree — one physical copy, `lpwr-commit` the sole state writer (rule 49); `lpwr-tasks` flags declared-surface overlap across in-flight worktrees (rule 50).
- **Config precedence**: repo `.opencode/` is authoritative for output quality; personal `~/.config/opencode/` holds only ergonomics.
- **Permissions single source**: the matrix lives in `opencode.json`; agent `.md` files carry role prompts only and must not duplicate `permission` blocks.
- **Every command runs on the orchestrator**: all commands pin `agent: orchestrator` and it is the only selectable primary — no other agent is Tab-reachable and no command session lands on a worker (decision 2026-09-24); a direct @-mention can still open one, governed by its permission block. Doer steps are delegated via Task; `scribe` still authors (`edit: ask` in its spawned session) and `builder` stays the only `allow`-writer. Scribe and reviewer hold ask-level `bash` (scribe also ask-level `webfetch`) so git history, primary sources, and MCP listings stay human-approved — rationale per agent in `opencode.json`.
- **Only the orchestrator spawns**: every other agent — `builder` and `planner` included — carries `task: deny`, and its spawn targets exclude builtin `general` (unrestricted writes would bypass ask-checkpoints); a worker that needs a subagent reports the recommendation to the orchestrator, which decides whether to spawn (single-orchestrator model, 2026-09-24). **Subagents always return output**: even when blocked or needing something, a worker ends with what it did, what it needs, and pointers — the orchestrator acknowledges the need, delegates it, and resumes the worker until completion.
- **Permission denials are logged**: `lpwr-audit-denials` writes `[permission-denied] …` via `client.app.log` (service `lpwr-audit-denials`) — advisory only, never overrides the decision; no toast (denials can spam).
- **Blocked entries are human escalations**: `lpwr-commit` never files `Blocked` in `docs/state.md` — a human escalates there; `lpwr-spec-link` and `lpwr-verdict-gate` refuse until it is removed.
- **Toasts inform, logs record**: gate blockages raise best-effort TUI toasts; advisories go through `logWarn` (`client.app.log`) — never raw `console.*`; the thrown error and `log.ndjson` remain the record.
- **Gates can't see who acts**: tool hooks carry no agent identity — frontmatter fields rely on scribe ask-checkpoints plus re-validation at commit/release.
- **Models unset by default**: agents inherit the runtime default until the team pins providers in `opencode.json` (decision 2026-09-19).
- **Permission matrix enumerates known tools**: any tool opencode adds later defaults to allow until the matrix names it — re-read `opencode.json` after upgrades.
- **MCP tools default deny**: global `mcp_*` is `deny`; `lpwr-setup` step 4 evaluates enabled servers and reports phase-slot suggestions (report-only — setup never patches `opencode.json`). Grant `allow` only on the agent whose phase needs the server.
- **Harness changes reviewed like code** — a new skill or amended instruction goes through `lpwr-propose` → `lpwr-review`.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is binding; shipped + clean worktrees prune themselves at the next `lpwr-propose`, before the cap check.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

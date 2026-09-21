# Team conventions

Enforced by harness pieces where mechanical, by agreement where human.

- **Worktrees per spec ID**, not per person — `lpwr-scope-guard.ts` reads `OPENCODE_SPEC_ID` from the worktree's environment.
- **Config precedence**: repo `.opencode/` is authoritative for output quality; personal `~/.config/opencode/` holds only ergonomics.
- **Permissions single source**: the matrix lives in `opencode.json`; agent `.md` files carry role prompts only and must not duplicate `permission` blocks.
- **Scribe authors, build implements**: authoring commands run on `scribe` (`edit: ask`, human confirms each write); `build` stays the only `allow`-writer and the only shell.
- **Only orchestrators spawn**: leaf subagents carry `task: deny`; only `plan` (triage/scout fan-out) and `build` (scout delegation) may invoke subagents.
- **Toasts inform, logs record**: gate blockages and trap crossings raise best-effort TUI toasts; the thrown error and `log.ndjson` remain the record of what happened.
- **Exact once, plain once**: state exact things exactly; explain plainly, once, then move on. Firing messages name what happened and what to do — never restate the concept behind the gate.
- **Models unset by default**: all agents inherit the runtime default until the team pins providers in `opencode.json` (decision 2026-09-19).
- **Harness changes reviewed like code** — a new skill or amended instruction goes through `lpwr-propose` → `lpwr-review`, same as any spec.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is binding rather than the orchestration tax being real.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

# Team conventions

Enforced by harness pieces where mechanical, by agreement where human.

- **Worktrees per spec ID**, not per person — `lpwr-scope-guard.ts` reads `OPENCODE_SPEC_ID` from the worktree's environment.
- **Config precedence**: repo `harness/.opencode/` is authoritative for output quality; personal `~/.config/opencode/` holds only ergonomics.
- **Permissions single source**: the matrix lives in `harness/opencode.json`; agent `.md` files carry role prompts only and must not duplicate `permission` blocks.
- **Models unset by default**: all agents inherit the runtime default until the team pins providers in `opencode.json` (decision 2026-09-19).
- **Harness changes reviewed like code** — a new skill or amended instruction goes through `/propose` → `/review`, same as any spec.
- **Concurrent worktrees per person capped at 2**, raised only if the team reports the cap is binding rather than the orchestration tax being real.
- **Inline completion off by default** — the interruption-trap countermeasure, team-wide.

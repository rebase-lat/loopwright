---
description: Bootstrap the dev environment — install deps, check env and runtime. Idempotent.
---

Stage: Bootstrap.

Prepare this machine (or fresh clone) so every other `lpwr-*` command works reliably. This command configures a machine, not a project: it writes nothing under `docs/` and takes no spec ID (rule 33).

1. Install project dependencies via the package manager the repo manifest declares (`package.json` → npm install; run from the repo root). Verify the lockfile matches the manager (`package-lock.json`→npm, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `bun.lock`→bun) — a mismatch fails naming the expected manager.
2. Check required environment variables for the repo's integrations. Prompt for missing secrets — never write secrets to a tracked file.
3. Verify the runtime: node 20+ (`node --version`), the package manager binary, the `opencode` binary, and plugin load (`opencode agent list` from the project root must exit 0 and list the harness agents).
4. Verify configured MCP servers: list them (`opencode mcp list`), and for each local server check its command binary exists, for each remote server check its required env vars are set (prompt for missing secrets — never write them to a tracked file). A project with no MCP servers skips this step with a confirmation.
5. If the repo signals container need (`Dockerfile`, `compose.yaml`/`compose.yml`/`docker-compose.yml`, `docker/` dir), verify docker is present (`docker --version`) and the daemon answers (`docker info`). No signals → skip with a confirmation.
6. Verify each `Audit command:` binary declared in `docs/constitution.md` resolves on PATH — a missing audit tool fails naming the binary.
7. Report each check plainly: name the specific missing binary, package, variable, server, or daemon — never a generic error. If `docs/context.md` or `docs/constitution.md` are missing, point at `lpwr-install` next.

Idempotent: running twice on a configured machine is a no-op with a confirmation, not an error.

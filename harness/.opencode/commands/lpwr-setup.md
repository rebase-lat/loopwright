---
description: Bootstrap the dev environment — deps, env, runtime, tool surface + MCP. Idempotent.
agent: builder
---

Stage: Bootstrap.

Prepare this machine (or fresh clone) so every other `lpwr-*` command works reliably. This command configures a machine, not a project: it writes nothing under `docs/` and takes no spec ID (rule 33).

Seed `todowrite` with the seven steps below; check each off as it completes (or is confirmed skipped).

1. Install project dependencies via the package manager the repo manifest declares (`package.json` → npm install; run from the repo root). Verify the lockfile matches the manager (`package-lock.json`→npm, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `bun.lock`→bun) — a mismatch fails naming the expected manager. If `.opencode/package.json` exists (the harness plugin manifest — plugins import `@opencode-ai/plugin` at load), install it too, from `.opencode/`, matching its lockfile.
2. Check required environment variables for the repo's integrations. Prompt for missing secrets — never write secrets to a tracked file. Document-only flags, when present: note whether `OPENCODE_ENABLE_EXA`/`OPENCODE_ENABLE_PARALLEL` (websearch) and `OPENCODE_EXPERIMENTAL_LSP_TOOL` (lsp) are set — unset is fine; do not flip them here.
3. Verify the runtime: node 20+ (`node --version`), the package manager binary, the `opencode` binary, and plugin load (`opencode agent list` from the project root must exit 0 and list the harness agents).
4. Evaluate the tool surface and MCP servers (report-only — never patches `opencode.json`):
   - Diff against the Stack section of `docs/context.md` when present (both directions): every MCP server, external binary, and system tool recorded there but not found on this machine, and every one found here but unrecorded there. Missing `docs/context.md` → skip this sub-step with a confirmation. The Stack section is the inventory this step verifies against.
   - List MCP servers (`opencode mcp list`); for each local server check its command binary exists, for each remote server check its required env vars are set (prompt for missing secrets — never write them to a tracked file). A project with no MCP servers continues with a confirmation.
   - Read `opencode.json`: name every builtin permission key present per agent, and flag any known builtin (`read`, `edit`, `glob`, `grep`, `bash`, `task`, `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, `doom_loop`) missing from an agent block — rule 48 gap (omitted tools default allow).
   - For each enabled MCP server, report which agents would inherit its tools under current permissions (`mcp_*` defaults deny; any allow is an intentional grant). Emit copy-pasteable suggested keys only, e.g. `"context7_*": "deny"` globally plus an agent-level allow for the phase that needs it — human applies them. Append the same block to `docs/audit.md` as a `setup-suggestion` entry (status: open) so the suggestions survive this session; mark applied only after the human confirms the edit.
5. If the repo signals container need (`Dockerfile`, `compose.yaml`/`compose.yml`/`docker-compose.yml`, `docker/` dir), verify docker is present (`docker --version`) and the daemon answers (`docker info`). No signals → skip with a confirmation.
6. Verify each `Audit command:` binary declared in `docs/constitution.md` resolves on PATH — a missing audit tool fails naming the binary.
7. Report each check plainly: name the specific missing binary, package, variable, server, or daemon — never a generic error. Missing foundation files are also warned at startup by `lpwr-check-setup`. If `docs/context.md` or `docs/constitution.md` are missing, point at `lpwr-install` next — and say to re-run `lpwr-setup` after `lpwr-onboard`, because step 6 can only verify `Audit command:` binaries once the constitution declares them.

Idempotent: running twice on a configured machine is a no-op with a confirmation, not an error.

Machine-level output — unkeyed: no `journal_handoff` (never writes under `docs/`).

Output: inline environment + tool-surface check report (including suggested MCP permission snippets); writes nothing under docs/.

Next: lpwr-install (if docs/ foundation missing).

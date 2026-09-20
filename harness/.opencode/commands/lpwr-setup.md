---
description: Bootstrap the dev environment — install deps, check env and runtime. Idempotent.
---

Stage: Bootstrap.

Prepare this machine (or fresh clone) so every other `lpwr-*` command works reliably. This command configures a machine, not a project: it writes nothing under `docs/` and takes no spec ID (rule 33).

1. Install project dependencies via the package manager the repo manifest declares (`package.json` → npm install; run from the repo root).
2. Check required environment variables for the repo's integrations. Prompt for missing secrets — never write secrets to a tracked file.
3. Verify the runtime: node 20+ (`node --version`), the package manager binary, the `opencode` binary, and plugin load (`opencode agent list` from `harness/` must exit 0 and list the harness agents).
4. Report each check plainly: name the specific missing binary, package, or variable — never a generic error.

Idempotent: running twice on a configured machine is a no-op with a confirmation, not an error.

# Audit log

Project-level append-only trail — **not** the per-spec security audit (`docs/specs/<id>/audit.md`, written by `lpwr-security-scan`). Newest entries last. Never rewrite history: mark entries consumed or applied in place.

Entry shape:

```
## <date> — <kind>
<kind: setup-suggestion | improve-candidate | release-ref>
<payload: copy-pasteable block, candidate entry, or `<spec-id>` + release reference>
- status: open | consumed | applied
```

- `setup-suggestion` — MCP/tool-surface permission keys emitted by `lpwr-setup`; human applies to `opencode.json`, then mark applied.
- `improve-candidate` — durable mirror of an `lpwr-improve` candidate; `lpwr-commit` reconciles unconsumed ones into `state.md` Next; `lpwr-guide` surfaces them when nothing is in flight.
- `release-ref` — `<spec-id>` + deployed URL/tag written by `lpwr-release`; the next `lpwr-commit` for that ID folds it into `state.md` Done.

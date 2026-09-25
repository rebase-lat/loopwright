---
spec_ref: <domain>-<sequence>
---

# Per-spec security audit trail

Appended by `lpwr-security-scan` at `lpwr-implement` — one section per audit run,
newest last — and reviewed at `lpwr-review`'s Security axis. This is the
**per-spec security trace**, not the project trail (`docs/audit.md`). Findings
warn and trace; they never block implement.

Section shape:

```
## <ISO timestamp>
command: <audit command run>
result: clean | findings (exit <code>)
```
<bounded tool output tail, ~4000 chars>
```
```

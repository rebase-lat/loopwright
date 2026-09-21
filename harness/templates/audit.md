# Audit: <domain>-<sequence>

Per-run dependency audit trace, appended by `lpwr-security-scan`. One section
per run, newest last. Reviewed at `lpwr-review` time via the Security axis.
The file opens with frontmatter carrying the owning spec (written once by the
plugin on creation):

```markdown
---
spec_ref: <domain>-<sequence>
---
```

## <ISO timestamp>
- command: <audit command run>
- result: clean | findings (exit <code>)
```<bounded tool output tail>
<excerpt>
```

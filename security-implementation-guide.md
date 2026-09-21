# Loopwright — Security Implementation Guide

Security is a cross-cutting layer, not a seventh domain — it extends four existing pieces and
adds one conditional command that only fires when a spec's risk actually warrants it. The design
goal is proportional cost: a doc fix pays nothing extra, a change touching auth or secrets pays
for a real review.

---

## 1. Constitution — security floors

Add a section to `docs/constitution.md`, same ubiquitous-EARS pattern as any other non-functional
rule. This is the baseline every spec inherits with zero extra process:

```markdown
## Security floors
- The system shall never log credentials, tokens, or secrets in plaintext.
- The system shall reject any request without authentication on <protected surfaces>.
- The system shall not commit secrets, keys, or credentials to version control.
- Dependencies shall carry no known critical or high-severity vulnerability at release time.
```

---

## 2. `spec.md` — the `risk_tier` field

Added to `spec.md`'s frontmatter at `lpwr-specs` time:

```markdown
---
id: <domain>-<sequence>
status: draft
risk_tier: low   # low | medium | high — human-confirmed, heuristic can suggest it
---
```

A heuristic may flag `medium` or higher when the spec touches auth, secrets, permissions, or
external network calls — but a human confirms the tier. This field is what makes everything
downstream proportional instead of applying the same weight to every spec.

---

## 3. Always-on mechanical scan — `lpwr-security-scan.ts`

Runs during Execute, on every spec regardless of tier. Checks for committed secrets and known
vulnerable dependencies, using whatever audit tool matches the stack recorded in `context.md`.

```typescript
import type { Plugin } from "@opencode-ai/plugin";
import { execSync } from "node:child_process";

export const SecurityScan: Plugin = async () => {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit" && input.tool !== "write") return;

      // 1. Secret pattern check on the touched file
      const flagged = scanForSecretPatterns(output.args.filePath);
      if (flagged.length > 0) {
        throw new Error(
          `Blocked: possible secret detected in ${output.args.filePath} ` +
          `(pattern: ${flagged[0].pattern}). Remove it before continuing.`
        );
      }
    },
    "command.execute.before": async (input, output) => {
      if (output.command !== "lpwr-implement") return;

      // 2. Dependency audit, tool chosen from docs/context.md's stack section
      const auditTool = resolveAuditToolFromContext(); // e.g. "npm audit", "pip-audit"
      try {
        execSync(`${auditTool} --audit-level=high`, { stdio: "pipe" });
      } catch {
        throw new Error(
          `Blocked: ${auditTool} found a high or critical severity vulnerability. ` +
          `Resolve before implementing.`
        );
      }
    },
  };
};

function scanForSecretPatterns(filePath: string): { pattern: string }[] {
  // AWS keys, private key headers, common token formats, etc. — placeholder
  return [];
}

function resolveAuditToolFromContext(): string {
  return "npm audit"; // read from docs/context.md's stack section in practice
}
```

This is the cheap floor: zero overhead for a `low`-tier doc fix, but nothing ships with a
hardcoded key or a known-critical dependency, regardless of tier.

---

## 4. `review.md` — third axis: Security

Extend the existing review template with one more section, alongside Standards and Specs. For
`low`/`medium` tier this is lightweight — confirming the automated scan passed and the
constitution's floors are met. `high` tier additionally requires the threat review (§5) to exist.

```markdown
---
id: <domain>-<sequence>
diff_ref: HEAD~<n>..HEAD
risk_tier: low   # carried over from spec.md
---

# Review: <title>

## Standards axis
- [ ] Passes linter / formatter / CI gate named in constitution.md
- Notes: <deviations, if any, and why>

## Specs axis
| Criterion ID | Test reference | Pass? |
| --- | --- | --- |
| <id>-1 | <test> | yes/no |

## Security axis
- [ ] `lpwr-security-scan` passed (no secrets, no high/critical dependency findings)
- [ ] Constitution's security floors are met
- [ ] Risk tier still looks correct given the actual diff (re-confirm even for low/medium)
- [ ] If risk_tier is high: threat-review.md exists and its findings are addressed
- Notes: <anything downgraded, deferred, or accepted as residual risk, and why>

## Verdict
- [ ] Ship  [ ] Block  [ ] Redirect
- Reasoning: <why the evidence above is or isn't enough>
```

The "risk tier still looks correct" checkbox is deliberate: it's the second line of defense
against a spec mislabeled `low` that should have triggered a threat review — cheap to check, and
it doesn't rely solely on whoever set the tier at `lpwr-specs` time getting it right.

---

## 5. `lpwr-threat-review` — conditional command, `high` tier only

Required only when `spec.md`'s `risk_tier` is `high`. `lpwr-release` refuses to deploy a
`high`-tier spec without this artifact present, the same way it already refuses to deploy without
a recorded "ship" verdict.

### `templates/threat-review.md`

```markdown
---
id: <domain>-<sequence>
spec_ref: docs/specs/<id>/spec.md
risk_tier: high
date: <date>
---

# Threat review: <title>

## What could go wrong
- <specific failure mode 1 — be concrete, not generic>
- <specific failure mode 2>

## Who could exploit it
- <actor: e.g. an unauthenticated external user, an insider with read access, a compromised dependency>

## Blast radius
- <what's exposed or affected if this goes wrong: data, systems, users, scope>

## Mitigations in this change
| Failure mode | Mitigation | Residual risk |
| --- | --- | --- |
| <mode 1> | <what the diff does about it> | <what's left unaddressed, and why that's acceptable> |

## Verdict
- [ ] Acceptable to proceed  [ ] Needs changes before proceeding
- Reasoning: <why the mitigations above are or aren't sufficient>
```

### `commands/lpwr-threat-review.md`

```markdown
---
agent: reviewer
---

Run only when @docs/specs/$SPEC_ID/spec.md has risk_tier: high.

Produce docs/specs/$SPEC_ID/threat-review.md using @templates/threat-review.md.
Be specific to this diff — generic failure modes ("SQL injection is possible")
without a concrete path through this change's actual code are not acceptable
entries. Append one line to log.ndjson with intent "verify" and payload
pointing to the threat-review file.
```

`lpwr-release`'s gate, updated:

```
release requires: verdict == "ship"
                   AND (risk_tier != "high" OR threat-review.md exists)
```

---

## 6. Retain — new failure bucket

Add a fifth bucket to the failure taxonomy: `security-gap`, alongside wrong-spec /
wrong-implementation / flaky-check / harness-defect. Tag `lesson.md`'s `failure_bucket` field
with it when applicable.

```markdown
---
spec_ref: <domain>-<sequence>
date: <date>
failure_bucket: security-gap
---
```

Three `security-gap` lessons about the same class of mistake is the signal that the fix belongs
in the constitution's security floors (§1), not in a fourth lesson file — `lpwr-improve` should
query lessons by bucket specifically to catch this pattern.

---

## 7. Summary of what's proportional to what

| Risk tier | Automated scan | Review security axis | Threat review required |
| --- | --- | --- | --- |
| `low` | Yes, always | Lightweight confirmation | No |
| `medium` | Yes, always | Lightweight confirmation | No |
| `high` | Yes, always | Full confirmation + threat-review check | Yes — gates `lpwr-release` |

The one open trade-off, unchanged from the design discussion: accuracy of `risk_tier` is
load-bearing. The re-confirmation checkbox in `review.md` is the mitigation built in here; it is
not a complete guarantee against under-tiering.

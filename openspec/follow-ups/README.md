# OpenSpec Follow-Up Inbox

This directory stores tracked follow-up candidates discovered during OpenSpec
implementation, verification, closure review, external review reconciliation, or
program-level matrix closure.

Follow-up files are not active OpenSpec proposals. They are durable prompts for
future proposals, small plans, or backlog decisions.

## When To Add A Follow-Up

Add or update a file here when:

- implementation diverged from the original design and needs later decision;
- verification revealed a real gap but it was outside the current change scope;
- a better design was discovered after the proposal was implemented;
- a real-gateway or environment circuit breaker needs later revisit;
- external review findings were accepted or deferred but not fixed immediately;
- multiple archived changes leave cross-change cleanup or governance work.

## Naming

Use one of these forms:

- `YYYY-MM-DD-<program>-follow-ups.md`
- `YYYY-MM-DD-<change>-follow-ups.md`
- `YYYY-MM-DD-<module>-follow-ups.md`

Prefer one file per program or related group rather than one file per tiny item.

## Entry Format

```markdown
## FU-001: <short title>

- **Status**: candidate | promoted | resolved | deferred | rejected
- **Source**: <change/review/design/file reference>
- **Classification**: next-openspec | small-plan | backlog | explicitly-deferred | must-fix-before-commit
- **Fact baseline**: <code truth, command evidence, or exact uncertainty>
- **Why not now**: <scope, risk, missing decision, environment blocker, etc.>
- **Suggested next step**: <proposal/change/plan prompt>
- **Acceptance hints**: <tests, validation, E2E, review evidence>
- **Links**: <related OpenSpec change, report, code path>
```

When a follow-up is promoted into a real OpenSpec change, update its status and
link the new change.

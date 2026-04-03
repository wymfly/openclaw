---
name: openspec-closure-workflow
description: Use when implementing, validating, or archiving an OpenSpec change that needs scenario-level closure tracking, verification.yaml maintenance, archive readiness checks, or when the user asks to run closure init, report, or check.
---

# OpenSpec Closure Workflow

Use the bundled closure companion to prove that an OpenSpec change has converged at the scenario level.

This workflow adds a closure pass between implementation and archive:

`propose -> plan -> apply -> closure report/check -> archive`

## When to Use

Use this skill when:

- an active OpenSpec change needs `verification.yaml`
- a plan already has human-readable `covers:` and now needs machine-checkable closure handling
- the user asks to initialize, report, or check closure state
- the user wants to know whether a change is actually ready to archive

## Core Inputs

The closure workflow joins four inputs:

1. spec scenarios with stable `scenario_id`
2. plan ownership via `covers.id`
3. `verification.yaml`
4. closure output with `archiveReady`, `gapCount`, and exact gaps

## Commands

Prefer project scripts when the project exposes them:

```bash
pnpm openspec:closure:init -- --change <change>
pnpm openspec:closure:report -- --change <change>
pnpm openspec:closure:check -- --change <change> --format json
```

If project-local wrapper scripts are missing, use the bundled plugin-local wrapper for the same lifecycle:

- `init`
- `report`
- `check`

## Workflow

1. Identify the target OpenSpec change.
2. Confirm `scenario_id`, `covers.id`, and project adapter state exist.
3. Initialize `verification.yaml` when needed.
4. Update verification state as implementation progresses.
5. Run `report` and `check` before archive.

Do not treat task completion alone as proof of closure.

## Integration Rule

Higher-level workflow skills may route into this skill, but they must not redefine closure rules themselves.

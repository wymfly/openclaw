---
summary: "Portable scenario-level closure checks for OpenSpec + superpowers projects"
read_when:
  - Adding closure checks to an OpenSpec workflow
  - Wiring archive readiness to scenario coverage and verification state
title: "OpenSpec Closure Companion"
---

# OpenSpec closure companion

The OpenSpec closure companion is a portable checker for projects that already use OpenSpec plus superpowers-style planning. It adds a scenario-level closure pass without patching upstream workflow files such as `.claude/commands/opsx/*` or global superpowers skills.

The companion treats a change as closed only when the same `scenario_id` can be followed across:

- spec inventory
- implementation-plan ownership
- verification state
- closure report output

## Portable contract

The protocol has four stable inputs:

- **Spec inventory:** each ADDED or MODIFIED scenario participating in implementation must expose a stable `scenario_id`
- **Plan ownership:** plans keep their human-readable `covers:` prose, but also add machine-readable ownership via `covers.id: <scenario_id>`
- **Verification artifact:** each change maintains `verification.yaml` keyed by `scenario_id`
- **Closure result:** the checker emits gap records plus `archiveReady`, so projects can use the result in CI, archive gates, or local review

Example plan fragment:

```md
### Task 2: Add the closure checker

**covers:** `closure-check/spec.md > ADDED > ... > "Missing plan mapping is reported as an open gap"`
covers.id: closure-check.missing-plan-mapping
```

Example verification artifact:

```yaml
changeName: openspec-closure-companion
generatedAt: "2026-04-03T00:00:00.000Z"
scenarios:
  - scenarioId: closure-check.missing-plan-mapping
    ownerTask: Add the closure checker
    verificationCommand: pnpm test -- test/scripts/openspec-closure.test.ts
    evidence:
      - test/scripts/openspec-closure.test.ts
    status: verified
```

## Thin project adapter

Projects integrate the companion through a small adapter file. The current reference implementation uses `.openspec-closure.yaml`:

```yaml
planGlobs:
  - docs/plans/*.md
blockingStatuses:
  - pending
  - blocked
  - spec-fix-required
verificationFileName: verification.yaml
```

The adapter only describes project-specific conventions:

- where plans live
- where verification artifacts should be written
- which statuses block archive readiness, including project policy for `deferred`

The adapter does not reimplement parsing or checker logic. That separation is what keeps the workflow portable across projects.

Projects that keep plans or verification state outside the defaults can point the companion at those locations through config alone. For example, a project can keep plans under `workflow/plans/*.md` and its verification artifact at `state/closure.yaml` without patching the checker itself.

## Commands

The reference CLI exposes three commands:

- `pnpm openspec:closure:init -- --change <change>` initializes `verification.yaml` from active scenarios
- `pnpm openspec:closure:check -- --change <change> --format json` emits machine-readable readiness output
- `pnpm openspec:closure:report -- --change <change>` emits a human-readable summary

The CLI also tolerates the same commands without the extra package-manager separator if a project prefers `pnpm openspec:closure:report --change <change>`.

Recommended lifecycle:

1. `propose`
2. `plan`
3. `apply`
4. `closure check`
5. `archive`

This keeps implementation progress and scenario closure separate: `tasks.md` tracks work execution, while the verification artifact and closure report track whether the change is actually ready to archive.

When a project intentionally postpones verification, mark the scenario with a status such as `deferred` and record a `rationale`. By default, `deferred` still blocks `archiveReady`; projects may only relax that policy through adapter configuration, not through undocumented prose.

## Adoption boundaries

When adopting the companion in another OpenSpec plus superpowers project:

- keep the upstream workflow files unchanged
- add stable `scenario_id` fields to active ADDED and MODIFIED scenarios
- extend plans with machine-readable `covers.id` ownership lines
- provide only a thin adapter file plus package-manager or CI entrypoints

The companion is intentionally neutral about whether a project uses a hard archive gate, a warning-only gate, or a CI-only readiness check. What it standardizes is the closure report and the meaning of `archiveReady`.

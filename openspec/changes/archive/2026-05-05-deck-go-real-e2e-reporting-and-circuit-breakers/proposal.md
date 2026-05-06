## Why

Real Gateway E2E now has an isolated seed and shared fixtures, but evidence shape is still partly ad hoc across helpers and specs. Downstream module proposals need a small standard for statuses, attempt counts, and bounded failure records so real E2E can keep moving without hiding environment blockers.

## What Changes

- Add shared real E2E evidence status and scenario evidence helpers.
- Enforce the bounded vocabulary: `passed`, `degraded`, `empty-valid`, `skipped-safe`, and `handoff-blocked`.
- Ensure scenario evidence records `scenarioId`, `runId`, `maxAttempts`, `attemptCount`, `status`, and optional reason/command fields.
- Apply the shared scenario evidence helper to the existing `cpa` + `main` seed path.
- Keep deterministic failures fixable in-place while environment/credential/network blockers are recorded as handoff evidence.
- Update the head matrix after validation so real E2E reporting is no longer deferred.

## Capabilities

### New Capabilities

- `deck-go-real-e2e-reporting-and-circuit-breakers`: Shared real E2E evidence statuses, bounded-attempt metadata, and handoff-friendly scenario evidence.

### Modified Capabilities

- None.

## Impact

- Affected areas: `deck-go/test/e2e/helpers.ts`, focused helper tests, head audit matrix artifacts, and this OpenSpec change.
- No production API, Gateway API, or frontend UI behavior changes are introduced.

## Why

The head contract-chain proposal already proved that an isolated `cpa` + `main` real Gateway seed can work, but the proposal matrix still tracks the seed as a deferred child change. The seed must become a repeatable, independently archived evidence lane so later module proposals can depend on it without re-interpreting head-change notes.

## What Changes

- Add a focused real E2E seed contract for running `cpa` + `main` through deck-go's normal BFF path.
- Persist redacted, machine-readable seed evidence outside the temporary isolated root when a caller provides an evidence output directory.
- Keep bounded attempts and `passed` / `degraded` / `empty-valid` / `handoff-blocked` status semantics for the seed and its supporting read probes.
- Add a stable command/target for the focused seed smoke.
- Update the head proposal matrix after validation so `deck-go-real-e2e-seed-and-evidence` is no longer deferred.

## Capabilities

### New Capabilities

- `deck-go-real-e2e-seed-and-evidence`: Repeatable isolated `cpa` + `main` seed execution and redacted machine-readable evidence for downstream real E2E module work.

### Modified Capabilities

- None.

## Impact

- Affected areas: `deck-go/test/e2e/helpers.ts`, `deck-go/test/e2e/real-gateway.spec.ts`, deck-go Makefile/scripts if needed, head audit matrix artifacts, and this OpenSpec change.
- No new Gateway APIs, production test routes, frontend dependencies, or operator-state mutations are introduced.

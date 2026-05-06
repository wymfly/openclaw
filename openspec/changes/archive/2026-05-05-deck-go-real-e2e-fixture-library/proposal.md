## Why

Several real Gateway specs already create disposable Deck-side resources, but each spec hand-rolls run-id names, cleanup, and safety checks. That makes later module proposals riskier because fixture cleanup guarantees are not centralized or consistently testable.

## What Changes

- Add a shared real E2E fixture helper layer for safe writable resources.
- Ensure disposable fixture cleanup asserts the current run id before deleting or reverting any resource.
- Migrate existing budget, alerts, and webhooks real specs from local fixture helpers to shared helpers.
- Keep unsafe or not-yet-proven fixture classes skipped-safe; do not force agents, cron, routing, or docs mutations until their contracts prove disposable cleanup.
- Update the head matrix after validation so downstream safe-mutation/module proposals can depend on this archived fixture library.

## Capabilities

### New Capabilities

- `deck-go-real-e2e-fixture-library`: Shared run-id-scoped fixture creation and cleanup helpers for safe real Gateway writable resources.

### Modified Capabilities

- None.

## Impact

- Affected areas: `deck-go/test/e2e/helpers.ts`, writable real specs that already create disposable resources, helper tests, head audit matrix artifacts, and this OpenSpec change.
- No production route, Gateway API, or frontend UI behavior changes are introduced.

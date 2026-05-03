## Why

Cron Jobs is an existing Automate panel with real Deck-facing wrappers for `cron.*` Gateway operations, but its UI still uses the legacy dense `deck-ui-cron` global shell and cannot be visually verified through the bundled mock Gateway because the mock fixture does not implement cron methods.

This change applies the contract-led high-fidelity workflow to Cron so scheduler inventory, job configuration, run history, heartbeat status, and manual run/delete actions converge around the current contract chain before the remaining Automate panels are rebuilt.

## What Changes

- Create a complete high-fidelity Cron handoff package under `deck-go/frontend-handoff/modules/cron/`.
- Redesign `deck-go/frontend-new/src/components/panels/cron/` into a compact scheduler workbench:
  - runtime scheduler status, job counts, enabled counts, and next execution evidence
  - job catalog with selected state, schedule summary, enabled/disabled status, and next run
  - create/edit form for name, schedule kind/value, session target, wake mode, payload kind/value, agent id, description, and enabled state
  - selected job detail with configuration payload, run history, heartbeat availability, and last action raw evidence
  - manual run, refresh, load selected, save selected, create, and guarded delete actions
- Preserve the current frontend API wrapper behavior for `fetchCronJobs`, `fetchCronStatus`, `fetchCronRuns`, `createCronJob`, `updateCronJob`, `runCronJob`, and `deleteCronJob`; browser code continues to call the Go BFF only.
- Add contract-shaped cron methods to the bundled mock Gateway so mock visual E2E can exercise the normal frontend API path.
- Move obsolete global `deck-ui-cron*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering ready scheduler workbench and meaningful interaction states such as run history, heartbeat tab, form template selection, and manual run result.
- Update cross-module readiness evidence with Cron-specific findings and scheduler/job/form/history molecule candidates.

## Capabilities

### New Capabilities

- `frontend-cron-hifi-redesign`: Covers the Cron handoff package, production UI rewrite, contract-shaped mock cron fixture support, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Cron implementation evidence and classifies whether scheduler status tiles, job catalog rows, job form sections, run history rows, heartbeat detail, and last-action raw payload molecules remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/cron/`
- `deck-go/frontend-new/src/components/panels/cron/`
- `deck-go/frontend-new/src/theme.css` Cron global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` for contract-shaped `cron.*` fixture data
- `deck-go/test/e2e/` focused Cron mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-cron-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

## Why

Webhooks is an existing Automate panel with real Deck-facing routes for webhook inventory, delivery history, test delivery, create/update, and delete, but the UI still uses the legacy dense `deck-ui-webhooks` global shell. The module needs to join the contract-led high-fidelity rollout so delivery evidence and receiver configuration can be visually validated before adjacent Automate/Control panels are rebuilt.

## What Changes

- Create a complete high-fidelity Webhooks handoff package under `deck-go/frontend-handoff/modules/webhooks/`.
- Redesign `deck-go/frontend-new/src/components/panels/webhooks/` into a compact webhook operations workbench:
  - configured webhook inventory, enabled/disabled health, failure count, last status, and last fired evidence
  - selected webhook detail with URL, event subscriptions, secret state, raw payload, and delivery history
  - delivery rows with event type, success/failure, status code, duration, retry/attempt evidence, response/error detail, and raw payload access
  - create/edit form for name, URL, optional secret, event subscriptions, and enabled state
  - guarded delete, test delivery, refresh, load selected, save selected, and last-action raw evidence
- Preserve the current frontend API wrapper behavior for `fetchWebhooks`, `fetchWebhookDeliveries`, `createWebhook`, `updateWebhook`, `deleteWebhook`, and `testWebhook`; browser code continues to call the Go admin/BFF routes only.
- Confirm whether mock visual E2E needs deterministic webhook localstore seeding or fixture correction; fix only the deterministic gap needed for mock visual coverage.
- Move obsolete global `deck-ui-webhooks*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering ready inventory/detail, delivery history, form/edit or event selection, test delivery result, and delete confirmation if feasible.
- Update cross-module readiness evidence with Webhooks-specific findings and delivery/configuration molecule candidates.

## Capabilities

### New Capabilities

- `frontend-webhooks-hifi-redesign`: Covers the Webhooks handoff package, production UI rewrite, mock visual verification, and local contract/drift findings for webhook operations.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Webhooks implementation evidence and classifies whether webhook inventory rows, delivery rows, event subscription controls, receiver form sections, test-result seams, and raw payload molecules remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/webhooks/`
- `deck-go/frontend-new/src/components/panels/webhooks/`
- `deck-go/frontend-new/src/theme.css` Webhooks global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` or E2E localstore setup only if deterministic mock visual gaps are found
- `deck-go/test/e2e/` focused Webhooks mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-webhooks-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`

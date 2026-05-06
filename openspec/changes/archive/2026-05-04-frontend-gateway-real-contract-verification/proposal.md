## Why

The Gateway handoff has a new v2 high-fidelity prototype, but the production panel still reflects the earlier runtime/monitor diagnostics layout and the archived specs predate the new describe, throughput, batch, and activity workbench shape. This change re-verifies Gateway from OpenClaw Gateway protocol through deck-go BFF contracts and implements only the v2 surfaces that are contract-backed and safe.

## What Changes

- Rebuild `frontend-new` Gateway as a runtime-mode-aware control-plane dashboard aligned to the v2 handoff: topbar, KPI hero, channel/heartbeat rails, throughput projection, Methods & Events explorer, bundled-only read-only batch console, and activity projection.
- Keep browser access BFF-only and use current Deck wrappers/routes for bootstrap/runtime, Gateway health/status/describe, activity, monitor, and typed Gateway batch transport.
- Correct deterministic contract drift found during explore, including stale route names, stale Gateway method names, endpoint classification gaps, UI metadata gaps, and handoff notes that describe prototype-only behavior as production truth.
- Add/update focused unit tests, L1 mock visual E2E, bounded L2 real-stack API/UI E2E, OpenSpec validation, relevant contract checks, and build evidence.
- Keep remote mode read-only and keep runtime lifecycle start/stop/restart controls out of the Gateway panel.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `frontend-gateway-hifi-redesign`: Gateway production UI now follows the revised v2 control-plane prototype where it matches current contracts, including a full describe explorer and a safety-gated read-only batch console.
- `frontend-gateway-real-contract-verification`: Gateway contract verification now includes typed runtime Gateway batch transport, endpoint/UI metadata governance, v2 handoff drift, and read-only bundled batch validation.

## Impact

- `deck-go/frontend-new/src/components/panels/gateway/**`
- `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/api-types.ts`, and Gateway-related frontend tests/E2E
- `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, and generated UI metadata/docs when source metadata changes
- `deck-go/frontend-handoff/modules/gateway/**`
- `openspec/specs/frontend-gateway-hifi-redesign/spec.md`
- `openspec/specs/frontend-gateway-real-contract-verification/spec.md`

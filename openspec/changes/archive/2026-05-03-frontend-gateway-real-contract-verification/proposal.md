## Why

The `gateway` handoff has a fresh multi-file prototype update after the archived hifi pass, but it still needs the same real-contract verification standard now used for Budget and other modules. Gateway is the runtime control visibility surface, so mock visual parity is not enough: the route chain, monitor projections, first-run behavior, and real Gateway diagnostics must be calibrated before treating the module as complete.

## What Changes

- Treat `deck-go/frontend-handoff/modules/gateway/` as the visual/product target while anchoring production behavior to current Deck DTOs, frontend wrappers, Go BFF routes, runtime facade, Gateway health/status RPCs, activity projection, and monitor projection behavior.
- Audit the full contract chain for runtime summary, capabilities, Gateway health/status, `gateway.describe`, activity feed, monitor runs/stats/detail, selected timeline, refresh, first-run not-configured state, and lifecycle-action absence.
- Fix deterministic Gateway-scoped drift directly when backed by evidence, including stale handoff status, prototype/API docs, wrapper naming, mock fixtures, unit tests, visual tests, real-stack tests, i18n, or frontend degradation behavior.
- Add bounded L2 real-stack evidence for Gateway runtime readiness, health/status/describe routes, activity/monitor shape, and production UI rendering. Real event-rich monitor projection may be classified as empty-valid or handoff-blocked if the environment does not naturally produce runs after bounded attempts.
- Record ambiguous or unsupported claims instead of fabricating guarantees: runtime lifecycle actions, full monitor event coverage in every runtime mode, richer upstream health/status schemas, activity persistence, and cross-module monitor ownership.

## Capabilities

### New Capabilities

- `frontend-gateway-real-contract-verification`: Covers Gateway production implementation review, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, bounded L2 real-stack evidence, circuit breaker handling, and handoff of unresolved runtime/monitor/diagnostic assumptions.

### Modified Capabilities

- `frontend-gateway-hifi-redesign`: Clarifies that the hifi handoff is the visual target, but completion now requires code-truth calibration against real Deck BFF/runtime/Gateway behavior. Unsupported lifecycle, monitor, activity, or diagnostic assumptions must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/gateway/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated Deck DTOs/docs only if deterministic contract drift is found.
- **Backend**: runtime and diagnostics routes under `deck-go/backend/internal/server/`, runtime facade/OpenClaw adapters, event bus activity/monitor projections, and route tests if drift is found.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/gateway/**`, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Gateway unit tests, mock visual E2E, and bounded real-stack Gateway API/UI E2E.
- **Out of scope**: adding runtime start/stop/restart controls, new Gateway RPC methods, durable activity storage, forcing real LLM traffic solely to create monitor events, or adding new shared design-system patterns unless repeated evidence requires a later proposal.

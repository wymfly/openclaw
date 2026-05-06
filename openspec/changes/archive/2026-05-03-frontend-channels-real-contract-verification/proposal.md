## Why

The revised channels v2 handoff in `deck-go/frontend-handoff/modules/channels/` is now a complete high-fidelity target, but the current module workflow still needs the agents pilot's real-contract standard: product design must be calibrated against actual OpenClaw Gateway capability, Deck-facing contracts, Go BFF adapters, and production `frontend-new` behavior.

This change makes channels the next sample module for contract-first enterprise control development: the high-fidelity prototype is product input, while source contracts, generated Gateway artifacts, real Gateway behavior, and BFF code remain the implementation truth.

## What Changes

- Implement the channels v2 handoff package as the active production target in `frontend-new`, preserving the deck-go shell, design-system skeleton, and browser-through-BFF boundary.
- Audit real channels capability from Gateway source/schema, generated Gateway artifacts, `gateway.describe`, endpoint classification, exception records, Go BFF routes, and current frontend API wrappers before changing behavior.
- Calibrate the channels product surface to supported capability: inventory, account diagnostics, probe, throughput, settings patch, logout, routing bindings, and WeCom access controls must either map to a real contract chain or be simplified/disabled/documented.
- Treat the channels handoff as product input, not absolute API truth. If prototype BFF projections such as `accountDiagnostics`, `dmPolicy`, or `wecomAccess` diverge from real contracts, either add a justified Deck-facing projection or keep selector-derived behavior with durable handoff notes.
- Complete a front/back module pass for deterministic channels gaps: Deck-facing DTOs, generated artifacts, Go BFF routes/adapters, `frontend-new/src/api.ts` wrappers, production UI, mocks, and tests.
- Add L1 mock visual E2E aligned with the v2 handoff and L2 real-stack API/UI verification for safe channels workflows.
- Use the same bounded real-verification circuit breaker as the agents pilot: fix deterministic code/contract defects, but hand off environment-, auth-, provider-, or destructive-mutation blockers after at most three fresh attempts.
- Record module evidence in OpenSpec and `frontend-handoff/modules/channels` notes so later module proposals can reuse the workflow.

## Capabilities

### New Capabilities

- `frontend-channels-real-contract-verification`: Covers the channels v2 handoff implementation, real Gateway/BFF capability calibration, end-to-end contract-chain mapping, mock visual verification, L2 real-stack verification, and bounded handoff for unsafe or environment-sensitive scenarios.

### Modified Capabilities

- `frontend-channels-hifi-redesign`: Updates the channels high-fidelity requirement so the v2 multi-file handoff is the active visual target, while explicitly separating mock visual completion from real functional readiness.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/channels/**`, especially the v2 React/Babel prototype, API usage notes, states/interactions docs, and any implementation evidence added during translation.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-exceptions.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated Deck/Gateway artifacts, and generated docs when deterministic drift is found.
- **Backend**: channels-related Go BFF routes/adapters under `deck-go/backend/internal/**`, including `channels.status`, `channels.logout`, channel probe/test, throughput placeholder/projection, config patch, routing, and WeCom-specific configuration access.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/channels/**`, shared design-system usage touched by channels, and i18n strings for the production panel.
- **Testing**: focused frontend component tests, focused API wrapper tests, focused Go route/adapter tests, channels mock visual E2E, and bounded real-stack API/UI verification.
- **Out of scope**: The newly completed `models` v2 handoff is not implemented by this change. Its pricing/audit BFF projection assumptions require a separate proposal and contract calibration instead of being folded into channels.

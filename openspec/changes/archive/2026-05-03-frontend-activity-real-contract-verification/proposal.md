## Why

The Activity panel already has a high-fidelity handoff and production implementation from `frontend-activity-hifi-contract-redesign`, but that archived change primarily proved mock visual behavior and local BFF projections. This module now needs the same real-contract standard used for agents, channels, and skills: verify the real deck-go stack from source contract to Go BFF, SSE, frontend API wrappers, and production UI behavior; fix deterministic drift; and document environment-sensitive or unsupported assumptions.

## What Changes

- Treat `deck-go/frontend-handoff/modules/activity/` and archived `frontend-activity-hifi-contract-redesign` artifacts as the visual/product baseline, not as proof of real functional readiness.
- Audit Activity capability from Deck DTO authority, endpoint classification, SSE contract metadata, Go BFF projection code, event bus behavior, frontend API wrappers, current tests, and the production `frontend-new` Activity panel.
- Build an end-to-end contract-chain matrix covering activity feed, monitor runs, run detail, monitor stats, SSE merge, filters, pagination, diagnostics, cross-panel navigation, and unsupported real Gateway/LLM telemetry assumptions.
- Fix deterministic Activity-scoped drift in contracts, Go projection/routes, frontend wrappers, production UI, mocks, or tests when backed by real BFF/stream evidence.
- Add L2 real-stack API/UI verification for safe read-only Activity and Monitor behavior. Real Gateway may produce empty projections; empty real state is valid if it is rendered honestly and without API/page errors.
- Update handoff notes, OpenSpec verification evidence, and tasks so later modules can reuse the same real-verification rule: fix clear defects, record only disputed or unsafe gaps.

## Capabilities

### New Capabilities

- `frontend-activity-real-contract-verification`: Covers Activity real BFF/SSE capability calibration, contract-chain mapping, code-level review, L1 mock visual evidence reuse/refresh, L2 real-stack API/UI verification, and handoff for unsupported or environment-sensitive telemetry.

### Modified Capabilities

- `frontend-activity-hifi-redesign`: Clarifies that Activity high-fidelity/mock visual completion is not real functional completion, and that production behavior must prefer Deck contracts, Go BFF projection truth, and real stack evidence over prototype assumptions.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/activity/**`, especially `implementation-notes.md` and `README.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-streams.contract.json`, generated Deck DTOs/docs when deterministic drift is found.
- **Backend**: `deck-go/backend/internal/server/activity_monitor.go`, event stream narrowing, and `deck-go/backend/internal/runtime/projection/**`.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/stream-contract.ts`, `deck-go/frontend-new/src/components/panels/activity/**`, Activity i18n copy, and module tests.
- **Testing**: focused Activity unit/API tests, existing or refreshed Activity mock visual E2E, focused Go projection/route tests, and bounded real-stack API/UI verification.
- **Out of scope**: Generating real LLM activity, forcing provider calls, fabricating telemetry, building a new event persistence store, or promoting Activity timeline molecules into canonical design-system atoms.

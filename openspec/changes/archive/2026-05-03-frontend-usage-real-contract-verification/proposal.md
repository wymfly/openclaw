## Why

The `usage` handoff has a fresh v2 high-fidelity prototype, but the current production panel still mixes older route naming, simplified visuals, and only mock-level confidence. Usage is the cost, quota, and session-spend cockpit for deck-go, so completion requires verifying the real OpenClaw Gateway -> Go BFF -> frontend contract chain before using the module as a product baseline.

## What Changes

- Treat `deck-go/frontend-handoff/modules/usage/` as the visual/product target while anchoring production behavior to current Deck DTOs, frontend wrappers, Go BFF routes, OpenClaw Gateway `usage.*` and `sessions.usage*` methods, and real-stack behavior.
- Audit the full usage contract chain for cost, provider quota status, sessions, session logs, timeseries, context weight, bootstrap status, range refresh, search/filter/sort, selected-session detail, and read-only behavior.
- Fix deterministic usage-scoped drift directly when backed by evidence, including stale endpoint classification, wrapper route drift, BFF route aliases, mock fixtures, frontend state/rendering gaps, i18n, tests, handoff docs, or generated contract artifacts when the source contract changes.
- Keep new dependency work bounded: the handoff asks for `recharts`, but production SHALL NOT add it in this change without explicit dependency approval; chart work must use existing frontend-new dependencies or be recorded as a handoff risk.
- Add L1 mock visual evidence for the production usage panel and bounded L2 real-stack API/UI evidence for the usage BFF contract chain. Real usage data may be empty-valid or environment-blocked after the circuit breaker, but static code review and mock visual coverage remain mandatory.
- Record ambiguous or unsupported claims instead of fabricating guarantees: real billing accuracy, provider quota policy semantics, tenant accounting, forecasted cost, exact timeseries granularity, and context-weight trust semantics.

## Capabilities

### New Capabilities

- `frontend-usage-real-contract-verification`: Covers Usage production implementation review, real contract-chain audit, deterministic scoped fixes, mock visual evidence, bounded real-stack evidence, circuit breaker handling, and handoff of unresolved cost/quota/session assumptions.

### Modified Capabilities

- `frontend-usage-hifi-redesign`: Clarifies that the hifi handoff is the visual target, but completion now requires code-truth calibration against real Deck BFF/runtime/Gateway behavior. Unsupported dependency, billing, quota, or forecast assumptions must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/usage/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated Deck DTOs/docs only if deterministic source drift is found.
- **Backend**: Usage and model-usage BFF routes under `deck-go/backend/internal/server/` and `deck-go/backend/internal/api/http/`, OpenClaw runtime adapters, Gateway method mapping, and focused route tests if drift is found.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/usage/**`, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Usage unit tests, mock visual E2E, and bounded real-stack Usage API/UI E2E.
- **Out of scope**: adding new Gateway RPC methods, introducing `recharts` without explicit dependency approval, promising real provider billing accuracy, implementing tenant accounting, adding mutation flows, or promoting local usage molecules to design-system primitives unless repeated evidence requires a later proposal.

## Why

The `logs` handoff is a fresh v2 high-fidelity package, but the production panel still needs a real contract-chain verification pass before it can be treated as an OpenClaw Gateway control surface. Logs is also a dynamic Gateway area: `logs.tail` is upstream-schema-missing and `DeckGoLogsTailResponse.lines` is `unknown[]`, so visual completion is not enough without defensive parsing and real BFF evidence.

## What Changes

- Treat `deck-go/frontend-handoff/modules/logs/` v2 as the visual/product target while anchoring production behavior to `DeckGoLogsTailResponse`, `DeckGoLogStreamEvent`, `fetchLogsTail()`, `streamLogEvents()`, `GET /api/logs`, and `GET /api/logs/stream`.
- Audit the full contract chain from Gateway `logs.tail` through Go runtime forwarding, SSE polling, Deck-facing DTOs, frontend wrappers, production parsing, mock data, and real-stack behavior.
- Rebuild or refine the production Logs panel toward the v2 operations workbench: KPI strip, local 4-axis filters, parsed row table, selected-line details, correlation workflow, live tape, raw payload inspection, pause/resume, clear, and export preview.
- Fix deterministic Logs-scoped drift directly when backed by evidence, including handoff endpoint naming, defensive line parsing, stream payload handling, BFF forwarding, mock fixture shape, i18n, focused tests, or E2E coverage.
- Record ambiguous or product-level follow-up instead of fabricating guarantees: typed `DeckGoLogLine`, server-side filtering, durable export endpoint, and stronger SSE payload schema.
- Add or refresh L1 mock visual evidence and L2 real-stack API/UI evidence. If the real Gateway has no log lines or stream data during bounded attempts, classify the scenario as environment-blocked or real-empty-valid with evidence rather than blocking the entire module.

## Capabilities

### New Capabilities

- `frontend-logs-real-contract-verification`: Covers Logs v2 production implementation review, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, L2 real-stack evidence, circuit breaker handling, and handoff of unresolved typed-line/server-filter/export semantics.

### Modified Capabilities

- `frontend-logs-hifi-redesign`: Clarifies that the v2 handoff is the visual target, but real completion requires production implementation and contract verification; raw `unknown[]` lines must be parsed defensively and unsupported server-side filters/export semantics must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/logs/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-streams.contract.json`, generated Deck DTOs/docs only if deterministic contract drift is found.
- **Backend**: `deck-go/backend/internal/server/inventory.go`, `deck-go/backend/internal/server/stream.go`, admin route mirrors, runtime Gateway query forwarding, and related Go tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/logs/**`, module CSS, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Logs unit tests, Go route/stream tests, mock visual E2E, and bounded real-stack Logs API/UI E2E.
- **Out of scope**: adding upstream Gateway schemas for `logs.tail`, server-side filter query parameters, durable log export/download endpoint, or persistent log storage beyond the existing BFF/Gateway behavior.

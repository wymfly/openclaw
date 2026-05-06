## Why

The refreshed Alerts v2 handoff is the newest pending high-fidelity module, while the production panel still exposes only a lower-fidelity CRUD workbench. Alerts also spans Deck-local mutable state rather than Gateway RPC, so it needs an implementation pass that proves the contract chain from source DTOs through Go BFF storage, frontend wrappers, production UI, mock visual coverage, and bounded real-stack CRUD behavior.

## What Changes

- Treat `deck-go/frontend-handoff/modules/alerts/` v2 as the visual/product target, but prefer Deck contract and Go BFF truth where the prototype claims unsupported fires, audit, test-fire, evaluator, or delivery semantics.
- Rebuild `deck-go/frontend-new/src/components/panels/alerts/` into the v2 alert rules workbench: list filters, KPI strip, selected-rule detail, trigger/action evidence, create/edit/toggle/delete dialogs or equivalent guarded flows, fired-history fallback, and responsive design-system-aligned layout.
- Audit the Alerts contract chain from `DeckGoAlert*` DTOs, endpoint classification, Go BFF routes, localstore behavior, frontend API wrappers, production panel code, and existing tests.
- Fix deterministic Alerts-scoped drift directly when backed by evidence, including DTO optionality, route behavior, frontend wrappers, validation, i18n, visual mocks, and tests.
- Add or refresh L1 mock visual E2E for the v2 production UI and L2 real-stack CRUD/API/UI E2E for safe local alert rules operations.
- Record unsupported or product-ambiguous capabilities, such as durable fired-event history, audit history, alert evaluator semantics, webhook target binding, and dry-run test-fire side effects, in the handoff notes rather than fabricating them.

## Capabilities

### New Capabilities

- `frontend-alerts-real-contract-verification`: Covers Alerts v2 production implementation, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, L2 real-stack CRUD/API/UI evidence, circuit breaker handling, and handoff of unsupported alert evaluator/history semantics.

### Modified Capabilities

- `frontend-alerts-hifi-redesign`: Clarifies that the v2 high-fidelity package is the visual target, but real completion requires production implementation and contract verification; unsupported fired-history/audit/test-fire prototype assumptions must be simplified or recorded.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/alerts/**`, especially `README.md` and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated Deck DTOs/docs if deterministic drift is found.
- **Backend**: `deck-go/backend/internal/api/http/admin.go`, `deck-go/backend/internal/controld/app.go`, `deck-go/backend/internal/localstore/alerts.go`, and route tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/alerts/**`, module CSS, and alert i18n copy.
- **Testing**: focused Alerts unit tests, Go alert route tests, mock visual E2E, and bounded real-stack Alerts API/UI E2E.
- **Out of scope**: new Gateway methods, alert evaluator engine, persistent fired-event/audit store, real webhook delivery guarantees, rule DSL parser/autocomplete, or design-system atom promotion.

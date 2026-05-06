## Why

The `budget` handoff is the newest complete v2 high-fidelity package, but the production module needs real contract-chain verification before it can be treated as an enterprise governance surface. Initial explore also found deterministic handoff drift: the current Deck BFF implements Budget rules as Deck-local `localstore` CRUD and evaluates them through usage-cost data, not through upstream `gateway.usage.budget.*` methods.

## What Changes

- Treat `deck-go/frontend-handoff/modules/budget/` v2 as the visual/product target while anchoring production behavior to the real Deck BFF wrappers, DTOs, routes, localstore behavior, and usage-cost evaluation path.
- Audit the full contract chain for rule list/create/update/delete, evaluation, bootstrap mutation gating, status filters, selected-rule detail, threshold meters, and event publication.
- Rebuild or refine the production Budget panel toward the v2 two-pane workbench: status filter strip, searchable rule inventory, selected rule detail, KPI summary, CSS threshold meter, create/edit/toggle/delete dialogs, validation, and post-mutation refresh.
- Fix deterministic Budget-scoped drift directly when evidence-backed, including handoff method names, wrapper paths, period/scope enum drift, delete response semantics, mock fixtures, tests, i18n, or production UI assumptions.
- Record ambiguous or unsupported claims instead of fabricating guarantees: real billing accuracy, quota enforcement, predictive forecast, per-rule history, notification routing, org/team billing policy, durable recent-change audit, and upstream Gateway budget RPCs.
- Add or refresh L1 mock visual evidence and bounded L2 real-stack evidence. Real write scenarios may create/update/delete a uniquely named test rule and clean it up; if the real environment blocks the scenario after bounded attempts, record handoff-blocked evidence and continue.

## Capabilities

### New Capabilities

- `frontend-budget-real-contract-verification`: Covers Budget v2 production implementation review, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, bounded L2 real-stack evidence, circuit breaker handling, and handoff of unresolved forecast/history/notification/enforcement assumptions.

### Modified Capabilities

- `frontend-budget-hifi-redesign`: Clarifies that the v2 handoff is the visual target, but route/method names must follow code truth; Deck-local localstore CRUD and usage-cost-backed evaluation are the real chain; unsupported forecast/history/audit/enforcement claims must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/budget/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated Deck DTOs/docs only if deterministic contract drift is found.
- **Backend**: `deck-go/backend/internal/server/budget.go`, localstore budget rules, event bus publication for `budget.warn` / `budget.over`, and route tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/budget/**`, module CSS, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Budget unit tests, Go route tests, mock visual E2E, and bounded real-stack Budget API/UI E2E.
- **Out of scope**: upstream Gateway budget RPCs, production billing enforcement, forecast/projection, per-rule history endpoint, durable audit/change log, alert-rule linking, org/team billing policy, or adding a chart/form dependency.

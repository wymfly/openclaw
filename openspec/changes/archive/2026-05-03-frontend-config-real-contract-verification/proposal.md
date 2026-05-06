## Why

The `config` handoff is a fresh v2 high-fidelity package for the `openclaw.json` editor, but the production module must be verified against the real Deck BFF and Gateway config methods before it can be treated as a safe enterprise control surface. The current handoff also contains deterministic route/method drift: code truth is `fetchDeckConfig()`, `applyDeckConfig()`, `postConfigSchemaLookup()`, `GET /api/config`, `POST /api/config/apply`, and `POST /api/config/schema-lookup`, backed by Gateway `config.get`, `config.apply`, and `config.schema.lookup`.

## What Changes

- Treat `deck-go/frontend-handoff/modules/config/` v2 as the visual/product target while anchoring production behavior to the real Deck BFF wrappers, DTOs, routes, and Gateway methods.
- Audit the full contract chain from Gateway `config.get` / `config.apply` / `config.schema.lookup` through Go runtime forwarding, generated DTOs, frontend wrappers, production editing state, mock data, and real-stack behavior.
- Rebuild or refine the production Config panel toward the v2 three-pane editor: section navigation, schema-guided form, raw JSON, diff preview, apply confirmation, conflict handling, lookup payload, and local history/projection surfaces.
- Fix deterministic Config-scoped drift directly when backed by evidence, including handoff method names, wrapper paths, lazy lookup assumptions, form/raw synchronization, conflict handling, mock fixtures, tests, or i18n.
- Record ambiguous or product-level follow-up instead of fabricating guarantees: apply audit history, schema lookup batching, scaffold-default config, secret hint semantics, import/export, rollback, and form-library adoption.
- Add or refresh L1 mock visual evidence and bounded L2 real-stack evidence. L2 writes must be safe and reversible: prefer read-only shape checks and noop apply; if a real write scenario is blocked or risky after bounded attempts, record it and continue.

## Capabilities

### New Capabilities

- `frontend-config-real-contract-verification`: Covers Config v2 production implementation review, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, bounded L2 real-stack evidence, circuit breaker handling, and handoff of unresolved audit/history/batch/scaffold/secret semantics.

### Modified Capabilities

- `frontend-config-hifi-redesign`: Clarifies that the v2 handoff is the visual target, but real completion requires production implementation and contract verification; route/method names must follow code truth, real writes must respect baseHash semantics, and unsupported audit/history/scaffold/rollback semantics must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/config/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated Deck DTOs/docs only if deterministic contract drift is found.
- **Backend**: `deck-go/backend/internal/server/config.go`, `deck-go/backend/internal/server/gateway.go`, runtime Gateway query forwarding, and route tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/config/**`, module CSS, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Config unit tests, Go route/query tests, mock visual E2E, and bounded real-stack Config API/UI E2E.
- **Out of scope**: new Gateway config methods, schema lookup batching, default-config scaffold endpoint, persistent apply audit endpoint, rollback/version restore, import/export, secret vault integration, or adding a form library dependency.

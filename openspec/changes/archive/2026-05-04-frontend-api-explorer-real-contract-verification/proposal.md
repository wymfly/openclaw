## Why

`deck-go/frontend-handoff/modules/api-explorer/` contains a fresh v2 high-fidelity prototype for the Gateway API Explorer. The current production panel only inspects `gateway.describe`; the prototype targets a fuller developer workbench with method tree, schema-driven request builder, run/response panes, and request history. Before treating the module as complete, the panel must be reconciled with the actual deck-go contract chain and verified against both mock and real Gateway stacks.

## What Changes

- Rebuild or refactor `frontend-new` API Explorer so the production panel follows the v2 handoff where it is backed by code truth.
- Re-audit the full API Explorer contract chain: `GET /api/gateway/describe`, the typed Gateway RPC transport `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`, generated Gateway allowlist behavior, frontend wrappers, mock fixture, and real Gateway response shapes.
- Fix deterministic API Explorer drift directly when evidence-backed, including incorrect handoff claims about `/api/gateway/invoke`, CodeMirror dependencies, catalog/history persistence, or scope behavior.
- Keep unsupported prototype behavior inactive, degraded, or recorded rather than inventing unapproved BFF routes or dependencies.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for describe, safe typed invocation, response/error rendering, history behavior, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-api-explorer-real-contract-verification`: API Explorer-specific real-contract verification, typed Gateway RPC safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-api-explorer-hifi-redesign`: update the API Explorer hifi requirements from describe-only inspection to the refreshed v2 workbench where supported by the real contract chain.

## Impact

- `deck-go/frontend-handoff/modules/api-explorer/`
- `deck-go/frontend-new/src/components/panels/api-explorer/**`
- `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/lib/gateway-client.ts`, i18n, and focused frontend tests when wrapper or copy drift is found
- `deck-go/backend/internal/server/gateway.go`, `deck-go/backend/internal/api/http/runtimes.go`, runtime Gateway RPC/describe behavior, and related Go tests when BFF/runtime drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/api-explorer-visual.spec.ts` and a real-gateway E2E spec for API Explorer
- `openspec/specs/frontend-api-explorer-hifi-redesign/spec.md` and the new API Explorer real-contract verification spec

## Why

`deck-go/frontend-handoff/modules/webhooks/` contains a fresh v2 high-fidelity prototype for the Webhooks automation surface. The current production panel already talks to the Deck BFF webhook routes, but it is still closer to the earlier implementation than to the refreshed 2-pane CRUD workspace: filterable receiver inventory, tabbed detail, delivery expansion, inline test phases, guarded builder, delete confirmation, and clearer evidence states.

Before treating Webhooks as complete, the module must be reconciled with the actual deck-go contract chain and verified through mock/local and bounded real-stack evidence. Webhooks are a Deck BFF/localstore feature, not a Gateway RPC surface, so the real-contract proof must focus on BFF routes, DTOs, storage/delivery behavior, browser-only BFF access, and safe external receiver handling.

## What Changes

- Refactor `frontend-new` Webhooks so production follows the v2 handoff where it is backed by current Deck webhook contracts.
- Re-audit the Webhooks contract chain: `DeckGoWebhook*` DTOs, `/api/webhooks*` BFF endpoints, frontend wrappers, Go storage/delivery behavior, endpoint classification, mock receiver fixtures, and real-stack route behavior.
- Fix deterministic Webhooks drift directly when evidence-backed, including wrapper response shape mismatch, unsupported retry/live-event claims, unsafe secret display, stale E2E expectations, or handoff docs that overstate backend capabilities.
- Keep unsupported prototype behavior inactive, degraded, or recorded rather than inventing unapproved routes such as delivery retry, event catalog, stats, live WS/SSE push, or audit timelines.
- Add or refresh L1 mock visual E2E and bounded L2 real-stack API/UI evidence for inventory, create/update/delete/test, delivery history, error rendering, and BFF-only browser access.
- Archive only after tasks, OpenSpec validation, focused tests, relevant contract checks, frontend build, and final review evidence are complete.

## Capabilities

### New Capabilities

- `frontend-webhooks-real-contract-verification`: Webhooks-specific real-contract verification, BFF/localstore delivery safety, evidence matrix, circuit breaker, and closeout discipline.

### Modified Capabilities

- `frontend-webhooks-hifi-redesign`: update the Webhooks hifi requirements from the earlier contract-backed panel to the refreshed v2 CRUD workspace where supported by the real BFF contract.

## Impact

- `deck-go/frontend-handoff/modules/webhooks/`
- `deck-go/frontend-new/src/components/panels/webhooks/**`
- `deck-go/frontend-new/src/api.ts`, i18n, and focused frontend tests when wrapper/copy drift is found
- `deck-go/backend/internal/server/webhooks.go`, `deck-go/backend/internal/controld/admin.go`, localstore webhook behavior, and related Go tests when BFF behavior drift is found
- `deck-go/contracts/source/**` and generated artifacts only when source contract changes are necessary
- `deck-go/test/e2e/webhooks-visual.spec.ts` and a real-gateway/BFF E2E spec for Webhooks
- `openspec/specs/frontend-webhooks-hifi-redesign/spec.md` and the new Webhooks real-contract verification spec

# Webhooks Implementation Notes

## Production closeout

- Implemented the production rewrite under `deck-go/frontend-new/src/components/panels/webhooks/` with a two-pane receiver workbench, top-bar KPIs, filterable inventory, selected receiver detail, overview/deliveries/settings/gaps tabs, guarded builder modal, guarded delete modal, test delivery action evidence, and expandable delivery rows.
- Preserved the existing panel registry and frontend API facade boundary; browser code calls only Go BFF routes.
- Fixed read-side secret drift in both `backend/internal/server/webhooks.go` and `backend/internal/controld/admin.go`. Create/list/update now return `***redacted` when a secret exists, and the edit modal never pre-fills stored secrets.
- Fixed receiver URL validation drift in both BFF surfaces. Create/update now reject non-HTTP receiver URLs instead of accepting relative paths that cannot be delivered reliably.
- Kept unsupported prototype behavior as explicit gap evidence: no retry action, no live `webhook.delivery` push, no event catalog endpoint, no stats endpoint, and no audit timeline endpoint.
- Added `usage.limit` to the frontend-local event chip list because the prototype and tests use it, while keeping the catalog local until a backend event catalog exists.

## Contract-chain matrix

| Workflow                   | Contract path                                                              | Classification              | Evidence                                                         |
| -------------------------- | -------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| Inventory                  | `fetchWebhooks()` -> `GET /api/webhooks` -> localstore webhook list        | supported                   | focused frontend, Go route tests, L1 visual, L2 real API/UI      |
| Search/filter              | browser projection over `DeckGoWebhook[]`                                  | supported                   | focused frontend test                                            |
| Selection/detail tabs      | selected `DeckGoWebhook` plus `fetchWebhookDeliveries(id)`                 | supported                   | focused frontend test, L1 visual                                 |
| Create                     | `createWebhook()` -> `POST /api/webhooks`                                  | supported                   | focused frontend test, L2 real API                               |
| Edit                       | `updateWebhook()` -> `PATCH /api/webhooks/{id}`                            | supported                   | focused frontend test, L2 real API                               |
| Delete                     | confirm modal -> `DELETE /api/webhooks/{id}`                               | supported                   | focused frontend test, L2 real API                               |
| Test delivery              | `testWebhook(id)` -> `POST /api/webhooks/{id}/test` -> disposable receiver | supported for test delivery | Go route tests, L1 visual, L2 real API/UI                        |
| Delivery history           | `GET /api/webhooks/{id}/deliveries`                                        | supported                   | Go route tests, focused frontend test, L1 visual, L2 real API/UI |
| Delivery expansion         | `DeckGoWebhookDelivery` payload/response/error fields                      | supported                   | focused frontend test, L1 visual                                 |
| Secret handling            | redacted read-side DTO plus blank edit secret                              | supported after fix         | focused frontend test, Go route tests, L2 real API/UI            |
| Receiver URL validation    | absolute `http`/`https` URL with host                                      | supported after fix         | Go route tests                                                   |
| Browser BFF-only access    | frontend wrappers and Playwright request/socket guards                     | supported                   | L2 real UI                                                       |
| Retry action               | no endpoint in classification/BFF                                          | unsupported follow-up       | Gaps tab and docs                                                |
| Stats / success aggregates | no stats endpoint                                                          | degraded/browser-only       | Gaps tab and docs                                                |
| Event catalog              | no catalog endpoint                                                        | local UI helper / follow-up | Gaps tab and docs                                                |
| Live push                  | no WS/SSE event contract                                                   | unsupported follow-up       | Gaps tab and docs                                                |

## Verification evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/webhooks/prototype.html` loaded with title `webhooks - high-fidelity v2` and no browser console/page errors.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/webhooks/WebhooksPanel.test.tsx src/api.chat-helpers.test.ts` -> 53 tests passed.
- Focused backend: `cd deck-go/backend && go test ./internal/server ./internal/controld -run 'TestWebhooksRoutes|TestWebhookAdapter|TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes'` -> passed.
- L1 mock/local visual: `cd deck-go && pnpm exec playwright test test/e2e/webhooks-visual.spec.ts --config playwright.config.ts` -> 1 passed.
- L2 real stack: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/webhooks-real-gateway.spec.ts --config playwright.config.ts` -> 2 passed.

## Residual risks

- Real platform event dispatch is not implemented or verified here; only the current BFF `test.ping` delivery route is proven.
- Retry scheduling is display-only when retry metadata exists. There is no retry mutation endpoint.
- Stats, event catalog, audit timeline, and live push require future backend contract proposals.
- External receiver reliability is environment-dependent; the verified receiver is a disposable localhost test receiver.

## Contract completion closeout

- Follow-up `deck-go-budget-alerts-webhooks-contract-completion` confirmed Webhooks are a Deck-local control surface with fixture-safe CRUD, manual `test.ping` delivery, and delivery-history reads.
- Added `DeckGoWebhookTestResponse` as the typed Deck-facing DTO for `/api/webhooks/{id}/test`.
- Fixed mutation evidence drift: `webhook.test-delivery` now evaluates `success=true`, matching the BFF response instead of the non-existent `ok=true` field.
- Retry scheduling, retry mutation, delivery retention policy, stats, event catalog, audit timeline, live delivery push, and real platform event dispatch remain unsupported/deferred product contracts.

## Design-system feedback

- Reused the settled typography, color, spacing, radius, button, form, badge/pill, code/json, and status token posture.
- Kept webhook metric tiles, receiver catalog rows, selected-receiver hero, event subscription controls, builder modal, delivery rows, action-result seam, and raw evidence as module-local molecules.
- Promotion candidates remain `MetricTile`, `WorkbenchHeader`, `SelectableQueueRow`, `DetailHero`, `ActionResultSeam`, and `DeliveryEvidenceRow`, but promotion should happen in a separate design-system proposal.

## Prototype parity remediation closeout - 2026-05-05

**Change:** `deck-go-frontend-webhooks-prototype-parity-remediation`
**Status:** mock parity `pass-with-exceptions`; strengthened real E2E passed

### Deterministic Fixes

- Preserved Webhooks as a Deck-local BFF/localstore control surface. Browser
  code continues to use only `frontend-new/src/api.ts` wrappers for
  `/api/webhooks*`; no Gateway/localstore browser calls were added.
- Added prototype modal keyboard behavior: `Esc` closes the idle builder modal
  and guarded delete confirmation while respecting in-flight create/update/delete
  states.
- Strengthened mock visual evidence with six prototype-shaped receivers,
  selected detail, search/filter, builder open/cancel, edit modal `Esc`,
  guarded delete `Esc`, manual `test.ping`, delivery expansion, dark/en,
  dark/zh, light/en, light/zh, no-overflow, and unexpected-error checks.
- Strengthened real BFF evidence with a disposable local HTTP receiver,
  run-scoped webhook creation, read-side redaction, patch, manual test delivery,
  persisted delivery history, missing delete 404, cleanup, all four UI variants,
  BFF-only browser transport, and unexpected-error checks.

### Evidence

- Unit/API: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/webhooks/WebhooksPanel.test.tsx src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts` passed 77 tests.
- Typecheck: `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/webhooks-visual.spec.ts --config playwright.config.ts --output .local/webhooks-remediation-mock-visual` passed.
- Prototype parity report: `deck-go/.local/webhooks-prototype-remediation-parity-report/` marked `webhooks` ready-for-review; structured verdict remains human/visual-review gated.
- Real BFF: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/webhooks-real-gateway.spec.ts --config playwright.config.ts --output .local/webhooks-remediation-real-e2e` passed.
- Real evidence file: `deck-go/.local/webhooks-remediation-real-e2e/webhooks-real-gateway-webh-adec1-ants-and-BFF-only-transport/attachments/webhooks-real-product-surface-9fa1dd153f9f15e37326ebbe818bdfc0ee00e140.json`.
- Build: `cd deck-go && make frontend-build` passed with the existing Vite
  chunk-size warning.

### Accepted Exceptions

- Retry mutation, retry queue management, stats, backend event catalog, audit
  timeline, live `webhook.delivery` push, and real platform-event dispatch
  remain unsupported until Deck BFF contracts exist.
- Mock visual fixtures create dense receiver diversity through the BFF and a
  disposable local receiver; failing/retry/platform-event states remain
  contract-gap evidence rather than fabricated live behavior.

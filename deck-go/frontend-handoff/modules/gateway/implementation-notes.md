# gateway - implementation notes

## Review summary

The v2 Gateway handoff is now implemented in `frontend-new` against the current
Deck contract chain. The prototype was useful as product direction, but code
truth corrected three important assumptions:

- Production batch transport is `POST /api/v1/runtimes/{runtimeId}/gateway/batch`, not `POST /api/gateway/batch`.
- `gateway.batch` is real execution, not a synthetic dry-run, so the panel only exposes read-only child methods and locks submission in remote mode.
- Activity and monitor data are Deck event-bus projections; empty real-stack monitor history is valid and must not be fabricated.

## Contract-chain matrix

| Workflow                         | Frontend wrapper/source                                    | Deck route                                                    | Backend/runtime truth                              | Classification                             |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Bootstrap status                 | `useDeckUI()`                                              | `GET /api/bootstrap/status`                                   | runtime bootstrap summary                          | supported                                  |
| Runtime gateway status           | `useDeckUI()` / runtime summary                            | `GET /api/runtime/gateway`                                    | runtime facade status                              | supported                                  |
| Runtime capabilities             | `useCapabilities()`                                        | `GET /api/runtime/capabilities`                               | runtime facade capabilities                        | supported                                  |
| Gateway health                   | `fetchGatewayHealth()`                                     | `GET /api/gateway/health`                                     | BFF diagnostic route to Gateway `health`           | supported, schema partial                  |
| Gateway status                   | `fetchGatewayStatus()`                                     | `GET /api/gateway/status`                                     | BFF diagnostic route to Gateway `status`           | supported, schema partial                  |
| Gateway describe                 | `fetchGatewayDescribe()`                                   | `GET /api/gateway/describe`                                   | BFF diagnostic route to Gateway `gateway.describe` | supported                                  |
| Typed Gateway batch              | `submitGatewayBatch(req, { runtimeId })`                   | `POST /api/v1/runtimes/{runtimeId}/gateway/batch`             | runtime-scoped `gateway.batch` transport           | supported with UI read-only/bundled gating |
| Activity feed                    | `fetchActivityEvents(20)`                                  | `GET /api/activity?limit=20`                                  | Deck event-bus projection                          | supported, empty-valid                     |
| Monitor runs                     | `fetchMonitorRuns({ limit: 20 })`                          | `GET /api/monitor/runs?limit=20`                              | Deck event-bus run projection                      | supported, empty-valid                     |
| Monitor stats                    | `fetchMonitorStats()`                                      | `GET /api/monitor/stats`                                      | Deck event-bus stats projection                    | supported, empty-valid                     |
| Refresh                          | `refreshRuntimeSummary()`, diagnostics/projection wrappers | runtime, gateway, activity, monitor routes                    | independent BFF calls                              | supported                                  |
| First-run not configured         | `GatewayNotConfiguredEmptyState`                           | gateway/projection routes may return `gateway_not_configured` | runtime configured middleware                      | supported                                  |
| Runtime lifecycle buttons        | none in Gateway panel                                      | runtime action routes exist elsewhere                         | product boundary                                   | skipped-safe                               |
| Durable Gateway activity history | none                                                       | no dedicated durable Gateway route                            | event projection only                              | unsupported/degraded                       |
| Arbitrary mutating batch         | not exposed                                                | batch route can execute calls                                 | unsafe for this panel                              | skipped-safe                               |

## Fixes made

- Reworked `GatewayPanel` into the v2 control-plane workbench: topbar, KPI hero, channel/heartbeat rails, throughput projection, Methods & Events explorer, bundled-only read-only Batch console, Activity tab, and runtime facts.
- Added `submitGatewayBatch()` in `frontend-new/src/api.ts` and re-exported generated batch DTO aliases in `frontend-new/src/api-types.ts`.
- Added Gateway batch DTOs to Deck-facing generated artifacts and Go DTOs from the existing contract source.
- Updated Gateway i18n keys in English and Chinese.
- Replaced Gateway CSS with design-system-token styling and no inline production styles.
- Added `gateway.batch` to the mock Gateway so L1 visual tests exercise the real frontend/BFF path.
- Updated UI metadata and endpoint classification source/generation for the runtime-scoped batch route.
- Updated handoff README/API/components/states/interactions notes to reflect code truth.

## Verification evidence

- Prototype smoke: `prototype.html` HTTP 200, title `deck-go · gateway (v2)`, H1 `Gateway control plane`, 57 method rows, no browser errors.
- Focused frontend tests:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/gateway/GatewayPanel.test.tsx src/lib/gateway-client.test.ts`
  passed 9 tests.
- Contract checks:
  `cd deck-go && make ui-metadata-check` passed.
  `cd deck-go && make endpoint-classification-check` passed.
- Backend focused tests:
  `cd deck-go/backend && go test ./internal/api/http ./internal/server ./internal/runtime/openclaw ./internal/runtime/projection -run 'Test(MountRoutes_ListAndDetail|ActivityAndMonitorRoutes|RuntimeGatewayRoutes_ExposeReadOnlyStatus|RuntimeGatewayStatusAPI_StateMatrix|RuntimeGatewayStatusRoute_UsesFacadeShape|RuntimeGatewayStatusRoute_RemoteConfiguredUsesFacadeShape|RuntimeGatewayStatusRoute_RemoteFirstRunReturns503|RuntimeGatewayActionRoutesAreRemoved|GatewayQueries|GatewayStatusLoad|PrepareWSBatchDispatch|CollectActivityEntriesAndRuns)'`
  passed.
- Frontend build:
  `cd deck-go && make frontend-build` passed.
- L1 mock visual E2E:
  `cd deck-go && pnpm exec playwright test test/e2e/gateway-visual.spec.ts --config playwright.config.ts`
  passed 1 test and captured ready, batch, and activity screenshots.
- L2 real-stack Gateway E2E:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/gateway-real-gateway.spec.ts --config playwright.config.ts`
  passed 2 tests, including diagnostics, read-only `gateway.describe` batch, activity/monitor shapes, UI render, and no direct browser HTTP/WebSocket calls to the real Gateway.

## Residual risks and final-review notes

- Gateway health/status payloads remain partly dynamic until upstream exposes richer result schemas.
- Real monitor history may be empty in a fresh stack; this is valid route-shape evidence, not a product-completeness claim.
- The batch console is intentionally narrower than the typed transport. Do not widen it to mutating methods without a separate product/security review.
- Throughput remains a UI/BFF projection. A future durable `gateway.throughput` contract would make this stronger.

## Prototype parity remediation closeout - 2026-05-06

The active visual target remains
`frontend-handoff/modules/gateway/prototype.html`. The production panel is
accepted as `pass-with-exceptions` against that target because the visible
control-plane structure is preserved while code truth intentionally differs
from the static prototype in runtime safety details.

Deterministic fixes made in this pass:

- Localized Gateway relative-time copy for Chinese variants instead of leaking
  `m ago` / `h ago` / `d ago` strings.
- Aligned the topbar eyebrow/health phrasing and heartbeat seconds display with
  the active prototype (`deck-go · gateway`, `Gateway OK`, `30s`).
- Strengthened tests so describe interactions wait for the actual
  `gateway.describe` method row, not the static heading text.

Verification evidence:

- Focused unit/API:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/gateway/GatewayPanel.test.tsx src/lib/gateway-client.test.ts`
  -> 10 tests passed.
- TypeScript:
  `cd deck-go/frontend-new && npx tsc -b --pretty false` -> passed.
- Mock visual:
  `cd deck-go && pnpm exec playwright test test/e2e/gateway-visual.spec.ts --config playwright.config.ts --output .local/gateway-remediation-mock-visual --reporter=line`
  -> 1 test passed. Captured dark/en, dark/zh, light/en, light/zh control
  plane, describe/event, batch, and activity screenshots.
- Prototype/current report:
  `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/gateway-remediation-mock-visual --out-dir .local/gateway-prototype-remediation-parity-report --sheet-size 1`
  -> Gateway ready-for-review row generated at
  `.local/gateway-prototype-remediation-parity-report/sheet-12.png`.
- Real Gateway:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/gateway-real-gateway.spec.ts --config playwright.config.ts --output .local/gateway-remediation-real-e2e --reporter=line`
  -> 1 test passed. Scenario evidence:
  `.local/gateway-remediation-real-e2e/gateway-real-gateway-gatew-3e1f3-t-and-skipped-safe-controls/attachments/gateway-real-product-surface-0497292c8d5020c7574769e8829a4c99ec9ec42c.json`.

Real evidence summary:

- Runtime/capabilities verified bundled/configured BFF chain.
- Health/status/describe verified through Deck BFF. The real describe payload
  exposed 129 methods, 24 events, and 32 untyped methods.
- Read-only `gateway.describe` batch succeeded through
  `/api/v1/runtimes/rt_local/gateway/batch`.
- Activity and monitor routes returned valid empty projections:
  0 activity events, 0 monitor runs, and monitor stats with zero counts.
- UI covered Chat -> Monitor shell navigation, dark/en, dark/zh, light/en,
  light/zh, describe search/scope/events, Batch console read-only execution,
  Activity/projection tab, and absence of Start/Stop/Restart controls.
- Unexpected BFF API errors, console errors, page errors, direct Gateway HTTP
  requests, and direct Gateway WebSockets were all empty.

Accepted exceptions:

- Deck shell chrome surrounds the module in production; the prototype is a
  standalone page.
- Production keeps an inline real batch composer instead of the prototype's
  modal dry-run composer because `gateway.batch` executes upstream calls.
- Throughput remains a BFF/UI projection until a typed
  `gateway.throughput` contract exists.
- Real activity and monitor histories are empty-valid in a fresh stack; no
  synthetic real data is fabricated for those projections.
- Runtime lifecycle controls and mutating or subscription batch calls remain
  skipped-safe and are intentionally not exposed from this panel.

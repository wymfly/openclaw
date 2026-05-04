# gateway - implementation notes

## Review summary

The real production authority is the deck-go BFF chain, not the refreshed
prototype alone. The v2 prototype added a searchable describe explorer and a
synthetic batch console after the archived hifi pass. Static review found one
deterministic production drift: `GET /api/gateway/describe` already had DTO,
frontend wrapper, Go BFF route, and Gateway typed RPC support, but the
production `GatewayPanel` did not load or show that read-only evidence.

That drift was fixed directly. The production panel now loads
`fetchGatewayDescribe()` alongside health/status and shows method, event, and
untyped counts in the diagnostics grid. Describe failures degrade only the
describe tile; health/status remain visible when they resolve.

## Contract-chain matrix

| Workflow                 | Frontend wrapper/source                                         | Deck route                                                      | Backend/runtime truth                              | Classification                                                    |
| ------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Bootstrap status         | `useDeckUI()`                                                   | `GET /api/bootstrap/status`                                     | `managed.BootstrapStatus`                          | supported                                                         |
| Runtime gateway status   | `fetchRuntimeGatewayStatus()` / `useDeckUI()`                   | `GET /api/runtime/gateway`                                      | runtime facade plus managed runtime status         | supported                                                         |
| Runtime capabilities     | `useCapabilities()`                                             | `GET /api/runtime/capabilities`                                 | runtime facade capabilities                        | supported                                                         |
| Gateway health           | `fetchGatewayHealth()`                                          | `GET /api/gateway/health`                                       | BFF diagnostic route to Gateway `health`           | supported, schema partial                                         |
| Gateway status           | `fetchGatewayStatus()`                                          | `GET /api/gateway/status`                                       | BFF diagnostic route to Gateway `status`           | supported, schema partial                                         |
| Gateway describe         | `fetchGatewayDescribe()`                                        | `GET /api/gateway/describe`                                     | BFF diagnostic route to Gateway `gateway.describe` | supported, read-only                                              |
| Activity feed            | `fetchActivityEvents(20)`                                       | `GET /api/activity?limit=20`                                    | Deck event-bus projection                          | supported, empty-valid                                            |
| Monitor runs             | `fetchMonitorRuns({ limit: 20 })`                               | `GET /api/monitor/runs?limit=20`                                | Deck event-bus run aggregation                     | supported, empty-valid                                            |
| Monitor stats            | `fetchMonitorStats()`                                           | `GET /api/monitor/stats`                                        | Deck event-bus stats aggregation                   | supported, empty-valid                                            |
| Monitor run detail       | `fetchMonitorRunDetail(runId)`                                  | `GET /api/monitor/runs/{runId}`                                 | Deck event-bus selected run aggregation            | supported when run exists; 404 for missing run                    |
| Selected timeline        | `MonitorHistoryCard` -> `loadRunDetail`                         | `GET /api/monitor/runs/{runId}`                                 | selected run detail projection                     | supported with mock evidence; real empty-valid                    |
| Refresh                  | `refreshRuntimeSummary`, diagnostics wrappers, monitor wrappers | runtime, gateway, activity, monitor routes                      | independent BFF calls                              | supported                                                         |
| First-run not configured | `GatewayNotConfiguredEmptyState`                                | gateway passthrough middleware returns `gateway_not_configured` | remote unconfigured guard                          | supported                                                         |
| Lifecycle action absence | no Gateway lifecycle buttons                                    | runtime action routes are not surfaced here                     | product decision in OpenSpec                       | supported by unit tests                                           |
| Describe explorer        | `describe-explorer.jsx` prototype                               | `GET /api/gateway/describe`                                     | read-only describe route                           | partially supported: counts in production, full explorer deferred |
| Batch console            | `batch-console.jsx` prototype                                   | runtime batch transport exists outside this panel               | write-capable operator workflow                    | handoff-blocked pending separate safety/product proposal          |

## Fixes made

- Added `fetchGatewayDescribe()` usage to `GatewayPanel`.
- Added Gateway describe evidence tile in the production diagnostics grid.
- Kept health/status diagnostics visible when describe fails independently.
- Added i18n keys for describe evidence and describe load failures.
- Updated focused `GatewayPanel` tests to assert describe evidence and describe
  degradation.
- Updated mock visual E2E expectations to include describe evidence.
- Added L2 real-stack Gateway API/UI E2E for runtime readiness, health/status,
  describe shape, activity/monitor shape, production render, and no direct
  browser Gateway calls.
- Corrected handoff API docs and README route truth to use `/api/...` routes
  and include the refreshed v2 prototype file structure.

## Verification evidence

- Prototype smoke: `prototype.html` HTTP 200, v2 gateway prototype title,
  H1 `Gateway control plane`, 57 describe method rows, no browser errors.
- Focused frontend test:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/gateway/GatewayPanel.test.tsx`
  passed 12 tests.
- Broader frontend test:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/gateway/GatewayPanel.test.tsx`
  passed 57 tests.
- Backend focused tests:
  `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/runtime/projection -run 'Test(ActivityAndMonitorRoutes|RuntimeGatewayRoutes_ExposeReadOnlyStatus|RuntimeGatewayStatusAPI_StateMatrix|RuntimeGatewayStatusRoute_UsesFacadeShape|RuntimeGatewayStatusRoute_RemoteConfiguredUsesFacadeShape|RuntimeGatewayStatusRoute_RemoteFirstRunReturns503|RuntimeGatewayActionRoutesAreRemoved|GatewayQueries|CollectActivityEntriesAndRuns)'`
  passed.
- L1 mock visual E2E:
  `cd deck-go && pnpm exec playwright test test/e2e/gateway-visual.spec.ts --config playwright.config.ts`
  passed 1 test.
- L2 real-stack Gateway E2E:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/gateway-real-gateway.spec.ts --config playwright.config.ts`
  passed 2 tests, including API shape checks and UI checks for no direct
  browser HTTP/WebSocket calls to the real Gateway.
- Build:
  `cd deck-go && make frontend-build` passed.
- OpenSpec/diff:
  `openspec validate frontend-gateway-real-contract-verification --strict`
  passed, and `git diff --check` passed.

## Residual risks and final-review notes

- Real monitor history may be empty in a fresh real stack. This is valid for
  route-shape verification and must not be inflated with fake runs.
- Gateway health/status payloads remain partly dynamic until upstream exposes
  richer result schemas.
- The full describe explorer is useful, but production currently surfaces only
  compact read-only evidence. A richer explorer should be considered together
  with `api-explorer` ownership.
- The batch console is intentionally not active here. Even though a typed batch
  transport exists, an operator composer changes the product and safety surface.
- Durable activity history is not guaranteed by this module; current activity
  and monitor data are event-bus projections.

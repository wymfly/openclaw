# usage implementation notes

**Change:** `frontend-usage-real-contract-verification`
**Status:** implemented - real-contract verified

## Contract Matrix

| Workflow                     | Frontend wrapper/state                               | BFF route                                | Gateway/runtime source                          | Status                                    |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Bootstrap pill               | `useDeckUI().bootstrap`                              | `GET /api/bootstrap/status`              | Deck runtime bootstrap status                   | supported                                 |
| Usage cost                   | `fetchModelUsageCost()`                              | `GET /api/usage/cost`                    | `usage.cost`                                    | supported                                 |
| Usage cost legacy alias      | same DTO                                             | `GET /api/models/usage/cost`             | `usage.cost`                                    | supported, compatibility                  |
| Provider quotas              | `fetchModelUsageProviders()`                         | `GET /api/usage/providers`               | `usage.status`                                  | supported                                 |
| Provider quotas legacy alias | same DTO                                             | `GET /api/models/usage/providers`        | `usage.status`                                  | supported, compatibility                  |
| Sessions list                | `fetchUsageSessions()`                               | `GET /api/usage/sessions`                | `sessions.usage`                                | supported                                 |
| Session logs                 | `fetchUsageSessionLogs()`                            | `GET /api/usage/sessions/logs`           | `sessions.usage.logs`                           | supported, empty-valid                    |
| Session timeseries           | `fetchUsageTimeseries()`                             | `GET /api/usage/timeseries`              | `sessions.usage.timeseries`                     | supported, empty-valid                    |
| Context weight               | `fetchUsageSessions({ includeContextWeight: true })` | `GET /api/usage/sessions`                | `sessions.usage` projection                     | supported, empty-valid                    |
| Range refresh                | local state + cost/sessions refetch                  | `/api/usage/cost`, `/api/usage/sessions` | Gateway usage/session methods                   | supported                                 |
| Search/filter/sort           | local UI state                                       | none                                     | `DeckGoUsageSessionEntry` fields                | supported                                 |
| Session detail tabs          | local UI state + lazy fetch cache                    | logs/timeseries/sessions routes          | Gateway session usage methods                   | supported                                 |
| Cross-panel navigation       | `navigateToAgent`, `navigateToSession`               | none                                     | Deck UI state                                   | supported                                 |
| Read-only behavior           | no mutations                                         | no mutation route                        | none                                            | supported                                 |
| Recharts-grade charts        | not used                                             | none                                     | n/a                                             | handoff-blocked until dependency approval |
| Real billing accuracy        | not claimed                                          | n/a                                      | provider estimates only                         | unsupported claim                         |
| Quota policy semantics       | not claimed                                          | n/a                                      | `usage.status` exposes percent/reset/error only | degraded                                  |
| Tenant accounting            | not present                                          | n/a                                      | no contract                                     | unsupported claim                         |
| Cost forecast                | not present                                          | n/a                                      | no contract                                     | handoff-blocked                           |

## Fixes Made

- Added canonical active BFF routes `GET /api/usage/cost` and
  `GET /api/usage/providers` while preserving legacy
  `GET /api/models/usage/cost` and `GET /api/models/usage/providers`.
- Added the matching `/api/v1/usage/providers` admin route and
  `ManagedRuntime.GetUsageProviders`.
- Switched frontend Usage wrappers to canonical `/api/usage/*` paths.
- Updated endpoint classification and UI metadata contract sources, then
  regenerated generated UI metadata and docs.
- Refined the production Usage panel with bootstrap state, agent/channel
  filters, recent/cost/tokens sorting, session detail tabs, and CSS-only quota
  bars.
- Updated Usage unit tests, API wrapper tests, mock visual E2E, and added
  `usage-real-gateway.spec.ts` for L2 real-stack verification.
- Corrected the handoff docs: `recharts` is a dependency-gated recommendation,
  not an installed or silently approved production dependency.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` loaded from a local static server
  with HTTP 200, title `deck-go · usage (v2)`, H1 `Cost & quota cockpit`, 4
  provider cards, 8 session rows, 9 tabs, and no browser errors.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx src/api.chat-helpers.test.ts` passed 51 tests.
- `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_UsageCostProviderRoutes|TestGatewayFacade_UsageSessionRoutes|TestMountAdminRoutes|TestContractAdapters|TestGatewayQueries'` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/usage-visual.spec.ts --config playwright.config.ts` passed 1 L1 mock visual test.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/usage-real-gateway.spec.ts --config playwright.config.ts` passed 2 L2 real-stack tests.
- `cd deck-go && make endpoint-classification-check ui-metadata-check` passed.
- `openspec validate frontend-usage-real-contract-verification --strict` passed.
- `cd deck-go && make frontend-build` passed.
- `git diff --check` passed.

## Residual Risks

- `recharts` remains dependency-blocked until explicitly approved; current charts
  do not provide full crosshair, tooltip, brush, or axis behavior.
- Real billing accuracy is not guaranteed. Cost comes from Gateway estimates and
  provider pricing tables may drift from invoices.
- Provider quota policies are not structured beyond `usedPercent`, optional
  `resetAt`, and optional `error`; reset cadence and overage policy remain
  product follow-up.
- Real usage detail may be empty in fresh Gateway environments. L2 treats empty
  sessions/logs/timeseries/context reports as empty-valid when route shapes
  pass.
- Context weight reports can be `run` or `estimate`; the UI surfaces the source,
  but trust semantics need final product review.

## Codex contract completion closeout - 2026-05-05

- Fixed generated Gateway protocol drift for `sessions.usage.logs` and
  `sessions.usage.timeseries`: method metadata now uses the narrow
  usage-result schemas used by the runtime handlers, so generated TS/Go
  artifacts expose typed log entries and typed timeseries points.
- Preserved forwarded timeseries query parameters
  `startDate/endDate/mode/utcOffset` in the Gateway params contract because the
  Go BFF already forwards them.
- Added protocol codegen regression assertions so usage logs/timeseries do not
  collapse back to `unknown[]` / `unknown`.
- Kept dynamic Usage leaves explicit in dynamic-surface metadata:
  `DeckGoUsageTotals` extra counters, `DeckGoUsageSessionsResponse.aggregates`
  future dimensions, and `DeckGoContextWeightReport` extension fields.
- Focused checks passed:
  `pnpm exec tsx deck-go/contracts/scripts/protocol-codegen.test.ts`,
  `make protocol-check`, frontend Usage/Logs/Activity/API tests, and focused Go
  generated/runtime/server tests.

## Prototype parity remediation closeout - 2026-05-05

**Change:** `deck-go-frontend-usage-prototype-parity-remediation`
**Status:** mock parity `pass-with-exceptions`; strengthened real E2E passed

### Deterministic Fixes

- Expanded the mock Gateway Usage fixture from a sparse sample to a
  prototype-shaped read-only cockpit data set: 14 cost days, 4 provider quota
  providers, 8 session rows, richer model/provider/channel aggregates, 5 log
  entries, and 5 timeseries points.
- Preserved the existing Deck-facing BFF wrappers and production read-only
  cockpit implementation for cost, providers, sessions, logs, timeseries,
  range refresh, provider selection, session filters, sort, and detail tabs.
- Added prototype keyboard behavior in production: `Cmd/Ctrl+K` focuses the
  session search input and `Esc` closes the expanded session detail.
- Strengthened mock visual E2E to enter from Chat -> Usage, cover dark/en,
  dark/zh, light/en, light/zh, verify dense mock rows, provider selection,
  trend-by-model, search, logs, timeseries, context detail, `Esc`, no overflow,
  and unexpected-error checks.
- Strengthened real Gateway E2E to run a bounded cpa+main seed, verify runtime,
  bootstrap, canonical Usage routes, legacy read-only aliases, session detail
  routes when a real session exists, all four UI variants, BFF-only browser
  transport, and unexpected-error checks.

### Evidence

- Unit/API: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts` passed 76 tests.
- Typecheck: `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/usage-visual.spec.ts --config playwright.config.ts --output .local/usage-remediation-mock-visual` passed.
- Prototype parity report: `deck-go/.local/usage-prototype-remediation-parity-report/` marked `usage` ready-for-review; structured verdict remains human/visual-review gated.
- Real Gateway: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/usage-real-gateway.spec.ts --config playwright.config.ts --output .local/usage-remediation-real-e2e` passed.
- Real evidence file: `deck-go/.local/usage-remediation-real-e2e/usage-real-gateway-usage-r-74830-ants-and-BFF-only-transport/attachments/usage-real-product-surface-9037200ac94dd38c54375d65e51f5c66de540605.json`.
- Seed evidence file: `deck-go/.local/usage-remediation-real-e2e/usage-real-gateway-usage-r-74830-ants-and-BFF-only-transport/attachments/real-gateway-cpa-main-seed-a8de3a421fa4bc042b4f709309208c2c21b962ec.json`.
- Build: `cd deck-go && make frontend-build` passed with the existing Vite
  chunk-size warning.

### Accepted Exceptions

- Recharts-grade chart fidelity remains dependency-gated. Production continues
  to use existing React/CSS chart primitives.
- Real cost and provider quota data can be empty in an isolated Gateway stack.
  The real run seeded a cpa/main chat session and verified one real usage
  session row; cost and provider routes returned valid empty shapes.
- Billing-grade cost accuracy, tenant accounting, forecasts, budget
  recommendations, exports, and quota mutation remain unsupported until
  Gateway/Deck contracts exist.

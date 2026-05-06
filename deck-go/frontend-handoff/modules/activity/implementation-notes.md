# Activity Implementation Notes

## Real-Contract Verification Pass

OpenSpec change: `frontend-activity-real-contract-verification`
Date: 2026-05-04

The production `ActivityPanel` was already implemented by the archived `frontend-activity-hifi-contract-redesign` pass. This pass treated the refreshed handoff prototype as visual/product context and verified the real Deck BFF/SSE contract chain instead of rewriting the UI.

## Deterministic Fixes

- Fixed Activity/Monitor DTO drift in `deck-go/contracts/source/deck-api.contract.ts`: `DeckGoMonitorRun.agentId`, `DeckGoMonitorRun.sessionKey`, `DeckGoMonitorRunEvent.agent_id`, and `DeckGoMonitorRunEvent.session_key` are now optional nullable fields. This matches the Go projection structs, which omit empty agent/session fields.
- Regenerated `deck-go/contracts/generated/ts/deck-api.generated.ts` and `deck-go/backend/internal/deckapi/types.generated.go`.
- Added `deck-go/test/e2e/activity-real-gateway.spec.ts` for L2 real-stack API/UI verification.

## Contract Chain Matrix

| Workflow                   | Frontend wrapper                       | Deck endpoint/DTO                                             | Go BFF / Projection                     | Classification                                        | Verification                                                  |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Activity feed refresh      | `fetchActivityEvents`                  | `GET /activity`, `DeckGoActivityResponse`                     | `CollectActivityEntries` over event bus | supported; real-empty-valid                           | Real API shape and UI empty/filter state passed               |
| Event selection            | local Activity selectors               | `DeckGoActivityEvent`                                         | BFF payload only                        | supported                                             | Frontend tests and real UI smoke                              |
| SSE merge                  | `useActivitySSE` / `streamEvents`      | `activity.event`, `DeckGoActivityStreamEvent`                 | Stream narrowing in Go middleware       | supported                                             | Frontend tests and Go stream typing test                      |
| Monitor stats              | `fetchMonitorStats`                    | `GET /monitor/stats`, `DeckGoMonitorStatsResponse`            | `BuildMonitorStats`                     | supported; real-empty-valid                           | Real API shape passed                                         |
| Run list filters           | `fetchMonitorRuns`                     | `GET /monitor/runs`, `DeckGoMonitorRunsResponse`              | `AggregateRuns` + query filters         | supported; real-empty-valid                           | Frontend tests, Go route tests, real API shape passed         |
| Cursor pagination          | `fetchMonitorRuns` with `cursor`       | `nextCursor?: string \| null`                                 | BFF page slicing                        | supported                                             | Frontend tests                                                |
| Run detail                 | `fetchMonitorRunDetail`                | `GET /monitor/runs/{runId}`, `DeckGoMonitorRunDetailResponse` | `AggregateRunEvents` when run exists    | supported when run exists; real-empty-valid otherwise | Real E2E checks detail only if a real run exists              |
| Diagnostics parsing        | local parser over detail events        | `DeckGoMonitorRunEvent.data` raw JSON string                  | stream-specific event data              | degraded                                              | Raw rows stay inspectable; parsed diagnostics are best-effort |
| Cross-panel navigation     | `navigateToAgent`, `navigateToSession` | UI navigation only                                            | no backend call                         | supported                                             | Frontend tests                                                |
| Real LLM telemetry seeding | none                                   | none                                                          | no safe automatic seeding in this pass  | unsupported / handoff                                 | Not generated during real E2E                                 |

## Prototype vs Real Contract Decisions

- Prototype dense diagnostics remain valid visual guidance, but real BFF projections may be empty on a fresh real stack.
- Real empty Activity/Monitor state is valid completion evidence when route shapes are correct and UI renders honestly.
- Event `data` inner payloads remain stream-specific open envelopes; production should keep raw payload inspection and avoid pretending a full schema exists.
- No Activity panel component should call Gateway, the Go event bus, local files, local storage, or backend internals directly.

## Verification Evidence

- Prototype smoke: `prototype.html` loaded with no browser console/page errors.
- L1 focused tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/activity/ActivityPanel.test.tsx` passed, 2 files / 54 tests.
- Backend focused tests: `cd deck-go/backend && go test ./internal/server -run 'TestActivityAndMonitorRoutes|TestServeEventStream_NarrowsActivityEvent' && go test ./internal/runtime/projection -run 'TestCollectActivityEntriesAndRuns'` passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/activity-visual.spec.ts --config playwright.config.ts` passed.
- L2 real API/UI: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/activity-real-gateway.spec.ts --config playwright.config.ts` passed, 2 tests.
- Contract check: `cd deck-go && make contracts-check` passed.

## Code Review Result

No remaining blocking code findings in the scoped Activity contract chain.

Reviewed surfaces:

- `frontend-new/src/components/panels/activity/**`: panel code uses `api.ts` wrappers and `useActivitySSE`, with no raw Gateway/event-bus/filesystem access.
- `frontend-new/src/api.ts`: Activity and Monitor calls stay on Deck BFF endpoints.
- `frontend-new/src/stream-contract.ts` and `useActivitySSE.ts`: `activity.event` remains narrowed at the stream helper boundary.
- `backend/internal/server/activity_monitor.go` and `backend/internal/runtime/projection/**`: route/projection output matches the corrected optional agent/session DTO fields.
- `test/e2e/activity-visual.spec.ts` and `test/e2e/activity-real-gateway.spec.ts`: mock visual and real stack coverage are separated.

Residual risks:

- Real LLM/provider activity was not generated in this pass; final cross-module real E2E should include a seeded chat run before auditing monitor diagnostic completeness.
- Parsed diagnostic sections remain best-effort because event `data` inner schemas are not fully typed.
- Metric tile, grouped timeline row, run inventory row, and diagnostic stack remain local molecules; promote them only through a separate design-system proposal after more Observe panels converge.

## Codex observability closeout - 2026-05-05

- Reconfirmed Activity/Monitor as shared observability evidence rather than a
  rewrite target in `deck-go-usage-logs-observability-contract-completion`.
- No Activity contract source changed in this child proposal. Existing
  list-query/live-projection contracts and archived real read-path evidence
  remain the source of truth.
- Remaining diagnostic `data` parsing is still intentionally best-effort until
  event-specific Activity/Monitor payload schemas are productized.

## Prototype parity remediation - 2026-05-05

OpenSpec change:
`deck-go-frontend-activity-prototype-parity-remediation`.

The active Activity prototype is now treated as a flat unified feed, not the
older Activity + Monitor diagnostics workspace. Production was rewritten to
match that structure: page header, KPI strip, search, family/severity/time
segments, grouped feed rows, and `EventDetailDialog` with copyable raw JSON.

Deterministic fixes made during remediation:

- Replaced the production Activity page layout with the active
  `prototype.html` feed model.
- Kept browser transport on `GET /api/activity` plus `activity.event` SSE.
- Removed Activity page dependence on `/api/monitor/*` UI cards without
  deleting the monitor BFF routes or contracts used by other observability
  surfaces.
- Expanded the mock Gateway visual fixture to 60 Activity events covering the
  prototype type/family/severity spread.
- Fixed Playwright `openDeck(... locale)` so locale setup writes both
  `NEXT_LOCALE` cookie and `deckGoLocale`; the frontend reads the cookie first.

Verification evidence:

- Focused unit: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/activity/ActivityPanel.test.tsx`
  passed, 5 tests.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/activity-visual.spec.ts --config playwright.config.ts --output .local/activity-remediation-mock-visual --reporter=line`
  passed.
- Prototype parity report:
  `.local/activity-prototype-remediation-parity-report/sheet-1.html`.
- Structured verdict:
  `.local/activity-prototype-remediation-parity-report/verdict.json` and
  `.local/activity-prototype-remediation-parity-report/verdict.md`.
- Real Gateway E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/activity-real-gateway.spec.ts --config playwright.config.ts --output .local/activity-remediation-real-e2e-strengthened --reporter=line`
  passed, 2 tests.
- Frontend build: `cd deck-go && make frontend-build` passed.

Accepted visual exceptions:

- Production renders inside the persistent Deck shell/sidebar; the prototype is
  a standalone design canvas.
- Runtime fixture text and timestamps differ from prototype design-time text,
  but mock fixture density and type/severity coverage now match the prototype
  intent.

Residual risk:

- cpa/main real seed successfully created a run-scoped chat session, but
  `GET /api/activity` still returned an empty array in the real stack evidence.
  The UI therefore validated the real empty/recovery path. A later
  observability proposal should decide whether chat/session creation must emit
  persisted Activity projection rows.

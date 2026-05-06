# logs - implementation notes

## Current status

- Status: `remediated` under OpenSpec change
  `deck-go-frontend-logs-prototype-parity-remediation`.
- Visual target: v2 handoff in `frontend-handoff/modules/logs/prototype.html`.
- Code truth: `frontend-new/src/components/panels/logs/LogsPanel.tsx`,
  `frontend-new/src/api.ts`, Go BFF `/logs` and `/logs/stream` handlers, and
  `contracts/source/deck-api.contract.ts`. Current tail rows are typed
  `string[]`; stream event `json` leaves remain dynamic.

## Deterministic fixes made

- Corrected handoff endpoint references from `/api/deck/logs` to the real Deck
  BFF paths `/api/logs` and `/api/logs/stream`.
- Corrected `log.reset` documentation: the current stream contract payload is
  `{}` (`Record<string, never>`), not `{ reset: true, cursor?: number }`.
- Rebuilt production Logs around the v2 workbench shape: KPI strip, 5-axis
  local filters, parsed rows, selected-line details, raw line, live tape, raw
  stream/tail payload, pause/resume, clear, and export preview.
- Extended production parsing for current `lines: string[]` rows and retained
  defensive compatibility for object rows with `ts` or `timestamp`, arbitrary
  source ids, optional cursor, session key, correlation id, fields, stack, and
  raw payload.
- Enriched the mock Gateway logs fixture with correlation, fields, and stack
  evidence so visual E2E covers real parser/detail behavior.

## Contract-chain matrix

| Workflow              | Frontend wrapper / state                          | BFF / Gateway truth                                                                        | Status                                        |
| --------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Tail load             | `fetchLogsTail({ cursor, limit, maxBytes })`      | `GET /api/logs` forwards to Gateway `logs.tail`                                            | supported                                     |
| SSE stream            | `streamLogEvents()`                               | `GET /api/logs/stream` polls `logs.tail` and emits `log.batch` / `log.reset`               | supported, quiet-stream environment-dependent |
| Pause / resume        | Local `streamingEnabled` aborts/restarts stream   | No server-side pause contract                                                              | supported local                               |
| Clear local buffer    | Clears React state only                           | No server-side deletion                                                                    | supported local                               |
| Level filter          | Local parsed row filter                           | No Gateway filter param                                                                    | supported local                               |
| Source filter         | Local parsed row filter                           | No Gateway filter param                                                                    | supported local                               |
| Session filter        | Local parsed row filter                           | No Gateway filter param                                                                    | supported local                               |
| Correlation filter    | Exact local match on parsed `correlationId`       | No Gateway filter param                                                                    | supported local                               |
| Free-text filter      | Local search over parsed fields/raw text          | No Gateway search param                                                                    | supported local                               |
| Selected row details  | Local `ParsedLogEntry`                            | `lines` is `string[]`; raw payload is preserved and object compatibility remains defensive | supported with parsed-local shape             |
| Raw tail / raw stream | `Code` renders current tail or selected SSE event | Dynamic payload from BFF/Gateway                                                           | supported                                     |
| Export preview        | Client-side text preview from filtered rows       | No download endpoint                                                                       | supported local, durable export unsupported   |
| Typed `DeckGoLogLine` | Local parser only                                 | Tail rows are typed strings; no structured row schema today                                | unsupported/follow-up                         |
| Server-side filters   | Not sent                                          | No contract today                                                                          | unsupported/follow-up                         |

## Verification evidence

- Prototype smoke: `prototype.html` loaded over local static server with HTTP
  200, title `Log viewer`, 124 rows, filter bar present, and no browser errors.
- Focused frontend tests: `cd deck-go/frontend-new && npm run test:deck-ui --
src/api.chat-helpers.test.ts src/components/panels/logs/LogsPanel.test.tsx`
  passed, 48 tests.
- L1 mock visual E2E: `cd deck-go && pnpm exec playwright test
test/e2e/logs-visual.spec.ts --config playwright.config.ts` passed, 1 test.
- Focused Go tests: `cd deck-go/backend && go test ./internal/server
./internal/api/http ./internal/runtime/openclaw -run
'TestGatewayFacade_LogsAndGatewayHealth|TestGatewayFacade_LogsStream|TestLogsStreamBatchFormat|TestMountAdminRoutes|TestManagedRuntime|TestGatewayQueries'`
  passed.
- L2 real Gateway E2E: `cd deck-go &&
DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test
test/e2e/logs-real-gateway.spec.ts --config playwright.config.ts` passed, 2
  tests. Attempt 1 exposed only a strict Playwright selector issue in the new
  test; the selector was fixed and rerun successfully. The real stream
  reachability check completed without quiet-timeout.
- Build and final gates: `cd deck-go && make frontend-build`, `openspec
validate frontend-logs-real-contract-verification --strict`, and `git diff
--check` passed.

## Residual risks / final review items

- `logs.tail` now has typed Gateway params/result and typed Deck-facing tail
  response fields. Production still keeps raw payload inspection because stream
  event `json` leaves remain intentionally dynamic.
- `/logs/stream` can be quiet when Gateway has no new log lines; real-stack
  verification may classify this as quiet-stream handoff after bounded attempts.
- Durable export/download and server-side filters are product/API follow-up, not
  current production claims.

## Codex contract completion closeout - 2026-05-05

- Reconciled the stale matrix blocker: `logs.tail` is no longer an untyped
  upstream-schema-missing path. The generated Gateway protocol exposes typed
  `LogsTailParams` and `LogsTailResult`, and the Deck-facing
  `DeckGoLogsTailResponse` is typed.
- Kept `DeckGoLogStreamEvent.json` in dynamic-surface and stream-contract
  metadata. Log stream events are typed at the SSE envelope level while
  event-specific payload leaves remain documented dynamic.
- Matrix sources now point at list-query, live-projection, stream, and dynamic
  surface contracts instead of mutation evidence, because Logs is read/stream
  only.
- Focused checks passed:
  `pnpm exec tsx deck-go/contracts/scripts/protocol-codegen.test.ts`,
  `make protocol-check`, frontend Usage/Logs/Activity/API tests, and focused Go
  generated/runtime/server tests.

## Prototype parity remediation closeout - 2026-05-05

- Active prototype confirmed: `frontend-handoff/modules/logs/prototype.html`.
  `prototype-v1-codex.html` remains historical.
- Contract-truth correction: README/API usage now state the current
  `logs.tail` truth as typed `string[]` rows with `file`, `size`, and
  `truncated` metadata. `DeckGoLogStreamEvent.json` remains the dynamic stream
  leaf.
- Deterministic fixes:
  - localized the Logs eyebrow for zh/en real UI evidence;
  - kept export preview renderable even when the real tail is empty;
  - expanded the mock Gateway logs fixture to 124 string rows covering levels,
    sources, sessions, and repeat correlation traces.
- Mock parity verdict: `pass-with-exceptions`.
  - Evidence:
    `.local/logs-prototype-remediation-parity-report/sheet-14.png`.
  - Accepted exception: production includes Deck shell chrome while the
    prototype is standalone.
  - Accepted exception: prototype shows structured fields/stack on selected
    rows, but current contract rows are strings; production shows parsed local
    evidence and raw payload, and will render structured fields only when a
    future/object-shaped row exposes them.
- Real E2E evidence passed:
  `DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test
test/e2e/logs-real-gateway.spec.ts --config playwright.config.ts --output
.local/logs-remediation-real-e2e-strengthened --reporter=line`.
  - Safe activity before judging data: runtime, describe, activity, logs, and
    `agents.list` all returned 200 through the Deck BFF.
  - Tail/stream evidence: `/api/logs` returned 10 real string rows and
    `/api/logs/stream` emitted `log.batch`.
  - Product surface evidence: shell navigation from Chat to Logs, dark/en and
    light/zh render variants, pause/resume, export preview, free-text filter,
    clear-all, clear-local, and BFF-only browser transport all passed.

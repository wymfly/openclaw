# chat — implementation notes

Status: prototype parity remediation completed with strengthened real-contract evidence on 2026-05-05.

Code truth remains authoritative over this note. The active visual target is
`frontend-handoff/modules/chat/prototype.html`, but this handoff package is
reverse-derived from `frontend-new/src/components/panels/chat/` rather than a
forward design artifact. When this note and source code diverge, use the source
contracts, BFF routes, generated DTOs, tests, and production code as truth.

## Contract Chain

```
ChatPanel
  -> frontend-new/src/components/panels/chat/chat-api.ts
  -> frontend-new/src/api.ts
  -> deck-go BFF /api/*
  -> Gateway session, chat, command, approval, stream, media, and canvas capabilities
```

| Workflow                      | Production chain                                      | Classification                    | Notes                                                                                                  |
| ----------------------------- | ----------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Session list                  | `fetchSessionList()` -> `GET /api/sessions`           | supported                         | Real E2E proves a run-scoped session becomes the active UI session.                                    |
| Create session                | `POST /api/chat/sessions/create`                      | supported                         | Real E2E creates a `main` + `gpt-5.4` session through the BFF/Gateway chain.                           |
| Snapshot                      | `GET /api/chat/snapshot`                              | supported                         | Real evidence includes session meta, model `gpt-5.4`, and provider `cpa`.                              |
| History                       | `GET /api/chat/history`                               | supported / empty-valid           | The real fixture is aborted after creation for bounded cleanup, so message history may be empty-valid. |
| Preview overlays              | `POST /api/chat/sessions/preview`                     | supported / empty-valid           | Current real preview may report empty when the bounded fixture is aborted quickly.                     |
| Session events                | `POST /api/chat/session-events` subscribe/unsubscribe | supported                         | Real E2E validates both actions.                                                                       |
| Command discovery             | `POST /api/deck/commands/discover`                    | supported                         | Real evidence includes built-in and skill command descriptors.                                         |
| Stream reachability           | `GET /api/stream`                                     | supported                         | Browser and route checks use deck-go BFF only.                                                         |
| Composer send / steer / slash | `POST /api/chat/send`, `POST /api/chat/steer`         | supported                         | Mock and unit coverage exercise composer flows; real LLM response quality is not an archive blocker.   |
| Abort                         | `POST /api/chat/abort`                                | supported                         | Real E2E aborts the run-scoped model run before cleanup.                                               |
| Compaction                    | `POST /api/chat/compact`, `POST /api/chat/compaction` | supported / environment-dependent | Mock visual covers compaction states; durable real compaction data is not created in this pass.        |
| Approval                      | SSE approval events + approvals store                 | supported / fixture-dependent     | Mock tests cover approval dialog. Disposable real approval fixtures remain a separate module concern.  |
| Canvas / a2ui                 | `POST /api/deck/canvas` + a2ui state                  | supported / projection-dependent  | Mock visual covers canvas visibility; durable real a2ui typing remains a follow-up contract.           |
| Artifact panel                | transcript artifact detection + shared renderer       | supported / projection-dependent  | Mock visual covers artifact drawer; real fixture may not emit artifacts.                               |
| Browser transport             | relative `/api/*` only                                | supported                         | Real E2E fails on direct Gateway HTTP or websocket browser traffic.                                    |

## Deterministic Fixes

- Strengthened `chat-visual.spec.ts` to cover rich dark/en, dark/zh, light/en,
  light/zh variants plus localized light empty state and keyboard traversal.
- Captured the clean workbench screenshot before opening transcript search so
  prototype-current parity is not polluted by a test-opened overlay.
- Added `chat-real-gateway.spec.ts` with a run-scoped real session fixture,
  route-shape checks, all four theme/locale UI variants, Deck shell navigation
  from Agents to Chat, child-surface interactions, BFF-only transport checks,
  unexpected error recording, and cleanup guards.
- Hardened real stack bootstrap by making Gateway RPC readiness timeout
  configurable with `DECK_GO_REAL_GATEWAY_READY_TIMEOUT_MS` and defaulting it
  to 420 seconds for cold TypeScript/runtime-postbuild starts.
- Corrected real UI assertions to verify the product state
  (`data-active-session === fixture.key`) instead of requiring the internal
  run id to be visible as UI copy.

## Accepted Exceptions

- Production screenshots include Deck shell chrome and runtime status areas;
  the prototype is standalone.
- Chat's prototype is reverse-derived from the production implementation, so
  deterministic source contracts and BFF behavior override prototype literals.
- The real session label/run id is not guaranteed to appear verbatim in visible
  UI because the Gateway-derived title can be normalized from the session id.
  The active-session attribute and route evidence prove fixture consumption.
- The real fixture aborts the model run for bounded cleanup; assistant response
  quality and full streaming transcript completion remain a later LLM E2E lane.
- Real approval expiration, durable a2ui typing, artifact projection, and
  compaction checkpoint creation are not fabricated in this pass; mock-rich
  evidence covers the visual states and the gaps remain honest follow-ups.

## Verification Evidence

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/chat/__tests__/chat-api.test.ts src/components/panels/chat/__tests__/message-input.remote-command.test.tsx src/components/panels/chat/__tests__/projection-gap.test.ts src/components/panels/chat/__tests__/canvas-panel.test.tsx src/components/panels/chat/__tests__/message-input.approvals.test.tsx` passed, 26 tests.
- `cd deck-go && pnpm exec playwright test test/e2e/chat-visual.spec.ts --config playwright.config.ts --output .local/chat-remediation-mock-visual --reporter=line` passed, 3 tests.
- Prototype/current contact sheet:
  `deck-go/.local/chat-prototype-remediation-parity-report/sheet-8.png`;
  verdict `pass-with-exceptions`, score 92.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/chat-real-gateway.spec.ts --config playwright.config.ts --output .local/chat-remediation-real-e2e --reporter=line` passed after fixing one overly narrow UI-copy assertion and one cold-start Gateway readiness timeout.
- Real evidence attachment:
  `deck-go/.local/chat-remediation-real-e2e/chat-real-gateway-chat-rea-7a0d1-ure-UI-variants-and-cleanup/attachments/chat-real-product-surface-63a12f0834ee671e295e991dc247269f5fa5a29d.json`.

## Residual Risks

- Full assistant-response quality against `cpa` + `main` is intentionally
  treated as a later real LLM lane, not as this UI/control-surface archive gate.
- Durable real compaction, approval-expiration, a2ui/canvas typing, and artifact
  projection fixtures need separate disposable fixture design if the product
  decides to make those states first-class real E2E requirements.

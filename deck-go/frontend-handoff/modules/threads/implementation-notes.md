# Threads Implementation Notes

Status: implemented and real-contract verified on 2026-05-04.

## Contract Chain

| Workflow             | Frontend wrapper                             | Deck endpoint                                     | Go / Gateway surface                            | Capability       |
| -------------------- | -------------------------------------------- | ------------------------------------------------- | ----------------------------------------------- | ---------------- |
| List bindings        | `fetchThreads()`                             | `GET /api/deck/threads`                           | Go BFF forwards to `deck.threads.list`          | supported        |
| Filter bindings      | `fetchThreads({ agentId, channel, status })` | `GET /api/deck/threads?agentId=&channel=&status=` | Go BFF forwards the same supported params       | supported        |
| Select/detail        | local selected `DeckGoThreadEntry`           | existing list payload                             | DTO fields only                                 | supported        |
| Copy session key     | browser clipboard + visible fallback         | none                                              | `targetSessionKey` field                        | supported        |
| Open Sessions/Agents | Deck navigation helpers                      | none                                              | `targetSessionKey` / `agentId` fields           | supported        |
| Raw payload          | local render                                 | existing list payload                             | `DeckGoThreadEntry`                             | supported        |
| Empty real state     | `threads: []`                                | `GET /api/deck/threads`                           | real Gateway can have no persisted bindings     | real-empty-valid |
| Unbind/rebind/rename | none in production                           | none verified                                     | prototype assumption only                       | unsupported      |
| Recent activity      | none in production                           | none verified                                     | no thread activity projection contract          | unsupported      |
| Audit history        | none in production                           | none verified                                     | no mutation/audit contract                      | unsupported      |
| Transcript/branches  | Chat-owned / no data                         | none                                              | no message or branch DTO in `DeckGoThreadEntry` | unsupported      |

## Fixes Made

- Corrected handoff docs from `channelKind` to the actual `channel` query parameter used by `fetchThreads()` and the Go BFF.
- Corrected handoff docs from nonexistent `gateway.threads.list` wording to Gateway RPC `deck.threads.list`.
- Kept mutation, activity, audit, transcript, and branch workflows documented as unsupported assumptions instead of production behavior.
- Added L2 real-stack Threads E2E for read-only BFF contract shape and production empty-state rendering.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` loaded with HTTP 200; only expected Babel standalone warning.
- Frontend focused tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/threads/ThreadsPanel.test.tsx src/api.chat-helpers.test.ts` passed, 50 tests.
- Backend focused tests: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/api/http -run 'TestGatewayFacade_DeckSubagentsAndThreads|TestManagedRuntime|TestMountRoutes|TestRegistry|TestGatewayQueries'` passed.
- L1 mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/threads-visual.spec.ts --config playwright.config.ts` passed.
- L2 real stack E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/threads-real-gateway.spec.ts --config playwright.config.ts` passed.
- L2 real stack sample: `GET /api/deck/threads?status=all` returned HTTP 200 with `{"threads":[]}` in the current local real Gateway state, so the UI path is classified as `real-empty-valid`.

## Residual Risks

- Current real Gateway projection reads persisted Discord thread bindings. Non-Discord semantics are not verified and must not be inferred from mock rows.
- `status=active|all` is accepted and forwarded, but inactive/archive row semantics are not exposed as a row field yet.
- Mutation, activity projection, audit projection, transcript, and branch features need explicit Deck/Gateway contracts before becoming active controls.
- No source contract changed in this pass, so generated artifacts were not regenerated.

## Codex contract completion closeout - 2026-05-05

- Reconfirmed Threads as a read-only `deck.threads.list` projection in this
  child proposal. No thread mutation or live-refresh contract exists in current
  Gateway/Deck truth.
- Kept thread rename, rebind, unbind, route history, transcript, branches,
  mutation audit, and live refresh documented as unsupported/deferred rather
  than product-complete.
- The Routing/Identity mutation evidence additions close the shared ownership
  blocker that previously kept this row degraded; remaining Threads gaps are
  explicit product/Gateway evolution candidates, not current implementation
  drift.

## Codex prototype parity remediation closeout - 2026-05-05

- Reworked the production Threads panel toward the active v2 prototype while
  preserving current contract truth: dense binding inventory, prototype-shaped
  local search/channel-kind/target-kind/recency filters, six KPI tiles, selected
  relationship detail, copy/navigation affordances, and raw payload access.
- Expanded the mock Gateway fixture to ten `DeckGoThreadEntry` rows covering
  Discord, Telegram, WeCom, Slack, and QQ channel kinds; all three prototype
  target kinds; stale rows; optional labels; and operator/auto/manual
  `boundBy` variants. The mock `channel` filter now accepts either exact
  channel id or channel kind, matching current Gateway's Discord-kind behavior.
- Kept unbind, rebind, rename, recent activity, audit history, transcript, and
  branch surfaces as accepted exceptions. Activity and audit tabs now render
  explicit unsupported states rather than fabricated data.
- Mock evidence:
  - `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/threads/ThreadsPanel.test.tsx src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts` passed, 77 tests.
  - `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
  - `cd deck-go && pnpm exec playwright test test/e2e/threads-visual.spec.ts --config playwright.config.ts --output .local/threads-remediation-mock-visual` passed.
  - Prototype parity report generated at `.local/threads-prototype-remediation-parity-report`; Threads is `ready-for-review`.
- Real Gateway evidence:
  - `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/threads-real-gateway.spec.ts --config playwright.config.ts --output .local/threads-remediation-real-e2e` passed.
  - Evidence JSON: `.local/threads-remediation-real-e2e/threads-real-gateway-threa-b495f-ants-and-BFF-only-transport/attachments/threads-real-product-surface-35e78063c3063a6eed8f9ac17477bc2b44e06075.json`.
  - Status is `empty-valid`: real `GET /api/deck/threads?status=all`,
    `?channel=discord&status=all`, and impossible-agent filtered list all
    returned HTTP 200 with `threads: []`.
  - Unsupported delete returned 404 and was recorded as `skippedSafe` because no
    verified thread mutation contract exists.
  - UI evidence covers Chat -> Threads shell navigation, dark/en, dark/zh,
    light/en, light/zh, empty fallback, search/filter fallback, BFF-only
    browser transport, and zero unexpected console/page/API errors.

Remaining accepted exceptions: Deck shell chrome differs from standalone
prototype; current real Gateway only exposes persisted Discord thread bindings
and may be empty; mutation/activity/audit/transcript/branch features require
new Deck/Gateway contracts before becoming product-complete.

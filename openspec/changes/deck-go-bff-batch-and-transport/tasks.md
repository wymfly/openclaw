## 0. Pre-flight

- [ ] 0.1 Verify parent + child proposals are merged on `enhanced` branch (commits `9df05f3d8c` and `b7ddda9194`); confirm `pnpm test src/gateway/server-methods/__tests__/gateway-batch.test.ts` passes 12 tests on the current branch tip
- [ ] 0.2 Confirm `gateway.batch` typed client is exposed in `dashboard/src/types/gateway-client.generated.ts:85` and `deck-go/backend/internal/gateway/generated/methods.go:715`
- [ ] 0.3 Capture upstream response fixtures for the 5 C3 handlers (`deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list`) against a real dev gateway; save to `deck-go/backend/internal/runtime/openclaw/views/__fixtures__/`
- [ ] 0.4 Verify `make -C deck-go protocol-check` passes on a clean checkout
- [ ] 0.5 Pin parent `DispatchGatewayRequestOpts` interface signature; document the pinned contract surface in `deck-go/docs/protocol-adaptation.md` for future rebase reference
- [ ] 0.6 Freeze OQ1-OQ5 from `design.md` as implementation decisions; if any answer changes, update proposal/design/spec/tasks before starting Phase 1

## 1. BFF Infrastructure

- [ ] 1.1 Add `forkDeprecated`, `forkDeprecationReplacement`, `forkDeprecationSince`, `forkDeprecationRemovalTarget` optional fields to `MethodDefinition` in `src/gateway/method-registry.ts`
- [ ] 1.2 Surface the four new metadata fields in `gateway.describe` payload (`src/gateway/server-methods/describe.ts`) and update its result schema
- [ ] 1.3 Update `scripts/diff-describe-baseline.ts` `defaultAllowedFields` set to include the four new fields so describe-diff baseline does not flag them
- [ ] 1.4 Regenerate dashboard typed clients (`pnpm protocol:gen:ts`) and verify no unintended diff
- [ ] 1.5 Regenerate deck-go protocol artifacts (`make -C deck-go protocol-update`) and verify diff is limited to the four new metadata fields
- [ ] 1.6 Add `Realtime.BridgeFrame(ctx, frame []byte) ([]byte, error)` API to `deck-go/backend/internal/gateway/realtime.go` for raw frame pass-through; add unit test for frame.id collision prevention
- [ ] 1.7 Define `GatewayTransportProvider` interface in `deck-go/backend/internal/api/http/runtimes.go` extending the existing `GatewayRPCProvider` with `GatewayBatch(ctx, params) (Result, error)` and `GatewayUpgradeWS(w http.ResponseWriter, r *http.Request) error`

## 2. BFF Batch Endpoint (HTTP)

- [ ] 2.1 Add `GatewayBatch(ctx, params)` method to `ManagedRuntime` in `deck-go/backend/internal/runtime/openclaw/managed_runtime.go`, delegating to `typed.Batch(...)` via `GatewayQueries`
- [ ] 2.2 Register `POST /api/v1/runtimes/{rt}/gateway/batch` handler in `deck-go/backend/internal/api/http/runtimes.go` with the same `runtimeId` validation as `/gateway/rpc`
- [ ] 2.3 Implement request body parse + envelope construction; reject empty / oversized batches with 400 INVALID_REQUEST
- [ ] 2.4 Wire `requestId` propagation: read `X-Request-Id` header, include in response body and audit logs
- [ ] 2.5 Add BFF-side per-sub-call method guard using `generated.TypedMethodNames`; unknown/untyped methods return per-entry `INVALID_GATEWAY_METHOD` without dispatching to openclaw
- [ ] 2.6 Add unit tests in `runtimes_test.go`: empty batch, 33 sub-calls oversized, unknown method rejected without dispatch, nested batch rejected, subscription rejected, failFast, byte-stable response
- [ ] 2.7 Add `DeckGoGatewayBatchRequest` / `DeckGoGatewayBatchResponse` typed contracts to `deck-go/contracts/source/deck-api.contract.ts`; run `make -C deck-go contracts-sync`
- [ ] 2.8 Verify the existing `gateway.batch` per-sub-call audit `batchId` correlation propagates correctly through HTTP entry: write integration test asserting 5 batched `config.patch` audit warnings carry the same `batch=<id>` segment

## 3. Frontend Typed Batch Client

- [ ] 3.1 Add `batch<R extends BatchCallSpec[]>(calls, options?)` method to `createDeckGatewayClient` return type in `deck-go/frontend/src/lib/gateway-client.ts`
- [ ] 3.2 Implement HTTP batch dispatch: serialize calls + options to envelope, POST to `/api/v1/runtimes/{rt}/gateway/batch`, deserialize per-slot result/error union
- [ ] 3.3 Add type-level test verifying compile-time error for mismatched method/params (`expectError<...>` pattern)
- [ ] 3.4 Add runtime test verifying ordered result mapping: input `[{id:"a"}, {id:"b"}]` → output `[result_a | error_a, result_b | error_b]`
- [ ] 3.5 Update `api.chat-helpers.test.ts` mocks if needed; verify existing 6 `createDeckGatewayClient` call sites in `api.ts` still type-check

## 4. BFF WebSocket Upgrade Endpoint

- [ ] 4.1 Implement `GatewayUpgradeWS` in `deck-go/backend/internal/runtime/openclaw/managed_runtime.go` using `gorilla/websocket` upgrader; validate token from header or query param at connect time
- [ ] 4.2 Register `GET /api/v1/runtimes/{rt}/gateway/ws` upgrade handler in `runtimes.go`; reuse access middleware path
- [ ] 4.3 Implement frame.id prefixing scheme: each connected client gets a unique `c<connId>-` prefix; outbound frames to openclaw use prefixed id, inbound responses are unprefixed before delivery
- [ ] 4.4 Enforce the same `generated.TypedMethodNames` allowlist used by HTTP `/gateway/rpc` before forwarding any client frame; reject disallowed methods with `INVALID_GATEWAY_METHOD` response
- [ ] 4.5 Implement client-side ref count for event subscriptions: per-client subscription map; subscribe forwards to BFF realtime if not already subscribed, unsubscribe decrements ref count
- [ ] 4.6 Implement heartbeat: server-side ping every 30s, re-check the original deck token against current access-token state on each heartbeat, close revoked/rotated tokens within 60s
- [ ] 4.7 Close heartbeat timeout with a legal WebSocket close code (for example app-defined `4000`), and close revoked tokens with a legal policy/app code (for example `1008`/`4001`); never send reserved code `1006`
- [ ] 4.8 Implement event filtering: events received by BFF are forwarded only to clients whose subscription matches
- [ ] 4.9 Add integration test: two concurrent ws clients with overlapping frame ids, verify no cross-talk
- [ ] 4.10 Add integration test: client A subscribes to `sessions.messages`, BFF receives event, only A receives forwarded event
- [ ] 4.11 Add integration test: last client disconnect does not close BFF's openclaw connection
- [ ] 4.12 Add integration test: idle connection survives 5 minutes with proper ping/pong; dead client (no pong) closed within 60s with legal close behavior
- [ ] 4.13 Add integration test: token rotation/revocation closes an existing WS client within 60s while other valid clients continue

## 5. C3 View Migration

- [ ] 5.1 Create `deck-go/backend/internal/runtime/openclaw/views/` package with `registry.go` exposing `ViewRegistry` keyed by feature flag `DECK_GO_BFF_VIEW_LAYER`
- [ ] 5.2 Implement `RoutingList(ctx, params)` view using `typed.Batch([config.get, deck.subagents.list])` + projection to upstream-equivalent shape
- [ ] 5.3 Implement `SubagentsList(ctx, params)` view using `typed.Batch([agents.list, config.get])` + filtering
- [ ] 5.4 Implement `SubagentsLineage(ctx, params)` view (concrete fan-out determined by upstream handler implementation)
- [ ] 5.5 Implement `IdentityList(ctx, params)` view
- [ ] 5.6 Implement `ThreadsList(ctx, params)` view
- [ ] 5.7 For each view, write capture-replay test that reads fixture from `__fixtures__/`, invokes view, JSON-normalises both sides, asserts byte-equal after key-sort
- [ ] 5.8 Wire feature flag `DECK_GO_BFF_VIEW_LAYER` at the unified Gateway RPC dispatch point (`ManagedRuntime.RequestGateway` or `GatewayQueries` dispatch layer): when set and the method is one of the 5 C3 list methods, route to the BFF view registry; when unset, fall through to the existing upstream Gateway request path. Do not assume per-method chi routes exist.
- [ ] 5.9 Implement automatic fallback: BFF view error → log audit warn (rate-limited 1/min/view) + retry via upstream within same request, unless `DECK_GO_BFF_VIEW_FALLBACK=0`
- [ ] 5.10 Expose fallback counters/rate over a 5-minute window as `deck_go_view_fallback_rate{view=<name>}` (or equivalent for the project's metrics solution), with denominator defined as total BFF view invocations
- [ ] 5.11 Add tests with fallback disabled (`DECK_GO_BFF_VIEW_FALLBACK=0`) proving BFF view errors fail the request instead of being hidden by upstream fallback
- [ ] 5.12 Add alert/flag-gate evidence: sustained fallback rate > 5% for two 5-minute windows blocks default flag enablement
- [ ] 5.13 Add `forkDeprecated: true` + `forkDeprecationReplacement: "deck-go-bff/views.<Name>"` + ISO date strings to method-defs of the 5 affected handlers in `src/gateway/server-methods/deck/{routing,subagents,identity,threads}-*.method-defs.ts`
- [ ] 5.14 Verify openclaw deprecated handlers still execute correctly (regression: existing dashboard tests covering these methods must still pass)

## 6. Performance Baseline + Flag Enable

- [ ] 6.1 Create `deck-go/scripts/bench-rpc.go` (or extend existing `make benchmark-rpc` target) to measure P50/P95/P99 across the test matrix: 5 single RPC, 5 C3 view (BFF vs upstream), 4 batch fan-out sizes (1/8/16/32), 2 transports (HTTP vs WS)
- [ ] 6.2 Add JSON output schema for `bench-rpc` results: `{cell, p50, p95, p99, throughput, errorRate, env: {os, cpu, ...}}`
- [ ] 6.3 Document baseline collection methodology in `deck-go/docs/perf-baseline.md` (header + first measurement)
- [ ] 6.4 Run baseline against current implementation; collect results into `deck-go/docs/perf-baseline.md`
- [ ] 6.5 Verify acceptance criterion: each BFF view's P95 ≤ 60% of its upstream fallback P95
- [ ] 6.6 Verify acceptance criterion: WS RPC P95 ≤ 95% of HTTP RPC P95 (transport overhead reduction)
- [ ] 6.7 Verify acceptance criterion: `gateway.batch` with 32 calls P95 ≤ 4× single RPC P95 (8× speedup vs serial)
- [ ] 6.8 If any acceptance criterion fails, file blocker issue + investigate before flag flip
- [ ] 6.9 Once criteria pass, set `DECK_GO_BFF_VIEW_LAYER=1` as default in `controld` env loader

## 7. Documentation + Announce

- [ ] 7.1 Update `deck-go/docs/protocol-adaptation.md` to add an "Endpoints" section enumerating `/gateway/rpc`, `/gateway/batch`, `/gateway/ws` with auth model + request/response shape + link to `deck-api.contract.ts`
- [ ] 7.2 Update `deck-go/docs/gateway-coverage.md` to mark the 5 C3 view methods as "BFF-owned"; reflect new coverage numbers
- [ ] 7.3 Update `deck-go/docs/fork-divergent-methods.md` to mark the 5 handlers as `forkDeprecated`
- [ ] 7.4 Update `docs/gateway/protocol.md` Batch RPC section with worked example showing 3 read methods composed via deck-go BFF batch endpoint
- [ ] 7.5 Add a section to `docs/gateway/protocol.md` documenting `forkDeprecated` metadata semantics
- [ ] 7.6 Add a CHANGELOG entry under `[enhanced]` describing batch endpoint, ws transport, view layer, and deprecation timeline

## 8. Verification & Final Audit

- [ ] 8.1 Run `pnpm check`, `pnpm test`, `pnpm build` end-to-end on a clean checkout
- [ ] 8.2 Run `cd deck-go/backend && go build ./...` and `cd deck-go/backend && go test ./...`
- [ ] 8.3 Run `cd deck-go/frontend && npm run build` and `npm test`
- [ ] 8.4 Run `make -C deck-go protocol-check` (drift gate)
- [ ] 8.5 Run `make -C deck-go fork-divergence-report` and confirm 5 forkDeprecated methods are flagged but still listed
- [ ] 8.6 Run `make -C deck-go gateway-coverage-report` and confirm BFF-owned coverage column reflects 5 new entries
- [ ] 8.7 Run `openspec validate deck-go-bff-batch-and-transport --strict`
- [ ] 8.8 Capture verification.yaml entries for each scenario in the 4 spec files; mark `verified` or `blocked` with evidence
- [ ] 8.9 Independent review pass: codex cross-review of design.md decisions D1-D7, especially ws auth model and frame.id prefix scheme
- [ ] 8.10 Architect sign-off via subagent verification covering implementation completeness vs spec scenarios

## 9. Optional Follow-ups

- [ ] 9.1 Open separate proposal `deck-go-fork-handler-removal` after one release cycle to delete the 5 deprecated openclaw handlers
- [ ] 9.2 Open separate proposal `deck-go-realtime-multi-runtime` to remove the `runtimeId == DefaultRuntimeID` hardcoded check and add multi-runtime routing
- [ ] 9.3 Open separate proposal `deck-go-bff-trace-correlation` to propagate `X-Request-Id` end-to-end through all transports
- [ ] 9.4 Investigate streaming sub-call results variant if perf-baseline shows batch latency dominated by slowest sub-call
- [ ] 9.5 Investigate per-sub-call timeout enforcement (currently `options.timeoutMs` is reserved on the wire but not enforced)

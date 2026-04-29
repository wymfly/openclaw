## 0. Pre-flight: Confirm Parent Proposal Has Landed

- [ ] 0.1 Verify that `openclaw-gateway-bff-architecture-refactor` Phases 0-4 have landed and `pnpm check`, `pnpm test`, `pnpm build` are green on the resulting `enhanced` branch
- [ ] 0.2 Confirm the parent's `*.module.ts` / `*.method-defs.ts` discovery infrastructure is live (`src/gateway/server-methods/_modules.generated.ts` and `_method-defs.generated.ts` exist and are imported by `server-methods.ts`)
- [ ] 0.3 Confirm parent Phase 2.A type extension is in place: `MethodDefinition` (in `src/gateway/method-registry.ts`) has `forkClass?`, `bffEligible?`, `controlPlaneWrite?` fields, and `gateway.describe` payload surfaces them
- [ ] 0.4 Confirm parent Phase 2.C dispatcher extraction is in place: `src/gateway/server-methods/dispatcher.ts` exports `dispatchGatewayRequest({ handlers, ...opts })`, `GatewayRequestContext` has a `handlers?: GatewayRequestHandlers` field, and `handleGatewayRequest` in `server-methods.ts` is a thin wrapper that populates `context.handlers` and calls `dispatchGatewayRequest`
- [ ] 0.5 Confirm parent Phase 2.E `controlPlaneWrite` annotations are in place for the explicit 10-method list (3 upstream + 7 fork-config-write per parent task 2.22)
- [ ] 0.6 Confirm `scripts/diff-describe-baseline.ts` exists with the parent-proposal allow-list (`forkClass`, `bffEligible`, `controlPlaneWrite`)

## 1. Schema and Validators

- [ ] 1.1 Create `src/gateway/protocol/schema/gateway-batch.ts` with `GatewayBatchParamsSchema` (1–32 sub-calls, optional `failFast`, optional reserved `timeoutMs`) and `GatewayBatchResultSchema`
- [ ] 1.2 Add `validateGatewayBatchParams` to the validators in `src/gateway/protocol/index.ts` (or a fork-extension sibling if available)
- [ ] 1.3 Re-export the new schemas through the existing `src/gateway/protocol/schema.ts` barrel

## 2. Batch Handler (reuses parent's extracted dispatcher)

- [ ] 2.1 Create `src/gateway/server-methods/gateway-batch.method-defs.ts` exporting `metadata: GatewayMethodMetadataModule` for the `gateway.batch` method (params/result schemas, scope `READ_SCOPE`, `forkClass: "C5"`, no `controlPlaneWrite`). Side-effect-free imports only
- [ ] 2.2 Create `src/gateway/server-methods/gateway-batch.module.ts` exporting `module: GatewayMethodModule` whose handler:
  - Imports `dispatchGatewayRequest` from sibling `./dispatcher.js` (parent-extracted in Phase 2.C). **Does NOT import `coreGatewayHandlers`, `_modules.generated.ts`, or `server-methods.ts`** at module scope
  - Reads `handlers` from `context.handlers` (populated by parent's `handleGatewayRequest` per Phase 2.C task 2.16)
  - If `context.handlers` is missing, responds with `INVALID_REQUEST` and aborts (fail-loud guard against misconfiguration)
  - Validates batch-level params (calls 1..32, no empty)
  - For each sub-call: validates `method !== "gateway.batch"` (reject `INVALID_REQUEST`), validates `!method.match(/\.(subscribe|unsubscribe)$/)` (reject `INVALID_REQUEST`), invokes `dispatchGatewayRequest({ req, respond: capturingRespond, client, context, handlers })`
  - Honors `options.failFast` (break on first error)
  - Accumulates results in input order
  - Calls `respond(true, { results })` at the end
- [ ] 2.3 Verify the import graph is acyclic: run `pnpm check:import-cycles` (or `pnpm check:madge-import-cycles`) and confirm `gateway-batch.module.ts → dispatcher.ts` does not produce a cycle. Also verify by inspection that `dispatcher.ts` does not import `server-methods.ts` or `_modules.generated.ts`
- [ ] 2.4 Run `node scripts/gen-method-modules.ts` to regenerate `_modules.generated.ts` and `_method-defs.generated.ts` (the new pair is auto-discovered)

## 3. Tests

- [ ] 3.1 `src/gateway/server-methods/__tests__/gateway-batch.test.ts` — unit tests covering:
  - read-only batch returns ordered results
  - per-call validation runs independently (one failure does not abort others)
  - scope escalation is blocked (read-scoped client → write sub-call rejected)
  - 5 batched `config.apply` consumes 5 budget tokens (depends on parent's `controlPlaneWrite` annotation)
  - empty batch rejected
  - oversized batch (33 sub-calls) rejected
  - **nested `gateway.batch` sub-call rejected with INVALID_REQUEST**
  - subscription sub-call rejected with INVALID_REQUEST
  - failure in sub-call 3 does not roll back sub-calls 1 and 2
  - `failFast: true` aborts after first error
  - byte-stable result ordering across two identical invocations
- [ ] 3.2 `src/gateway/server.batch.e2e.test.ts` — e2e test that connects a websocket client and invokes `gateway.batch` end-to-end against a real gateway instance
- [ ] 3.3 Verify tests pass under `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test src/gateway/server-methods/__tests__/gateway-batch.test.ts`

## 4. Codegen and Allow-list

- [ ] 4.1 Run `pnpm protocol:gen:ts` and verify:
  - `dashboard/src/types/gateway-protocol.generated.ts` contains `GatewayBatchParams`, `GatewayBatchResult`, and `"gateway.batch"` in `GatewayMethodMap`
  - `dashboard/src/types/gateway-client.generated.ts` `GENERATED_METHOD_ALLOWLIST` contains `"gateway.batch"`
  - `deck-go/backend/internal/gateway/generated/methods.go` exposes a `Batch` method on the typed client
- [ ] 4.2 Update `scripts/diff-describe-baseline.ts` allow-list to include the addition of the `gateway.batch` method as a documented allowed diff
- [ ] 4.3 Run `pnpm protocol:gen:check` — exit zero
- [ ] 4.4 Run `node scripts/diff-describe-baseline.ts` — exit zero (only the new `gateway.batch` method appears as an allow-listed addition)

## 5. Integration and Final Audit

- [ ] 5.1 Run `pnpm check`, `pnpm test`, `pnpm build` end-to-end on a clean checkout
- [ ] 5.2 Verify `cd dashboard && pnpm tsgo` and `cd deck-go/backend && go build ./...` compile cleanly with the new typed client surface
- [ ] 5.3 Document `gateway.batch` semantics in consumer-facing notes: non-transactional, per-sub-call scope, max 32 sub-calls, no nested batch, no subscriptions, byte-stable ordering
- [ ] 5.4 Commit (single PR, follow `scripts/committer "<msg>"` convention)

## 6. Optional Follow-ups

- [ ] 6.1 Open separate proposal: deck-go BFF view layer that consumes `gateway.batch` to re-implement the 5 C3-eligible handlers (`deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list`) on the deck-go side
- [ ] 6.2 Consider streaming variant if metrics show batch latency dominated by slowest sub-call
- [ ] 6.3 Consider per-sub-call timeout enforcement (currently `options.timeoutMs` is reserved on the wire but not enforced)

## Context

This change is promoted from the Data Fabric follow-up inbox:

- FU-002: default runtime id is currently mirrored in
  `frontend-new/src/lib/runtime-id.ts` and should move into contract authority.
- FU-003: Gateway RPC client creation can be optimized only if request tracing
  remains per request.
- FU-004: stable query-key object ordering is deterministic but should be
  documented for numeric-like keys.

The current implementation already avoids duplicate `"rt_local"` literals in
Data Fabric query keys and Gateway client code, but the value is still a
frontend mirror of the Go runtime default. The current Gateway RPC transport
constructs a client for each query source execution. A direct cache of
`createDeckGatewayClient()` is unsafe because `createDeckGatewayTransport()`
captures `requestId` at construction time.

## Contract Sources To Re-read

Implementation MUST re-read these before production edits:

- `deck-go/backend/internal/runtime/runtimeid/default.go`
- `deck-go/contracts/source/deck-api.contract.ts`
- `deck-go/contracts/source/deck-endpoints.contract.json`
- `deck-go/contracts/generated/ts/deck-api.generated.ts`
- `deck-go/backend/internal/deckapi/types.generated.go`
- `deck-go/frontend-new/src/lib/runtime-id.ts`
- `deck-go/frontend-new/src/data/contracts/query-keys.ts`
- `deck-go/frontend-new/src/data/transport/gateway-rpc.ts`
- `deck-go/frontend-new/src/lib/gateway-client.ts`
- `openspec/follow-ups/2026-05-08-frontend-data-fabric-follow-ups.md`

## Decisions

### 1. Runtime Id Authority Must Be Contract-Owned Or Explicitly Bridged

Preferred path: add a generated Deck-facing runtime constant that both
frontend-new and Go BFF code can reference.

Fallback path: if the contract generator cannot reasonably expose constants in
this narrow change, keep the frontend mirror but add an explicit contract-chain
test or generated metadata check proving it matches the Go default. The fallback
must be recorded in `verification.yaml` and FU-002 must stay open instead of
being marked resolved.

### 2. Do Not Cache Per-Request Trace State

Gateway RPC cleanup must preserve these semantics:

- default calls generate a fresh `X-Request-Id` per request;
- explicit `requestId` options remain stable for tests or caller-controlled
  tracing;
- reusable client/method state may be cached only if it does not capture a
  stale default request id;
- browser traffic still routes through deck-go backend, never direct Gateway.

If implementation cannot separate reusable client state from request state
cleanly, do not add a cache. Prefer a code comment and tests that lock the
current tracing behavior over an unsafe optimization.

### 3. Query-Key Numeric Ordering Is Documentation Unless Proven Otherwise

`stableValue()` currently normalizes object keys before returning plain objects.
Plain-object JSON serialization remains deterministic, and numeric-like keys use
JavaScript property ordering. This is acceptable unless a real Data Fabric
filter requires different numeric semantics. This change should add a test
documenting current behavior; it should not change serialization semantics
unless the test reveals unstable output.

## Out Of Scope

- Mutation retry policy.
- Offline mutation queue or replay.
- IndexedDB query persistence.
- TanStack Query DevTools.
- Broad prefetch behavior.
- Custom oxlint enforcement.
- Generated live projection `patchStrategy` / `patchKeys`.
- Per-module test expansion unrelated to runtime id, Gateway transport, or
  query-key ordering.

## Verification Strategy

- OpenSpec:
  - `openspec validate deck-go-data-fabric-contract-and-transport-cleanup --type change --strict`
  - touched accepted specs strict validation after sync
- Contracts:
  - run the narrow sync/check target if contract source changes;
  - otherwise record why no generated contract update was needed
- Frontend:
  - focused query-key and Gateway transport/client tests
  - `cd deck-go/frontend-new && npx tsc -b --pretty false`
- Project:
  - `cd deck-go && make frontend-build`
  - `cd deck-go && make contract-gate` if contract source or generated
    artifacts change

## Follow-Up Handling

At completion:

- mark FU-002/FU-003/FU-004 as `resolved` only when their acceptance hints are
  satisfied;
- otherwise keep them `candidate` or `deferred` with exact blocker evidence;
- do not close FU-007 advanced hardening items from this change.

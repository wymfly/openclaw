## Why

BFF-style clients (deck-go, dashboard) frequently need to compose UI views from multiple gateway RPC calls. Today every composition costs N WebSocket round-trips — UI shapes like `deck.agents.detail` either stay as gateway-side composition handlers (forcing fork-only registration churn for every new shape) or pay 5–10× round-trip latency if pushed to the client. Neither is acceptable as a long-term pattern.

A generic `gateway.batch` primitive is a degenerate case of GraphQL: it lets a single WebSocket frame carry an array of sub-calls and returns an array of results, while preserving every per-call validation, scope, and rate-limit invariant of the today's RPC pipeline. It opens the door to migrating C3 (light-view) handlers from the gateway to the client BFF without round-trip explosion, and unblocks deck-go's planned BFF view layer.

This proposal is intentionally **scoped narrowly** to the primitive itself. It does not migrate any handler. It does not change deck-go's wrapper layer. It explicitly handles the recursion and cycle hazards that codex flagged in the parent proposal `openclaw-gateway-bff-architecture-refactor`.

## What Changes

This proposal introduces 1 new capability and modifies 1 existing capability:

- **Add `gateway.batch` RPC primitive**: New typed method that accepts `{ calls: [{ id, method, params }, ...], options? }` and returns `{ results: [{ id, ok, result?, error? }, ...] }`. Each sub-call is dispatched through an **acyclic helper** (not the recursive `handleGatewayRequest` import path that would risk init cycles). Sub-call validation, scope authorization, role authorization, and control-plane write budget are preserved per sub-call.
- **Forbid nested `gateway.batch`**: Sub-calls whose method is `gateway.batch` are rejected with `INVALID_REQUEST`. The dispatcher is bounded to depth 1.
- **Forbid subscription methods inside batches**: Sub-calls matching `*.subscribe` / `*.unsubscribe` are rejected at validation time without invoking the underlying handler. Subscriptions require connection-bound state that batching cannot represent cleanly.
- **Bounded fan-out**: 1–32 sub-calls per batch. Empty / oversized batches return `INVALID_REQUEST`.
- **Non-transactional semantics**: Sub-calls execute sequentially in array order; failure of a later sub-call does NOT roll back earlier sub-call mutations. Documented; consumers needing atomicity must use existing per-domain transactional methods (chiefly `config.apply`).
- **Optional `failFast`**: When true, abort dispatch on first sub-call error. Default false (collect all results).
- **Cache-stable result ordering**: For a deterministic input batch, the `results` array MUST be byte-stable across consecutive identical invocations (CLAUDE.md prompt-cache stability rule).
- **Modified — `gateway-communication`**: Adds `gateway.batch` as part of the public RPC surface, with the obligation that typed clients (`dashboard`, `deck-go`) regenerate to expose `Batch` / `gateway.batch`.

**Out of scope:**

- Any migration of C3 handlers to deck-go (separate proposal, contingent on this proposal landing).
- Streaming sub-call results (current decision: full array). May be a follow-up if metrics show batch latency dominating.
- Per-sub-call timeouts beyond the existing top-level `handleGatewayRequest` semantics. (`options.timeoutMs` is reserved on the wire for future use but not enforced in v1.)
- Adding `controlPlaneWrite: true` annotations to fork-added C2 methods — that is delivered by the parent `openclaw-gateway-bff-architecture-refactor` proposal as part of method-defs metadata, and this proposal builds on top of it.

## Capabilities

### New Capabilities

- `gateway-batch-rpc`: Defines the `gateway.batch` typed method (params/result schema), the dispatcher contract (acyclic, no nested batches, no subscriptions), per-sub-call scope/auth/rate-limit enforcement, error propagation rules, atomicity guarantees (none — explicit non-transactional), bounded fan-out, `failFast` semantics, and the byte-stable result-ordering rule.

### Modified Capabilities

- `gateway-communication`: Adds `gateway.batch` to the public RPC surface; clarifies that typed-client codegen MUST surface the batch method on the dashboard and deck-go generated clients.

## Impact

**Affected source areas (gateway side):**

- `src/gateway/server-methods/gateway-batch.module.ts` and `gateway-batch.method-defs.ts` (new): hosts the handler + metadata, registered via the discovery mechanism shipped by the parent proposal.
- `src/gateway/protocol/schema/gateway-batch.ts` (new): TypeBox schemas for `GatewayBatchParams`, `GatewayBatchResult`.
- `src/gateway/protocol/index.ts`: adds `validateGatewayBatchParams` validator export (small append, fork-extension siblings if available).
- `src/gateway/server-methods/dispatcher.ts` (provided by parent): acyclic helper that performs dispatch logic without importing the generated handler manifest, avoiding initialization cycles. The batch module uses the parent-provided `dispatchSubRequest` handler option, which re-enters this dispatcher without exposing the raw handler map through `GatewayRequestContext`.

**Generated artifacts:**

- `dashboard/src/types/gateway-protocol.generated.ts` and `gateway-client.generated.ts`: regenerated to include `gateway.batch` typed contract.
- `deck-go/backend/internal/gateway/generated/methods.go`: regenerated; new typed `Batch` method on the typed client.
- `pnpm protocol:gen:check` must pass.

**Downstream consumers (no breaking changes):**

- `dashboard/`: Consumes only via typed client. The new `gateway.batch` method becomes available; existing methods unchanged.
- `deck-go/`: Same.
- CLI / external SDK clients: Unaffected; same wire protocol with one new method added.

**Dependencies on other proposals:**

- **REQUIRES**: `openclaw-gateway-bff-architecture-refactor` (parent proposal) MUST land first to provide:
  - The `*.module.ts` / `*.method-defs.ts` discovery infrastructure that this proposal uses to register itself
  - The `controlPlaneWrite: true` flag on method-defs (so per-sub-call control-plane budget enforcement covers fork-added C2 methods, not just the upstream 3)
  - The `gateway.describe` baseline diff allow-list mechanism (the addition of `gateway.batch` is one of the post-batch allowed diffs)

**Risks:**

- The handler's recursive nature (sub-call → dispatcher → handler) introduces cycle risk if implemented naively. Mitigation: extract dispatcher into its own module; spec forbids nested `gateway.batch`; integration test specifically exercises batch-of-batch rejection.
- Per-sub-call audit logging may amplify log volume. Mitigation: existing audit mechanism is per-call regardless; nothing new beyond the increased call count, which is bounded at 32.
- `failFast` semantics could surprise consumers expecting transactional behavior. Mitigation: spec is explicit non-transactional; consumer documentation updated.

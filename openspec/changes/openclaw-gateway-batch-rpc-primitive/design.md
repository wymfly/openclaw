## Context

This is the carve-out from `openclaw-gateway-bff-architecture-refactor` for the `gateway.batch` primitive. The parent proposal originally bundled batch with fork-conflict treatment; codex review (R1, P1-5) flagged the bundling as a trojan-horse — the batch primitive is a public-RPC-surface evolution unrelated to fork-conflict reduction. This proposal exists to evolve the public RPC surface cleanly, without contaminating the conflict-treatment work.

It also incorporates two P0 fixes from the same R1 review: forbidding nested `gateway.batch` (recursion termination) and using an acyclic dispatcher helper (avoiding import-cycle initialization risk).

## Goals / Non-Goals

**Goals:**

- Add a generic `gateway.batch` primitive that lets BFF-style clients reduce N round-trips to 1 for read-mostly composition.
- Preserve per-sub-call validation, scope authorization, role authorization, and rate-limit semantics.
- Make recursion termination explicit (no nested `gateway.batch`), with a single architectural choice (acyclic dispatcher helper) that avoids the worst init-cycle hazards.
- Make result ordering byte-stable for deterministic inputs (CLAUDE.md prompt-cache stability).

**Non-Goals:**

- Migration of any C3 handler to deck-go.
- Streaming sub-call results.
- Per-sub-call timeout enforcement (reserved on the wire for future use).
- Transactional semantics (explicit non-transactional).
- Reduction of round-trip count beyond `1×N`-call savings (e.g., true GraphQL-style query language).

## Decisions

### D1: TypeBox schema and bounds

```typescript
GatewayBatchParamsSchema = Type.Object({
  calls: Type.Array(
    Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64 }), // client-assigned correlation id
      method: Type.String({ minLength: 1 }), // any non-batch, non-subscription method name
      params: Type.Optional(Type.Unknown()), // validated by the per-method schema
    }),
    { minItems: 1, maxItems: 32 }, // protect against unbounded fan-out
  ),
  options: Type.Optional(
    Type.Object({
      failFast: Type.Optional(Type.Boolean()), // default false: collect all results
      timeoutMs: Type.Optional(Type.Integer({ minimum: 1, maximum: 30000 })), // reserved, not enforced in v1
    }),
  ),
});

GatewayBatchResultSchema = Type.Object({
  results: Type.Array(
    Type.Object({
      id: Type.String(),
      ok: Type.Boolean(),
      result: Type.Optional(Type.Unknown()), // present iff ok=true
      error: Type.Optional(GatewayErrorEnvelope), // present iff ok=false
    }),
  ),
});
```

**Why id max 64 chars** (vs frame.id `NonEmptyString` no max at `frames.ts:140-147`): `id` here is a batch-local correlation id, not the WebSocket frame id; bounding it bounds error-message size. Top-level frame.id is unconstrained and handled by the existing transport.

### D2: Reuse parent proposal's extracted dispatcher (P0 fix from R1 + R2)

The parent proposal `openclaw-gateway-bff-architecture-refactor` Phase 2.C extracts the dispatch logic from `server-methods.ts:147` into `src/gateway/server-methods/dispatcher.ts` as `dispatchGatewayRequest({ handlers, ...opts })`. This proposal **reuses** that extracted dispatcher rather than creating a parallel one. The earlier R1 design (a `dispatchSubCall` wrapper that invoked `handleGatewayRequest`) was rejected by R2 as still cyclic — wrapping `handleGatewayRequest` does not break the chain `dispatcher → server-methods → _modules.generated → batch.module → dispatcher`.

```typescript
// src/gateway/server-methods/gateway-batch.module.ts (this proposal)
import { dispatchGatewayRequest } from "./dispatcher.js"; // sibling, parent-extracted helper

export const module: GatewayMethodModule = {
  name: "gateway-batch",
  metadata,
  handlers: {
    "gateway.batch": async ({ params, client, context, respond }) => {
      const handlers = context.handlers; // populated by outer handleGatewayRequest, see parent D1 context augmentation
      if (!handlers) {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.INVALID_REQUEST, "batch dispatcher unavailable"),
        );
        return;
      }
      const results: BatchResult[] = [];
      for (const call of params.calls) {
        if (call.method === "gateway.batch") {
          /* reject INVALID_REQUEST */ continue;
        }
        if (/\.(subscribe|unsubscribe)$/.test(call.method)) {
          /* reject INVALID_REQUEST */ continue;
        }
        let resp: unknown;
        let err: GatewayError | undefined;
        await dispatchGatewayRequest({
          req: { type: "req", id: call.id, method: call.method, params: call.params },
          respond: (ok, result, error) => {
            if (ok) resp = result;
            else err = error;
          },
          client,
          context,
          handlers,
        });
        results.push({ id: call.id, ok: !err, result: resp, error: err });
        if (err && params.options?.failFast) break;
      }
      respond(true, { results });
    },
  },
};
```

**Cycle analysis.** `dispatcher.ts` (parent-owned) imports only from low-level support modules (control-plane, method-scopes, protocol, role-policy, plugin scope) — none of which import `server-methods.ts` or `_modules.generated.ts`. `gateway-batch.module.ts` imports only `dispatcher.ts` (sibling). Therefore: `_modules.generated.ts → gateway-batch.module.ts → dispatcher.ts` is a directed acyclic chain. Verified by `pnpm check:import-cycles`.

**Why context.handlers (vs alternatives).**

- _vs. importing `coreGatewayHandlers` from `server-methods.ts`_: Direct cycle — `server-methods.ts → _modules.generated.ts → gateway-batch.module.ts → server-methods.ts`. Rejected.
- _vs. dynamic `import("../server-methods.js")` at handler-invoke time_: Defers cycle but doesn't break it; module initialization still touches the import graph. Rejected.
- _vs. registering a handlers ref via a setter called by `server-methods.ts` after manifest load_: Hidden module-level state; harder to test. Rejected.
- _Chosen: context augmentation_: The outer `handleGatewayRequest` in `server-methods.ts` already constructs `handlers = { ...coreGatewayHandlers, ...extraHandlers }` and populates a new `context.handlers` field before calling `dispatchGatewayRequest`. The batch handler simply reads it. Zero new module-level state, zero cycle.

### D3: Nested-batch rejection (P0 fix from R1)

Sub-calls whose method is `gateway.batch` are rejected at validation time before the dispatcher runs:

```typescript
if (call.method === "gateway.batch") {
  results.push({
    id: call.id,
    ok: false,
    error: errorShape(ErrorCodes.INVALID_REQUEST, "nested gateway.batch is not allowed"),
  });
  continue;
}
```

This bounds dispatch depth to 1. Spec encodes this as a normative requirement.

### D4: Per-sub-call scope and rate-limit

Each sub-call goes through `handleGatewayRequest` (via `dispatchSubCall`), which already enforces `authorizeOperatorScopesForMethod` and `isRoleAuthorizedForMethod`. The batch wrapper itself requires `READ_SCOPE` minimum; sub-calls needing WRITE/ADMIN scope are individually authorised.

For control-plane write budget: each sub-call that is in `CONTROL_PLANE_WRITE_METHODS` triggers `consumeControlPlaneWriteBudget` independently. **This relies on the parent proposal's `controlPlaneWrite: true` method-def annotation** — without it, only the upstream 3 methods (`config.apply`, `config.patch`, `update.run`) are budgeted, and fork-added C2 methods slip through. This proposal's spec assumes the parent has landed.

### D5: Subscription rejection

Sub-calls matching `/^.+\.(subscribe|unsubscribe)$/` are rejected at validation time without invoking the underlying handler. Subscriptions require connection-bound state that batching cannot represent cleanly.

### D6: Cache stability

Result array ordering follows input array ordering exactly. Each sub-call result is a record with deterministic key order. JSON serialisation produces byte-stable output for byte-stable input. A regression test asserts byte-equality across two consecutive identical invocations.

## Risks / Trade-offs

- **R1: Nested batch (cycle risk)** → D3 rejects nested batch at validation time; integration test exercises rejection.
- **R2: Init cycle from importing the handlers manifest** → D2 reuses the parent proposal's extracted `dispatcher.ts` (which imports zero handler modules) and reads `handlers` from `context.handlers` populated by the outer `handleGatewayRequest`. No module-level cycle.
- **R3: Amplified write-budget consumption** → D4 enforces per-sub-call budget; depends on parent proposal's task 2.22 having added `controlPlaneWrite: true` to the explicit 10-method list (3 upstream + 7 fork-config-write). Spec test asserts: 5 batched `config.apply` calls consume 5 budget tokens.
- **R4: Surprise non-transactional semantics** → Spec is explicit; consumer-facing docs updated.
- **R5: Bounded fan-out (32) too restrictive** → Acceptable for v1; can be revisited via a separate proposal if metrics show real demand for higher.
- **R6: `options.timeoutMs` reserved but not enforced** → Documented; clients SHOULD NOT rely on it in v1. Future enhancement can add per-sub-call timeout without breaking the wire format.
- **R7: Parent proposal's dispatcher signature shifts under us** → Pin against the parent's `DispatchGatewayRequestOpts` interface. If parent revises the signature post-Phase 2, this proposal absorbs the change in a follow-up commit; the surface area is small (one import, one function call).

## Migration Plan

This proposal lands as a single phase after `openclaw-gateway-bff-architecture-refactor` is complete (specifically: parent Phase 2.A type extension + Phase 2.C dispatcher extraction + Phase 2.E controlPlaneWrite list must all be in `enhanced` first):

1. Add schema + validator (no behavior change).
2. Add `gateway-batch.module.ts` + `gateway-batch.method-defs.ts` registered via the parent's discovery mechanism. The module imports `dispatchGatewayRequest` from the parent-extracted `./dispatcher.js`.
3. Add unit + integration tests covering: ordering, error propagation, scope enforcement, write-budget (relying on parent's `controlPlaneWrite` flag), subscription rejection, nested-batch rejection, failFast, byte-stability, **import-cycle freedom**.
4. Regenerate codegen.
5. Update `scripts/diff-describe-baseline.ts` allow-list to include `gateway.batch` as a known new method.

**Rollback plan.** Pure addition; rollback is a clean delete of `gateway-batch.*` files, the schema file, and the validator export. Parent's `dispatcher.ts` is untouched (it has its own server-methods.ts caller).

## Open Questions

- **OQ1**: Should `options.timeoutMs` be enforced in v1 or remain reserved? Current decision: reserved. Rationale: enforcing per-sub-call timeout requires deeper coordination with `handleGatewayRequest`'s pipeline, which is out of scope for the primitive.
- **OQ2**: Should batch sub-calls share a single client/audit context or each sub-call get its own? Current decision: share. Each sub-call's audit log entry includes a `batchId` field equal to the top-level frame.id, making correlation explicit.
- **OQ3**: Should we expose batch in `gateway.describe` as a regular method (current decision) or as a special pseudo-method? Current decision: regular method with `forkClass: "C5"` (infrastructure / introspection / dispatch).

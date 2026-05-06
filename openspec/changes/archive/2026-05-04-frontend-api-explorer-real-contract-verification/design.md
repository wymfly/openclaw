## Context

API Explorer already has production code and an archived hifi spec, but the handoff package now contains a newer v2 prototype. The module is a developer/operator surface for discovering Gateway RPC methods and safely exercising typed RPC calls through deck-go. It is not a direct Gateway console and must not open a Gateway WebSocket from browser code.

The current contract chain is:

1. `frontend-new/src/api.ts` wrapper `fetchGatewayDescribe()` for `GET /api/gateway/describe`
2. generated Gateway typed transport in `frontend-new/src/lib/gateway-client.ts` for `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`
3. Go BFF route `backend/internal/server/gateway.go` for describe and `backend/internal/api/http/runtimes.go` for typed runtime RPC
4. `ManagedRuntime.Describe` and `ManagedRuntime.RequestGateway`
5. OpenClaw Gateway `gateway.describe` plus generated Gateway allowlist / typed method artifacts
6. `DeckGoGatewayDescribe*` DTOs in `deck-go/contracts/source/deck-api.contract.ts`

## Goals / Non-Goals

**Goals:**

- Align production API Explorer with the fresh v2 handoff when the prototype is backed by the true contract.
- Preserve BFF-only browser access and wrapper/transport-first frontend architecture.
- Verify describe, method selection, schema inspection, request builder, safe typed invocation, response/error display, history, empty/error/not-configured states, and no direct browser Gateway calls.
- Fix clear API Explorer drift directly, including incorrect docs about `/api/gateway/invoke`, dependency claims, unsupported stream handling, missing wrapper tests, or stale E2E expectations.
- Record capability gaps in `frontend-handoff/modules/api-explorer/implementation-notes.md`.

**Non-Goals:**

- Add an unapproved `POST /api/gateway/invoke` route when the true typed RPC route is already `/api/v1/runtimes/{runtimeId}/gateway/rpc`.
- Add CodeMirror, Monaco, schema-form, JSON viewer, command palette, toast, trace, or diff dependencies without explicit approval.
- Implement arbitrary untyped Gateway method execution outside the generated typed allowlist.
- Implement streaming response rendering, response diffing, catalog version toasts, localStorage persistence, saved presets/bookmarks, or full schema-aware editor autocomplete in this change.
- Claim that mock visual run evidence proves real Gateway method side-effect safety or production method completeness.

## Decisions

1. **Code truth wins over prototype claims.** The v2 handoff is the visual/product target, but the actual route truth is `GET /api/gateway/describe` plus typed RPC `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`.

2. **Typed invocation only.** Run behavior must use the generated typed Gateway transport or the same BFF endpoint and must respect the generated allowlist. Untyped or schema-missing methods can be inspected but not blindly invoked if the BFF rejects them.

3. **No new editor dependency.** The handoff locks CodeMirror 6, but `frontend-new/package.json` does not currently include it and this goal has a no-new-dependency guard. Production should use a textarea/module-local JSON editor fallback and record the dependency gap.

4. **Safe real E2E.** L2 real-stack tests should invoke read-only methods such as `gateway.describe`, `models.configured`, or another known-safe typed method only. Mutating methods are inspected or skipped-safe unless a disposable fixture exists.

5. **History is module-local for now.** The prototype history rail can be implemented in React state. Durable localStorage persistence is recorded as a follow-up unless the current code already owns a stable storage pattern for this panel.

6. **Circuit breaker applies to real Gateway variation.** If method availability, scope, or environment state blocks a real scenario after bounded attempts, record it as degraded, skipped-safe, empty-valid, or handoff-blocked and continue after static review plus L1 evidence.

## Risks / Trade-offs

- **Handoff references a non-existent `/api/gateway/invoke` route** -> Correct docs and use the real typed runtime RPC route.
- **CodeMirror claim conflicts with dependency policy** -> Use textarea/simple JSON viewer now; record the richer editor as dependency-blocked.
- **Gateway describe catalog differs by runtime** -> Treat missing methods as environment-dependent and use safe fallback assertions.
- **Typed RPC allowlist may reject described but untyped methods** -> Disable or degrade Run for untyped methods and show the BFF error.
- **API Explorer can trigger side effects** -> Real E2E must stay read-only unless a disposable mutation fixture is created.

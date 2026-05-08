## Context

The final design baseline is `docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md`. This foundation change implements only Phase 0 from that design.

Current code truth:

- `deck-go/frontend-new/package.json` has React/Vite dependencies but no server-state dependency.
- `deck-go/frontend-new/src/main.tsx` mounts `DeckRoot` and `DeckGoApp` without a query provider.
- `deck-go/frontend-new/src/deck-ui/ui-store.tsx` stores runtime summary in React state and refreshes it every 30 seconds through `fetchBootstrapStatus()` and `fetchRuntimeGatewayStatus()`.
- `fetchBootstrapStatus()` reads BFF `GET /bootstrap/status`; `fetchRuntimeGatewayStatus()` reads BFF `GET /runtime/gateway`.
- `lib/gateway-client.ts` already wraps generated Gateway RPC methods but still sends browser traffic through deck-go backend `/api/v1/runtimes/{runtimeId}/gateway/rpc`.
- Live projection metadata currently exposes stream, events, refresh endpoints, stale threshold, gap policy, and cursor storage. It does not expose generated patch policy fields.

The foundation must create a reusable pattern without changing existing panel product behavior or widening scope into module migration.

## Goals / Non-Goals

**Goals:**

1. Install and mount a single TanStack Query provider for `frontend-new`.
2. Introduce Data Fabric query keys, freshness presets, transport wrappers, conservative retry/error policy, and test provider.
3. Move runtime/bootstrap summary reads into Data Fabric query hooks while preserving current auth-required and summary UI behavior.
4. Establish live invalidation integration points based on existing projection metadata.
5. Add strict tests and verification commands so later module proposals can reuse this foundation.

**Non-Goals:**

- No agents, sessions, skills, config, or chat panel migration in this change.
- No generated contract fields for `patchStrategy` or `patchKeys`.
- No automatic mutation retry.
- No offline mutation queue or offline write replay.
- No IndexedDB query persistence.
- No custom oxlint rules.
- No visual redesign or panel layout changes.

## Decisions

### D1: TanStack Query v5 is the server-state foundation

Use `@tanstack/react-query` in `frontend-new` and mount one app-level provider under `DeckRoot`.

Alternative rejected: local TTL cache around `deckFetch`. That would reduce some duplicate calls but would not provide query keys, stale/fresh semantics, mutation invalidation, or shared testing primitives.

### D2: Data Fabric supports both BFF endpoints and Gateway RPC

Runtime summary hooks use BFF functions because `/bootstrap/status` and `/runtime/gateway` are not Gateway RPC methods. Gateway protocol hooks use `createDeckGatewayClient()` and still route through `/api/v1/runtimes/{runtimeId}/gateway/rpc`.

Alternative rejected: make every query look like `gateway.call(method, params)`. That contradicts current runtime summary code and would blur BFF endpoints with Gateway RPC methods.

### D3: Runtime/bootstrap migration is the first consumer

Move `DeckUIProvider` runtime summary state to Data Fabric before any panel migration. This proves provider mounting, cache policy, auth handling, background refresh, and reconnect invalidation with the smallest product surface.

Alternative rejected: migrate `agents` first. Agents is the right reference module for the next proposal, but it is too broad for the foundation because it includes config writes, related modules, and live status projection.

### D4: Freshness presets are code-level policy, not generated contract fields

Encode the 8 freshness classes in `src/data/contracts/freshness.ts`. The foundation should not modify list-query or live-projection generated contracts to add freshness fields.

Alternative rejected: extend generated contracts in Phase 0. That would mix a data-layer foundation with contract generator evolution and slow the first vertical slice.

### D5: Mutations are safe by default

The foundation exports mutation defaults and helper types with `retry: false` and no offline replay. Actual module mutations remain out of scope, but the default must prevent later modules from accidentally retrying non-idempotent control operations.

Alternative rejected: use TanStack Query mutation pause/resume or generic 5xx retry. Current write-safety contracts mark many writes as idempotency unsupported, so default replay is unsafe.

### D6: Live projections initially invalidate and mark stale

Use existing live projection metadata for invalidation and gap recovery. A code-level projection policy may map projections to query keys, but patch reducers are opt-in and must be tested by module proposals.

Alternative rejected: depend on generated `patchStrategy` or `patchKeys`. Those fields do not exist in current contract truth.

### D7: DataFabricTestProvider is required in foundation

Tests need a shared provider with isolated query client and mock transport so module proposals do not each hand-roll QueryClient wiring.

Alternative rejected: let each test mount QueryClient manually. That would produce inconsistent defaults and weaken acceptance evidence.

## Risks / Trade-offs

- **Risk: Provider migration causes visible summary flicker** -> Preserve cached data during background refresh and keep current summary/auth UI semantics covered by tests.
- **Risk: Data Fabric abstractions grow too broad too early** -> Limit foundation to runtime queries, shared policy, and test support; leave module hooks for later proposals.
- **Risk: BFF and Gateway RPC sources are confused again** -> Keep `kind: "bff"` and `kind: "gateway-rpc"` transport wrappers separate and test runtime queries against BFF functions.
- **Risk: live invalidation over-fetches** -> Start with runtime-liveness invalidation and projection stale markers only; module-specific invalidation maps come later.
- **Risk: real-gateway E2E is environment-sensitive** -> Define a circuit breaker: after two focused real-stack attempts fail for environment/runtime startup reasons, record command output, logs, and skipped-safe handoff while keeping unit/build/mock evidence required.

## Migration Plan

1. Add TanStack Query dependency and Data Fabric provider.
2. Add `src/data` foundation modules: query client, freshness policy, query keys, BFF/Gateway transport wrappers, errors, runtime queries, live invalidation skeleton, test provider.
3. Refactor `DeckUIProvider` to consume runtime/bootstrap query hooks and remove the fixed summary interval.
4. Keep `refreshRuntimeSummary()` as a user/manual refresh facade backed by query invalidation/refetch so existing panel calls remain compatible.
5. Add tests for freshness presets, key stability, provider isolation, runtime query behavior, auth-required handling, and manual refresh.
6. Update frontend protocol docs to point new server-state work at Data Fabric.
7. Run OpenSpec validation plus `npm run test:deck-ui`, `make frontend-build`, and contract checks.

Rollback: remove `src/data`, remove TanStack dependency, restore `DeckUIProvider` local runtime summary polling, and revert protocol doc additions. No persisted data migration is involved.

## Open Questions

- TanStack Query DevTools remains deferred unless implementation finds a low-risk dev-only mount that does not affect production bundles.
- The next proposal should decide whether `agents` remains the first reference module or whether a smaller read-only module is used as a spike. This foundation does not decide that.

## Implementation Baseline Check

Checked before code edits on 2026-05-08.

- `docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md` still matches this change scope: Phase 0 is provider, query keys, freshness policy, transport wrappers, runtime summary migration, live invalidation skeleton, docs, and verification. No implementation-affecting mismatch was found.
- `deck-go/contracts/source/deck-api.contract.ts` defines `DeckGoRuntimeGatewayStatus`, `DeckGoRuntimeGatewayResponse`, and `DeckGoBootstrapStatusResponse`; these are the DTO truth for runtime/bootstrap summary reads.
- `deck-go/contracts/source/deck-endpoints.contract.json` classifies `GET /bootstrap/status` and `GET /runtime/gateway` as `deck-go-bff` endpoints, so runtime summary must stay BFF-backed instead of being modeled as Gateway RPC.
- `deck-go/contracts/source/deck-streams.contract.json` names `runtime.gateway.status`, `runtime.gateway.health`, and `runtime.gateway.exit` events. These are valid invalidation inputs for runtime-liveness cache entries.
- `deck-go/contracts/source/deck-live-projections.contract.json` exposes projection id, panel, stream, events, refresh endpoints, stale threshold, gap policy, and cursor storage key only. The current generated contract also has no `patchStrategy` or `patchKeys`.
- `deck-go/contracts/source/deck-list-queries.contract.json`, `deck-go/contracts/source/deck-mutations.contract.json`, and `deck-go/contracts/source/deck-config-write-safety.contract.json` confirm that later module proposals need explicit list, mutation, conflict, idempotency, rollback, and invalidation rules. Phase 0 should only provide safe defaults.
- `deck-go/contracts/source/deck-route-governance.contract.json`, `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json`, and `deck-go/contracts/source/deck-ui.contract.json` are governance inputs for later module hooks. Phase 0 does not modify them.
- Current runtime code truth remains as captured above: `frontend-new/src/deck-ui/ui-store.tsx` owns runtime summary state and a fixed 30s interval; `frontend-new/src/api.ts` reads `/bootstrap/status` and `/runtime/gateway`; `frontend-new/src/lib/gateway-client.ts` routes Gateway RPC through `/api/v1/runtimes/{runtimeId}/gateway/rpc`; `frontend-new/src/main.tsx` has no query provider.
- This foundation does not change contract source or generated contract artifacts. Contract verification is therefore a drift gate, not a sync/regeneration task.

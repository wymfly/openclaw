## Why

`deck-go/frontend-new` currently has no shared server-state layer, so runtime status and panel data are still refreshed through component-local `useEffect`/store fetch lifecycles. This makes panel navigation feel like repeated RPC work and leaves no common policy for freshness, reconnect invalidation, first-load vs background-refresh UI, or safe mutation defaults.

This change starts the Data Fabric program from `docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md` with a narrow foundation slice: install the shared query layer, migrate runtime/bootstrap summary into it, and add the reusable contracts/tests needed for later module proposals without redesigning module UI.

## What Changes

- Add TanStack Query v5 as the canonical server-state dependency for `frontend-new`.
- Add `frontend-new/src/data/` foundation modules for:
  - a single app-level query provider,
  - stable query keys,
  - 8-class freshness policy presets,
  - BFF endpoint and Gateway RPC transport wrappers that still route through the deck-go backend,
  - normalized Data Fabric error types and conservative retry policy,
  - a Data Fabric test provider with mock transport support.
- Migrate `DeckUIProvider` runtime/bootstrap summary away from its duplicated 30s local polling state into Data Fabric runtime query hooks.
- Preserve existing panel visuals and public UI behavior in this foundation slice.
- Add protocol documentation that new server-state work must go through Data Fabric rather than naked `useEffect(fetch*)` or store-owned `load*/fetch*/refresh*` lifecycles.
- Add focused tests proving query key stability, freshness mapping, provider behavior, runtime query cache behavior, and no direct browser-to-Gateway access.
- Do not add mutation retry, offline mutation queueing, IndexedDB persistence, custom oxlint rules, or generated `patchStrategy`/`patchKeys` contract fields in this change.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-foundation`: Shared server-state foundation for `frontend-new`, including provider mounting, query key/freshness governance, runtime/bootstrap query migration, BFF/Gateway transport boundaries, conservative mutation defaults, live invalidation hooks, and test support.

### Modified Capabilities

- `frontend-new-workspace`: Clarify that `frontend-new` now hosts active panels and must route new server-state reads through the Data Fabric provider while preserving independent Vite/React workspace behavior.
- `deck-go-live-projection-subscription-contract`: Add Data Fabric consumption rules for using existing live projection metadata as invalidation/gap-recovery signals without requiring new generated `patchStrategy`/`patchKeys` fields.

## Impact

- Affected frontend files:
  - `deck-go/frontend-new/package.json`
  - `deck-go/frontend-new/src/main.tsx`
  - `deck-go/frontend-new/src/deck-ui/ui-store.tsx`
  - `deck-go/frontend-new/src/deck-ui/types.ts`
  - `deck-go/frontend-new/src/api.ts`
  - `deck-go/frontend-new/src/lib/gateway-client.ts`
  - new `deck-go/frontend-new/src/data/**`
  - related `frontend-new` tests and protocol docs
- Contract sources read before implementation:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-streams.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-config-write-safety.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json`
  - `deck-go/contracts/source/deck-ui.contract.json`
- Runtime read paths covered by this foundation:
  - BFF `GET /bootstrap/status` via `fetchBootstrapStatus()`
  - BFF `GET /runtime/gateway` via `fetchRuntimeGatewayStatus()`
  - Gateway RPC transport wrapper through `/api/v1/runtimes/{runtimeId}/gateway/rpc`, with no browser direct-to-Gateway calls
- Verification impact:
  - `cd deck-go/frontend-new && npm run test:deck-ui`
  - `cd deck-go && make frontend-build`
  - `cd deck-go && make contract-gate` or narrower checks when no contract source changes
  - L4 mock-functional cache/navigation evidence for the runtime summary path
  - L5 real-gateway runtime summary/navigation evidence when the real stack is available; otherwise record a circuit-breaker handoff with logs

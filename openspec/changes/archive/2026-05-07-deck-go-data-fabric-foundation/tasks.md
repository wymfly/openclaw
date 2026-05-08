## 1. Contract And Code Truth Baseline

- [x] 1.1 Re-read `docs/superpowers/specs/2026-05-08-frontend-data-fabric-design.md` and record any implementation-affecting mismatch in this change's artifacts before editing code.
- [x] 1.2 Inspect and cite the contract sources named in `proposal.md` that affect foundation scope: endpoints, streams, live projections, list queries, mutations, write safety, route governance, dynamic surfaces, UI metadata, and DTO source.
- [x] 1.3 Inspect current runtime summary code paths in `frontend-new/src/deck-ui/ui-store.tsx`, `frontend-new/src/api.ts`, `frontend-new/src/lib/gateway-client.ts`, and `frontend-new/src/main.tsx`.
- [x] 1.4 Confirm whether this foundation changes any generated contract source; if not, record that no contract sync is expected and use contract checks only as drift gates.

## 2. Data Fabric Foundation

- [x] 2.1 Add TanStack Query v5 to `deck-go/frontend-new/package.json` without adding unrelated dependencies.
- [x] 2.2 Add `frontend-new/src/data/client/query-client.tsx` with one app-level `QueryClient` factory, conservative query defaults, `retry: false` mutation defaults, and no offline replay.
- [x] 2.3 Add `frontend-new/src/data/client/scoped-query-provider.tsx` and mount it once in the normal app entry path above `DeckGoApp`.
- [x] 2.4 Add `frontend-new/src/data/contracts/freshness.ts` with the 8 named freshness presets and unit tests for deterministic option mapping.
- [x] 2.5 Add `frontend-new/src/data/contracts/query-keys.ts` with stable runtime and representative domain key factories plus unit tests for key stability and serializability.

## 3. Transports, Errors, And Test Provider

- [x] 3.1 Add BFF transport helpers that wrap existing BFF functions without representing BFF routes as Gateway RPC methods.
- [x] 3.2 Add Gateway RPC transport helpers that wrap `createDeckGatewayClient()` and continue routing through `/api/v1/runtimes/{runtimeId}/gateway/rpc`.
- [x] 3.3 Add Data Fabric error types and normalization helpers that preserve status, upstream code, request id, trace/base-hash details when available.
- [x] 3.4 Add read retry policy tests proving retry applies only to controlled read failures and never changes mutation defaults.
- [x] 3.5 Add `DataFabricTestProvider` with isolated query client, mock BFF/Gateway transport injection, and call recording.

## 4. Runtime Summary Migration

- [x] 4.1 Add `frontend-new/src/data/queries/runtime.ts` runtime keys and hooks for bootstrap status and runtime gateway status using BFF-backed paths.
- [x] 4.2 Refactor `DeckUIProvider` to consume Data Fabric runtime query hooks and remove the fixed `SUMMARY_REFRESH_MS` interval.
- [x] 4.3 Preserve existing `DeckUIState` fields and `refreshRuntimeSummary()` facade for current panels, but back manual refresh with Data Fabric invalidation/refetch.
- [x] 4.4 Preserve auth-required behavior for missing/invalid access tokens and keep existing default-token unlock behavior covered by tests.
- [x] 4.5 Add or update focused `ui-store` and runtime query tests for first load, auth-required failure, manual refresh, cached fresh return, and background refresh preserving cached data.

## 5. Live Invalidation Foundation

- [x] 5.1 Add `frontend-new/src/data/live-invalidation.ts` skeleton that consumes current live projection metadata fields only.
- [x] 5.2 Implement runtime-liveness invalidation for `runtime.gateway.status`, `runtime.gateway.health`, and `runtime.gateway.exit` without requiring generated `patchStrategy` or `patchKeys`.
- [x] 5.3 Add tests proving projection/gap handling marks stale or invalidates through current contract fields and does not depend on nonexistent generated patch fields.

## 6. Protocol And Documentation

- [x] 6.1 Update `deck-go/frontend-new/CLAUDE.md` or the active frontend protocol docs to require Data Fabric for new server-state reads and to keep UI state outside Data Fabric.
- [x] 6.2 Update `deck-go/docs/project/stack-decisions.md` or the appropriate project stack doc to lock TanStack Query v5 as the server-state choice.
- [x] 6.3 Document explicitly that mutation retry, offline mutation queueing, IndexedDB persistence, custom oxlint, and generated projection patch fields are deferred unless a later OpenSpec change adds them.

## 7. Verification And Archive Readiness

- [x] 7.1 Run `openspec validate deck-go-data-fabric-foundation --strict` and fix any proposal/spec/task issues.
- [x] 7.2 Run `cd deck-go/frontend-new && npm run test:deck-ui`; record passing output or focused failure evidence.
- [x] 7.3 Run `cd deck-go && make frontend-build`; record passing output or focused failure evidence.
- [x] 7.4 Run `cd deck-go && make contract-gate` unless task 1.4 proves a narrower contract check is sufficient; record the chosen command and evidence.
- [x] 7.5 Run L4 mock-functional evidence for runtime summary cache/navigation behavior, or add a focused Playwright/mock test if no existing spec covers it.
- [x] 7.6 Attempt L5 real-gateway runtime summary/navigation evidence. If two focused attempts fail due to environment/runtime startup, record command output and logs as circuit-breaker handoff rather than marking the scenario verified.
- [x] 7.7 Audit the implementation for forbidden deferred features: no automatic mutation retry, no offline mutation queue, no IndexedDB persistence, no custom oxlint, and no generated projection patch fields.
- [x] 7.8 Update `verification.yaml` with scenario statuses, commands, and evidence; mark `archiveReady: true` only after all required non-circuit-breaker scenarios are verified.

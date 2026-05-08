# Frontend Data Fabric for deck-go/frontend-new

**Date**: 2026-05-08  
**Status**: final design baseline for OpenSpec proposal  
**Scope**: `deck-go/frontend-new/` server state, live invalidation, data-layer UX, test support, and migration governance  
**Decision**: Use the Codex server-state design as the implementation spine, with code truth and generated contracts as the controlling implementation authority.

This document is the merged design baseline. Code and generated contracts remain the final truth; this document is the decision record that guides the next OpenSpec proposal.

---

## 1. Current Truth

`deck-go/frontend-new/` currently has no locked server-state library. Most panels still own data lifecycle with local state or store methods such as `load*`, `fetch*`, or `refresh*`, usually triggered from `useEffect`.

Current facts:

- `deck-go/frontend-new/src/components/panels/` has 26 panel directories.
- `DeckUIProvider` owns runtime/bootstrap summary polling through `fetchBootstrapStatus()` and `fetchRuntimeGatewayStatus()`.
- `lib/gateway-client.ts` already exposes a generated Gateway RPC client, but browser code reaches Gateway only through the deck-go backend route `/api/v1/runtimes/{runtimeId}/gateway/rpc`.
- BFF routes such as `/bootstrap/status`, `/runtime/gateway`, `/deck/agents`, `/sessions`, `/logs`, and `/usage/*` are first-class data sources. They are not Gateway RPC method names.
- `hooks/useLiveProjectionSubscription.ts` and `lib/deck-ws-transport.ts` already provide live stream primitives.
- `contracts/source/deck-live-projections.contract.json` currently defines projection id, stream, events, `refreshEndpoints`, `staleAfterMs`, `gapPolicy`, and `cursorStorageKey`. It does not currently define `patchStrategy` or `patchKeys`.
- `contracts/source/deck-config-write-safety.contract.json` defines write safety semantics such as `baseHashMode`, `responseHashMode`, `conflictBehavior`, `idempotencyStatus`, `rollbackStatus`, and `auditStatus`.
- `frontend-new` package tests are run by `npm run test:deck-ui`; deck-go broad verification uses `make frontend-build`, `make contract-gate`, and `make verify` from `deck-go/`.

The product problem is not just excessive RPC calls. The control plane needs a coherent data architecture so each module can express:

- what source of truth it reads,
- how fresh that data must be,
- what invalidates it,
- how live stream events recover or patch it,
- what write conflict behavior applies,
- and how mock/real E2E proves the module works.

---

## 2. Goals

- Show cached data immediately on module return when data is fresh.
- Avoid duplicate requests across sibling components and repeated panel switches.
- Make refresh behavior explicit by data class, not by incidental component mount.
- Keep browser traffic routed through the deck-go backend only.
- Treat Gateway RPC, BFF endpoints, SSE projections, `openclaw.json`, and workspace/session files as distinct truth surfaces.
- Make mutations safe by default: no automatic retry, no automatic offline queue, and no optimistic patch unless rollback is clear.
- Keep chat's transcript streaming path specialized while moving surrounding query-like data into the shared data layer.
- Give every migrated module repeatable unit, mock-functional, and real-gateway verification standards.
- Support progressive migration until all server state paths use the Data Fabric.

## 3. Non-Goals

- Do not redesign the Go backend API surface in the first foundation change.
- Do not make browser code call Gateway directly.
- Do not force every module to migrate in the foundation slice.
- Do not force stream patch reducers before the current live projection contract can prove the mapping.
- Do not use server-state cache for local UI state such as selected row, modal open state, filters, form drafts, expanded sections, or temporary display preferences.
- Do not add offline mutation queueing in the first implementation.
- Do not add IndexedDB persistence until a privacy and data-retention policy is explicitly accepted.
- Do not add custom oxlint rules in the first implementation unless the OpenSpec change includes the required tooling work and verification.

---

## 4. Core Decisions

| #   | Decision                 | Final choice                                                                                                |
| --- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Q1  | Server-state library     | TanStack Query v5                                                                                           |
| Q2  | Migration shape          | Progressive migration, but all server state eventually moves to Data Fabric                                 |
| Q3  | Read sources             | Support both BFF endpoints and Gateway RPC adapters through deck-go backend                                 |
| Q4  | Live projection behavior | Start with contract-driven invalidation and gap recovery; allow opt-in patch reducers only when tested      |
| Q5  | Freshness classes        | 8 explicit classes derived from data semantics and contract sources                                         |
| Q6  | Mutations                | Conservative default: `retry: false`, no offline auto replay, explicit invalidation, optimistic opt-in only |
| Q7  | Cache isolation          | Single `QueryClient`; stable query-key prefixes include runtime and agent scope when applicable             |
| Q8  | Error UX                 | Shared error taxonomy plus `ConnectionBanner`, `ConflictDialog`, `ErrorState`, skeleton, stale indicator    |
| Q9  | Verification             | Unit + component + L4 mock-functional + L5 real-gateway evidence for migrated modules                       |
| Q10 | Governance               | OpenSpec tasks may be checked only after implementation and matching verification evidence                  |

---

## 5. Architecture

### 5.1 Directory Shape

Create `deck-go/frontend-new/src/data/` as the canonical server-state layer.

```text
frontend-new/src/
├── data/
│   ├── client/
│   │   ├── query-client.tsx
│   │   └── scoped-query-provider.tsx
│   ├── transport/
│   │   ├── bff.ts
│   │   ├── gateway-rpc.ts
│   │   └── mock-transport.ts
│   ├── contracts/
│   │   ├── freshness.ts
│   │   ├── query-keys.ts
│   │   ├── mutation-safety.ts
│   │   └── projection-policy.ts
│   ├── errors/
│   │   ├── error-types.ts
│   │   ├── error-handler.ts
│   │   └── retry-policy.ts
│   ├── queries/
│   │   └── runtime.ts
│   ├── modules/
│   │   └── <module>/
│   │       ├── keys.ts
│   │       ├── queries.ts
│   │       ├── mutations.ts
│   │       ├── projections.ts
│   │       └── index.ts
│   ├── live-invalidation.ts
│   ├── testing/
│   │   ├── DataFabricTestProvider.tsx
│   │   └── mock-gateway-runtime.ts
│   └── README.md
├── stores/
│   └── only UI state after migration
└── components/panels/<module>/
    └── import module hooks, not raw transport
```

Phase 0 should build the smallest useful subset: provider, query client, query keys, freshness policy, runtime queries, transport wrappers, basic error handling, and test provider. DevTools, prefetch, custom lint, persistence, and patch reducers are hardening layers, not prerequisites for the first slice.

### 5.2 Read Flow

There are two read source types:

```typescript
export type DeckQuerySource<TData> =
  | {
      kind: "bff";
      path: string;
      request: (signal: AbortSignal) => Promise<TData>;
    }
  | {
      kind: "gateway-rpc";
      method: GatewayMethodName;
      request: (client: DeckGatewayClient, signal: AbortSignal) => Promise<TData>;
    };
```

Examples:

- Runtime bootstrap uses BFF: `fetchBootstrapStatus()` / `/bootstrap/status`.
- Runtime Gateway status uses BFF: `fetchRuntimeGatewayStatus()` / `/runtime/gateway`.
- Generated Gateway protocol methods use `createDeckGatewayClient()`, which still calls deck-go backend `/api/v1/runtimes/{runtimeId}/gateway/rpc`.
- Module list/detail queries may use BFF endpoints or Gateway RPC depending on the contract chain for that module.

Panels should import domain hooks such as `useAgentsListQuery()` or `useRuntimeGatewayQuery()`. They should not import `deckFetch`, `gateway-client`, `useLiveProjectionSubscription`, or `useQueryClient` directly.

### 5.3 Query Keys and Scope

Query keys must be stable, serializable, and contract-shaped.

```typescript
deckKeys.runtime.bootstrap();
deckKeys.runtime.gateway();
deckKeys.agents.list();
deckKeys.agents.detail(agentId);
deckKeys.skills.list({ agentId });
deckKeys.sessions.list(filters);
deckKeys.sessions.detail(sessionKey);
deckKeys.usage.sessions(filters);
```

Scope prefixes:

- Global queries: no runtime or agent prefix, only when the data is truly global.
- Runtime-scoped queries: include `runtimeId`.
- Agent-scoped queries: include `runtimeId` and `agentId`.

Context switches:

| Switch                             | Cache action                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Runtime mode or runtime id changes | remove old runtime-scoped queries, close live streams, rebuild runtime-scoped transport |
| Agent changes                      | remove old agent-scoped queries, keep global and runtime-only queries                   |
| Logout or auth reset               | clear query cache and close streams                                                     |
| Reconnect                          | keep cache, invalidate active runtime and live-workbench queries                        |

---

## 6. Freshness Policy

Use 8 classes. The first implementation should encode these as named presets in `data/contracts/freshness.ts`.

| Tier               |  staleTime | gcTime | focus refetch | reconnect refetch | Examples                                                             |
| ------------------ | ---------: | -----: | ------------- | ----------------- | -------------------------------------------------------------------- |
| `static`           | `Infinity` |    24h | false         | false             | stable capabilities, schema metadata, mostly-static provider catalog |
| `runtime-liveness` |        10s |   5min | true          | always            | bootstrap status, runtime gateway status, gateway health             |
| `config-authority` |    60-120s |  30min | false         | always            | config, agents config, models config, channels, routing              |
| `inventory`        |        60s |  10min | false         | always            | agents, skills, models, plugins, nodes, sessions list                |
| `live-workbench`   |     10-30s |   5min | true          | always            | sessions, approvals, activity, monitor runs, agent status            |
| `historical`       |   60s-5min |  30min | false         | always            | usage, log history, monitor stats                                    |
| `lazy-detail`      |        60s |  10min | false         | always            | agent files, session detail, skill detail, docs, memory browse       |
| `stream-driven`    | `Infinity` |   5min | false         | true              | chat transcript and log tail when reducers own the displayed data    |

Global query default:

```typescript
queries: {
  staleTime: 60_000,
  gcTime: 30 * 60_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: "always",
  retry: controlledReadRetry,
}
mutations: {
  retry: false,
  networkMode: "online",
}
```

Important UI rule: background refresh failure must not blank cached data. First-load failure can show a blocking `ErrorState`; refresh failure with cached data should show a non-blocking stale/error indicator.

---

## 7. Mutation Safety

Mutation behavior is driven by contracts, especially `deck-config-write-safety.contract.json` and `deck-mutations.contract.json`.

```typescript
export type BaseHashMode =
  | "not-applicable"
  | "client-required"
  | "client-optional"
  | "backend-derived";

export type ConflictBehavior =
  | "not-applicable"
  | "frontend-preserves-local"
  | "upstream-error-preserved"
  | "frontend-refreshes-after-failure";

export interface ScopedMutationOptions<TData, TVars> {
  mutationFn: (transport: DataFabricTransport, vars: TVars) => Promise<TData>;
  invalidates: readonly (readonly unknown[])[];
  baseHashMode?: BaseHashMode;
  conflictBehavior?: ConflictBehavior;
  optimistic?: {
    target: readonly unknown[];
    update: (oldData: unknown, vars: TVars) => unknown;
    rollbackIsExact: true;
  };
  onSuccessSetData?: (
    data: TData,
    vars: TVars,
  ) => Array<{
    key: readonly unknown[];
    value: unknown;
  }>;
}
```

Hard rules:

- Mutations default to `retry: false`.
- No mutation is queued for automatic offline replay in the first implementation.
- If offline, write buttons should be disabled or show "Reconnect required"; they must not say queued unless queueing is explicitly implemented for that action.
- A mutation may opt into retry only when its contract marks it idempotent or a dedicated OpenSpec change proves replay safety.
- Optimistic update is allowed only when rollback is exact and covered by tests.
- `onSuccess` invalidates declared keys. It does not write arbitrary cache data unless the mutation response contains the full authoritative new state and the hook declares `onSuccessSetData`.
- Conflict UI is selected by `conflictBehavior`.

Conflict behavior:

| Behavior                           | UI                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `frontend-preserves-local`         | open `ConflictDialog` with local vs remote diff and explicit user choice |
| `upstream-error-preserved`         | show upstream detail in toast or inline error                            |
| `frontend-refreshes-after-failure` | invalidate affected queries, keep local form state, ask user to retry    |
| `not-applicable`                   | route through normal error handling                                      |

---

## 8. Live Projection and Invalidation

Current live projection contract authority:

- `id`
- `panel`
- `stream`
- `events`
- `refreshEndpoints`
- `staleAfterMs`
- `gapPolicy`
- `cursorStorageKey`

Initial implementation must use these fields, not assumed `patchStrategy` or `patchKeys` fields.

Default live behavior:

1. Subscribe through existing `useLiveProjectionSubscription`.
2. Normalize legacy aliases from `deck-streams.contract.json`.
3. On a known event, invalidate query keys mapped from `refreshEndpoints` or module-specific query policy.
4. On `projection.gap`, mark the projection stale and refresh authoritative endpoints when `gapPolicy` is `refresh`.
5. Preserve cached UI while refresh runs.

Opt-in patch behavior:

- Patch reducers live in `data/modules/<module>/projections.ts`.
- A projection can use patch only after the module has reducer unit tests for every event it patches.
- The first implementation can keep patch policy in `data/contracts/projection-policy.ts` as a code-level overlay.
- If patch policy becomes a long-term contract, a separate OpenSpec change must extend `contracts/source/deck-live-projections.contract.json`, update `contracts/scripts/sync-live-projection-contract.mjs`, regenerate generated files, and pass `make live-projection-contract-check` plus `make contract-gate`.

Projection examples:

| Projection               | First implementation                                                  | Notes                              |
| ------------------------ | --------------------------------------------------------------------- | ---------------------------------- |
| `agent-status`           | invalidate agents list/detail; patch may be added after reducer tests | good reference candidate           |
| `session-list`           | invalidate sessions list; patch later                                 | live-workbench behavior            |
| `approval-queue`         | invalidate approvals pending/list; patch later                        | conflict-sensitive                 |
| `log-tail`               | keep existing stream behavior until log reducer is isolated           | do not force query cache too early |
| `chat-session`           | keep chat dispatcher; move surrounding session/history queries first  | chat remains separate OpenSpec     |
| refresh-only projections | use freshness and manual invalidation only                            | no stream subscription             |

---

## 9. Error and Loading UX

### 9.1 Shared Patterns

| Pattern                          | Display rule                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `ConnectionBanner`               | App shell only; shown for reconnecting/offline runtime or stream state                |
| `ConflictDialog`                 | Global mount; opened only for `frontend-preserves-local` conflicts                    |
| `ErrorState`                     | Full panel fallback only when first load fails and there is no cached data            |
| `RowSkeleton` / `DetailSkeleton` | First-load only: `isLoading && !data`                                                 |
| `StaleIndicator`                 | Non-blocking marker when projection gap or refresh failure leaves cached data visible |

### 9.2 Query Display Rules

| Cache state   | Fetch state    | UI                                  |
| ------------- | -------------- | ----------------------------------- |
| no cache      | fetching       | skeleton                            |
| no cache      | failed         | blocking error state                |
| cache fresh   | idle           | data only                           |
| cache stale   | fetching       | data plus subtle top progress       |
| cache present | refresh failed | data plus inline non-blocking error |

Do not replace cached data with a spinner during background refresh.

### 9.3 Error Taxonomy

Transport and RPC errors should be normalized into a shared error type:

```typescript
export type DataFabricErrorKind =
  | "auth"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "server"
  | "network"
  | "timeout"
  | "aborted"
  | "unknown";
```

The normalized error should retain status, upstream code, request id, trace id, base hash details, and original cause when available.

---

## 10. Testing and Acceptance

### 10.1 Foundation Acceptance

Minimum foundation scope:

- TanStack Query dependency and provider mounted once at app root.
- Query keys are stable and tested.
- Freshness policy presets are tested.
- Runtime/bootstrap summary uses Data Fabric query hooks.
- Browser network observation proves fresh panel return does not refetch.
- Gateway/runtime reconnect invalidates runtime-liveness queries.
- No browser direct-to-Gateway calls are introduced.

Verification:

```bash
cd deck-go/frontend-new && npm run test:deck-ui
cd deck-go && make frontend-build
cd deck-go && make contract-gate
```

Use narrower contract checks when only one contract surface changes, for example:

```bash
cd deck-go && make live-projection-contract-check
cd deck-go && make list-query-contract-check
cd deck-go && make config-write-safety-check
```

### 10.2 Per-Module Acceptance

Every migrated module must prove:

- first load shows correct skeleton, empty, and error states;
- return with fresh cache renders immediately without duplicate request;
- concurrent consumers share one request;
- mutation hooks declare invalidation and safety behavior;
- mutation UI does not full-page reload;
- background refresh failure preserves cached data;
- L4 mock-functional E2E covers happy, empty, error, and representative live invalidation;
- L5 real-gateway E2E covers navigation, theme, locale, and at least one read path; write paths run when the test fixture can isolate data safely.

### 10.3 E2E Levels

| Level              | Purpose                                                     | Stack                             |
| ------------------ | ----------------------------------------------------------- | --------------------------------- |
| L1 unit            | keys, policies, reducer, retry/error logic                  | vitest                            |
| L2 hook            | query cache, mutation rollback, conflict routing            | vitest + React Testing Library    |
| L3 panel           | panel rendering and data states                             | vitest + `DataFabricTestProvider` |
| L4 mock-functional | browser-visible module behavior with deterministic fixtures | mock stack                        |
| L5 real-gateway    | real deck-go backend and OpenClaw Gateway path              | real stack                        |

---

## 11. Migration Plan

### Phase 0: Foundation

Implement only the reusable foundation and runtime query migration.

Tasks:

1. Add TanStack Query and app provider.
2. Add query key and freshness policy modules.
3. Add BFF and Gateway RPC transport wrappers.
4. Add normalized error types and basic global query/mutation handlers.
5. Add `DataFabricTestProvider`.
6. Migrate runtime/bootstrap summary out of `DeckUIProvider` polling.
7. Document "no new naked `useEffect(fetchX)` server-state lifecycle" in the frontend protocol.
8. Verify with `npm run test:deck-ui`, `make frontend-build`, and relevant contract checks.

Exit:

- existing panels remain visually unchanged;
- runtime summary no longer depends on duplicated local polling state;
- fresh navigation does not re-fetch runtime summary unnecessarily;
- implementation does not include mutation queue, IndexedDB persistence, or custom lint rules.

### Phase 1: Reference Module

Migrate `agents` first unless the OpenSpec proposal explicitly chooses a smaller read-only module as a spike. `agents` is the best reference because it exercises related skills, models, subagents, tools, config writes, files, and live status projection.

Exit:

- `agents` panel uses `data/modules/agents` hooks for server state;
- store retains only UI state;
- config/write mutations use contract-derived base hash and conflict behavior;
- representative L4 and L5 checks pass or document an environment circuit breaker.

### Phase 2: Config and Inventory Modules

Migrate skills, models, channels, routing, nodes, settings, plugins, docs, memory, and related inventory surfaces.

Focus:

- config-authority freshness;
- explicit invalidation maps;
- conflict-safe writes;
- no over-fetching on tab/panel switches.

### Phase 3: Live Workbench Modules

Migrate sessions, approvals, activity, gateway, usage, logs, alerts, budget, cron, threads, webhooks, and other live or historical surfaces.

Focus:

- live invalidation and projection gaps;
- cached-data preservation;
- real-gateway navigation parity.

### Phase 4: Chat Surroundings

Chat transcript streaming remains specialized. Move session list, snapshot, history, command discovery, approvals, compaction metadata, and non-transcript query-like data into Data Fabric.

### Phase 5: Governance Sweep

Exit:

- no unapproved server-state `useEffect(fetchX)` remains in panels;
- stores no longer own server fetch lifecycle;
- remaining exceptions have code references and a reason;
- optional hardening work can add custom lint, devtools, prefetch, persistence, or patchStrategy contract extension.

---

## 12. OpenSpec Split

Recommended change matrix:

```text
openspec/changes/
├── deck-go-data-fabric-foundation/
├── deck-go-data-fabric-agents-reference/
├── deck-go-data-fabric-config-inventory/
├── deck-go-data-fabric-live-workbench/
├── deck-go-data-fabric-chat-surroundings/
└── deck-go-data-fabric-governance-sweep/
```

Each child proposal must include:

- module contract sources read before design;
- exact BFF endpoints and Gateway RPC methods used;
- freshness tier selection;
- query keys;
- mutation invalidation and safety behavior;
- live projection behavior;
- mock and real E2E acceptance;
- circuit-breaker criteria for real-gateway environmental failures.

---

## 13. Contract Source Map

Panel authors must inspect relevant contract sources before writing module data hooks.

| Contract source                                                    | Role                                                              |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `deck-go/contracts/source/deck-api.contract.ts`                    | DTO source for generated Deck API types                           |
| `deck-go/contracts/source/deck-endpoints.contract.json`            | BFF endpoint classification                                       |
| `deck-go/contracts/source/deck-streams.contract.json`              | SSE event names, payload status, legacy aliases                   |
| `deck-go/contracts/source/deck-live-projections.contract.json`     | projection stream, refresh endpoints, stale threshold, gap policy |
| `deck-go/contracts/source/deck-list-queries.contract.json`         | list query pagination and parameter semantics                     |
| `deck-go/contracts/source/deck-mutations.contract.json`            | mutation request/response shape                                   |
| `deck-go/contracts/source/deck-config-write-safety.contract.json`  | base hash, conflict, idempotency, rollback, and audit semantics   |
| `deck-go/contracts/source/deck-route-governance.contract.json`     | route policy for auth/forbidden handling                          |
| `deck-go/contracts/source/deck-api-dynamic-surfaces.contract.json` | dynamic-surface exceptions                                        |
| `deck-go/contracts/source/deck-ui.contract.json`                   | panel and UI metadata                                             |

Protocol upgrade flow:

1. Change the source contract or DTO.
2. Run the matching sync/check target.
3. Commit generated artifacts and checksum/drift evidence.
4. Update Data Fabric module code to consume generated truth.
5. Run `make contract-gate` for broad contract changes.

Never edit generated contract outputs directly.

---

## 14. Implementation Workflow

This section captures the workflow rule for turning this design baseline into OpenSpec changes.

### 14.1 External Input Rule

External design or review input can be useful, but it is not a default workflow stage and is never an OpenSpec completion gate.

When the user provides external findings, Codex SHALL audit them against code truth and contracts before changing the proposal or implementation. Confirmed issues should be fixed directly. Unclear or disputed issues should be recorded as handoff notes.

External review is opt-in only and must not be added as a default OpenSpec completion gate unless the user explicitly asks for it for that change.

### 14.2 Required Division of Labor

Use this split for medium and large frontend/control-plane changes:

| Stage                          | Best owner      | Reason                                                                                                  |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------- |
| Product intent and constraints | User plus Codex | Product goals and boundaries must be explicit before proposal writing                                   |
| Code-truth and contract audit  | Codex           | Codex is operating in the repo and should verify current files, generated contracts, scripts, and tests |
| Final design synthesis         | Codex           | The final document must be implementable against code truth                                             |
| OpenSpec proposal              | Codex           | Proposal/tasks/spec deltas must use exact repo commands and acceptance criteria                         |
| Implementation                 | Codex           | It can directly edit, test, and iterate in the active worktree                                          |
| Final real E2E                 | Codex plus user | Codex drives browser/test evidence; user validates product feel                                         |

### 14.3 Recommended Pattern

For complex modules:

1. User states product intent and constraints.
2. Codex explores code truth, generated contracts, Gateway/OpenClaw capability, current UI, tests, and scripts.
3. Codex turns product intent plus verified code truth into the final design baseline.
4. Codex creates OpenSpec proposal from that baseline.
5. Codex implements in small vertical slices with strict verification.

If the user provides external review findings separately, Codex treats them as new input, audits them against code truth, fixes confirmed issues directly, and records unresolved issues. External review is not a default workflow stage or an OpenSpec completion gate.

For smaller changes, Codex can explore, propose, implement, and verify directly.

### 14.4 Decision Rule

Use the full Codex explore -> OpenSpec -> implement -> verify path when any of these are true:

- the change crosses product design, contract chain, backend, frontend, and E2E;
- the UI/UX is likely to drift without explicit design language;
- module behavior depends on multiple Gateway/OpenClaw capabilities;
- the implementation will become a reusable pattern for later modules.

Use a narrower Codex-only edit/test loop when the task is narrow, code-local, or already has a clear OpenSpec design.

---

## 15. Remaining Open Questions for OpenSpec

The OpenSpec proposal should decide these explicitly:

- Whether TanStack Query DevTools is included in foundation or deferred to hardening.
- Whether `useScopedQuery` is a required low-level wrapper or whether modules use query option factories directly.
- Whether `agents` is the first reference module or whether a smaller read-only module is used as a technical spike before agents.
- Whether patch reducer policy remains a code overlay or becomes a generated contract field in a later proposal.
- Which real-gateway writes are safe enough for automated L5 E2E, and which require user-assisted manual validation.

---

**End of design.**

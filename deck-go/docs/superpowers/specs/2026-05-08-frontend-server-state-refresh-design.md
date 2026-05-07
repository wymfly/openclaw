# Frontend Server-State Refresh Design

**Date:** 2026-05-08  
**Scope:** `deck-go/frontend-new` data refresh architecture  
**Decision:** Adopt TanStack Query as the shared server-state layer and migrate all modules progressively.

## Context

`frontend-new` currently has no locked server-state library. Most panels call `fetchX()` from `useEffect()` and keep local `loading/error/data` state. This makes page switches feel like a fresh RPC every time, even when data was just loaded. The current exceptions are:

- `DeckUIProvider`, which polls bootstrap/runtime summary every 30 seconds.
- `useLiveProjectionSubscription`, which consumes Deck SSE streams and lets each panel decide how to recover.
- Chat, which has a specialized streaming store for transcript/runtime events.

This design turns those pieces into a coherent data architecture without changing the OpenClaw Gateway contract chain. Browser code still talks only to the deck-go backend.

## Goals

- Preserve a smooth control-plane UX: switching modules should show cached data immediately when it exists.
- Avoid redundant Gateway RPC calls across panels and sibling components.
- Make refresh semantics explicit by data type, not by incidental component mount behavior.
- Use OpenClaw/deck-go truth sources correctly: Gateway RPC, BFF-shaped endpoints, SSE projections, `openclaw.json` config snapshots, and workspace/session files.
- Keep gradual implementation possible while making full migration of all modules the end state.
- Preserve chat's specialized streaming behavior while moving chat's surrounding server data into the shared query layer.

## Non-Goals

- This does not redesign backend APIs.
- This does not replace contract generation.
- This does not make browser code call Gateway directly.
- This does not require every module to be migrated in the first implementation slice.
- This does not use query caching for local UI state such as selected rows, open tabs, form drafts, modals, or expanded sections.

## Chosen Approach

Use TanStack Query as the `frontend-new` server-state layer.

Rejected alternatives:

- **Fetch-layer TTL cache only.** It would reduce some duplicate requests but would not give panels a clear query/mutation/invalidation model.
- **One-shot full migration.** It would converge faster on paper but creates too much regression risk across panels that still need product and real E2E refinement.

The project will use a progressive migration: install the data layer first, migrate foundational runtime data, then migrate modules one by one until all server state has moved to TanStack Query.

## State Boundaries

### Server State

Managed by TanStack Query. This includes any data loaded from deck-go backend endpoints or Gateway-backed RPC adapters:

- Runtime and Gateway status.
- Agents, skills, models, channels, routing, nodes, approvals, usage, sessions, activity, logs, settings, docs, memory, and config snapshots.
- Detail data such as agent files, session detail, skill hub detail, memory browse results, and monitor run detail.

### Live Projection State

Managed by the existing SSE transport plus a new query invalidation bridge.

SSE is not the authoritative store. It is a signal source used to patch or invalidate queries and to recover from projection gaps. Existing projection contracts in `contracts/source/deck-streams.contract.json` and generated live projection metadata remain the authority for stream names, events, gaps, and refresh endpoints.

### UI State

Managed by React local state or existing UI stores. This includes:

- Active panel, selected row, active tab, filters, sort order, drawer/modal open state.
- Form drafts and unsaved edits.
- Temporary optimistic UI flags.
- Chat transcript streaming state that is not naturally represented as a REST/RPC query result.

Panel code should not own server data lifecycle after migration.

## Data Layer Shape

Create `frontend-new/src/data/` with:

- `query-client.tsx`  
  Creates the `QueryClient`, default policies, provider, and optional dev diagnostics.

- `query-policy.ts`  
  Names shared policy presets such as `runtimeStatus`, `configAuthority`, `liveWorkbench`, `historicalAnalytics`, and `lazyDetail`.

- `query-keys.ts`  
  Canonical key factory. Query keys must be stable, serializable, contract-shaped, and grouped by domain.

- `queries/`  
  Query option factories and hooks such as `useAgentsListQuery()`, `useSkillsQuery()`, and `useRuntimeGatewayQuery()`.

- `mutations/`  
  Mutation hooks with explicit invalidation maps. Components should not manually reload whole pages after mutation.

- `live-invalidation.ts`  
  Maps SSE events and projection-gap metadata to query invalidations or targeted cache patches.

Query key examples:

```ts
deckKeys.runtime.gateway();
deckKeys.gateway.health();
deckKeys.agents.list();
deckKeys.agents.detail(agentId);
deckKeys.agents.files(agentId);
deckKeys.skills.list({ agentId });
deckKeys.sessions.list(filters);
deckKeys.sessions.detail(sessionKey);
deckKeys.models.config();
deckKeys.routing.bindings(filters);
```

Keys must not include raw function references, class instances, unstable object identities, or translated display text.

## Default Query Policy

TanStack Query's official defaults treat cached data as stale unless configured and can refetch stale queries on mount, focus, or reconnect. Deck should override those defaults to avoid recreating the current "panel mount equals RPC" behavior.

Global default:

```ts
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
}
```

Policy overrides by data type:

| Data type                      | Examples                                                                 | Policy                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Runtime/Gateway liveness       | bootstrap, runtime gateway, gateway health/status, capabilities          | `staleTime: 10s`; low-frequency background refresh remains allowed; `runtime.gateway.*` events invalidate immediately   |
| Config authority               | config, models config, agents config, skills enabled, channels, routing  | `staleTime: 60-120s`; no high-frequency polling; mutation invalidates exact affected keys; preserve base hash semantics |
| Inventory/catalog              | agents, skills, models, plugins, nodes, devices                          | `staleTime: 60s`; event-driven when stream coverage exists; otherwise manual refresh or reconnect recovery              |
| Live workbench                 | sessions, approvals, activity, monitor runs, agent status                | `staleTime: 10-30s`; SSE patch/invalidate first; projection gap forces authoritative endpoint refresh                   |
| Historical/analytics           | usage cost/providers/sessions, monitor stats, log history                | `staleTime: 60s-5min`; default no aggressive polling                                                                    |
| Lazy detail                    | agent files, skill hub detail, session detail, doc detail, memory browse | `enabled` only when selected; keep previous data during parameter changes                                               |
| Non-idempotent mutation result | send, compact, run cron, approve, delete, install, logout                | no automatic retry; explicit invalidation; optimistic update only when rollback is clear                                |

Background refresh failure must not blank already cached data. If cached data exists, show a non-blocking stale/error indicator. Only first-load failure should show a blocking error state.

## Mutation Invalidation

Every mutation must define its invalidation map near the mutation hook. Components must not scatter ad hoc reloads after save actions.

Examples:

- `agents.update(agentId)` invalidates:
  - `agents.list()`
  - `agents.detail(agentId)`
  - `agents.rawConfig(agentId)`
  - related skill/subagent/tool projections when the payload touches those fields

- `skills.update(skillKey)` invalidates:
  - `skills.list(...)`
  - `skills.byAgent(agentId)` when applicable
  - affected agent detail views

- `models.config.patch` invalidates:
  - `models.config()`
  - `models.configured()`
  - model auth/catalog queries when relevant
  - agent detail model projections
  - command discovery if model-backed commands depend on the changed config

- `runtime.gateway.restart` invalidates:
  - runtime gateway status
  - gateway health/status/describe
  - capabilities
  - live workbench queries after reconnect

For config writes, stale base hashes must be treated as conflict signals. Query cache should preserve current hash and refresh after successful patch/apply.

## SSE Invalidation

`useLiveProjectionSubscription` should gain an integration path that can dispatch to `QueryClient`.

Initial mapping:

| Event                                                                      | Query action                                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `runtime.gateway.status`, `runtime.gateway.health`, `runtime.gateway.exit` | invalidate runtime gateway, bootstrap, gateway health/status, capabilities                         |
| `sessions.changed`, `session-state`                                        | invalidate session list and active session detail/snapshot                                         |
| `session.message`, `session-msg`, `session.tool`, `session-tool`           | keep chat dispatcher behavior; patch or invalidate active session detail and session list metadata |
| `agent.status.changed`                                                     | patch agent status when safe; otherwise invalidate agents list/detail                              |
| `activity.event`                                                           | invalidate or append activity/monitor projections                                                  |
| `approval.pending`, `approval.resolved`                                    | patch pending approvals and invalidate approvals list                                              |
| `device.pair.requested`, `device.pair.resolved`                            | invalidate devices and self device                                                                 |
| `commands.changed`                                                         | invalidate command discovery keys                                                                  |
| `projection.gap`                                                           | use live projection metadata to refresh the authoritative endpoint/query keys                      |

Events are advisory. If an event cannot be decoded safely, prefer invalidating the authoritative query over inventing data.

## Migration Order

1. **Foundation**
   - Add TanStack Query dependency and provider.
   - Add query keys, policies, and query diagnostics.
   - Document the "no new naked `useEffect(fetchX)`" rule.

2. **Global runtime data**
   - Move bootstrap/runtime/gateway summary out of `DeckUIProvider` local polling into query hooks.
   - Keep auth unlock behavior, but let query invalidation/refetch own server-state refresh.

3. **Reference module**
   - Migrate `agents` first because it exercises related skills, models, subagents, tools, event streams, config, files, and status projections.
   - Use this as the module template for later OpenSpec work.

4. **Config and inventory modules**
   - Migrate skills, models, channels, routing, nodes, settings.
   - Focus on mutation invalidation and base-hash-safe config updates.

5. **Live modules**
   - Migrate sessions, approvals, activity, gateway, usage, logs.
   - Focus on SSE invalidation, gap recovery, and avoiding background-refresh UI flicker.

6. **Chat surroundings**
   - Keep the specialized streaming transcript store.
   - Move session list, snapshot, history, compaction, approvals, and command discovery around chat into query hooks.

7. **Sweep**
   - Audit all panels for naked server fetch lifecycle.
   - Remaining exceptions require an explicit source-linked reason.

## Implementation Rules

- New module work must use query hooks for server state.
- Existing module work must migrate touched server-state paths when the scope is relevant.
- Query hooks must use canonical key factories.
- Mutations must declare invalidation or cache patch behavior.
- Components may call `refetch()` for explicit user refresh, but may not bypass the data layer.
- Browser code continues to call deck-go backend only.
- No direct import of Gateway transport into panel code.
- Query keys and policies are architecture surfaces and should be tested.

## Testing And Acceptance

Minimum acceptance for the foundation:

- Unit tests cover query key stability and policy presets.
- Query provider is mounted once at app root.
- Runtime/bootstrap summary works through query hooks.
- Network observation proves switching away and back does not refetch fresh data.
- Gateway reconnect invalidates runtime/gateway queries.

Minimum acceptance per migrated module:

- First load shows proper skeleton/error.
- Returning to the module with fresh cache shows data immediately and background refresh only when stale.
- Concurrent consumers of the same data issue one request.
- Mutations update the UI without full page reload.
- Mutation invalidation is covered by tests.
- Background refresh failure keeps existing data visible.
- Real or mock E2E verifies no unexpected browser-to-Gateway direct calls.

Sweep acceptance:

- No unapproved `useEffect(fetchX)` server-state lifecycle remains in panels.
- Remaining exceptions are documented with code references and a reason.
- All module README / implementation notes updated where module convergence work requires it.

## Risks

- Temporary mixed architecture can confuse future changes. Mitigation: add clear "new server state goes through `src/data`" rule and migrate touched areas.
- Too-broad invalidation can recreate the current over-fetching problem. Mitigation: test invalidation maps and prefer domain keys.
- Too-aggressive optimistic updates can show false Gateway state. Mitigation: only optimistic update for local, reversible UI projections.
- Chat streaming state can be overfit into query cache. Mitigation: keep transcript streaming store separate and move only surrounding query-like data.
- Introducing a new dependency affects stack governance. Mitigation: update stack decisions when implementation begins.

## Open Questions For Implementation

- Whether to enable TanStack Query Devtools in local dev only.
- Whether route/panel prefetch should happen on nav hover or only after first visit.
- Which module after `agents` should be second: `skills` if prioritizing config/catalog convergence, or `sessions` if prioritizing live workbench behavior.

## References

- TanStack Query Important Defaults: https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults
- TanStack Query Query Invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Deck live projection contract: `contracts/source/deck-streams.contract.json`
- Deck endpoint classification: `contracts/source/deck-endpoints.contract.json`
- Current frontend stack decisions: `docs/project/stack-decisions.md`

## Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Consistency check: the architecture keeps browser-to-backend-only access and treats SSE as invalidation/advisory, not authority.
- Scope check: this is a single architecture change with progressive module migration, suitable for an OpenSpec proposal and multiple vertical implementation slices.
- Ambiguity check: full migration of all modules is the final state; "progressive" only describes sequencing.

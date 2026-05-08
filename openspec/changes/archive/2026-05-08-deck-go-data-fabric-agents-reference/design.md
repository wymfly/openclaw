## Context

The Data Fabric foundation is now mounted in `frontend-new`, but Agents still uses
the pre-Data-Fabric pattern: the list is fetched by `useAgentsStore`, detail
sections load through component-local `useEffect(fetch*)` blocks, and mutations
manually refresh store state after writes. Agents is the right first reference
module because its data surface exercises the full deck-go contract chain:
generated Gateway RPC for `agents.list`, Deck BFF reads/writes for detail and
config-derived sections, live `agent-status` projection events, protected
`main` behavior, config-hash write safety, files, identity, configured model
lookup, and real Gateway fixture constraints.

The implementation must treat code and contracts as the final authority. The
contract sources that govern this change are:

- `contracts/source/deck-api.contract.ts`
- `contracts/source/deck-endpoints.contract.json`
- `contracts/source/deck-live-projections.contract.json`
- `contracts/source/deck-list-queries.contract.json`
- `contracts/source/deck-mutations.contract.json`
- `contracts/source/deck-config-write-safety.contract.json`
- `contracts/source/deck-route-governance.contract.json`
- `contracts/source/deck-ui.contract.json`
- generated Gateway protocol/client types for `agents.*` / `deck.agents.*`

## Goals / Non-Goals

**Goals:**

- Add `frontend-new/src/data/modules/agents/` as the first reusable module
  pattern for Data Fabric.
- Move Agents server-state reads and writes behind query/mutation option
  factories and hooks while preserving the existing product surface.
- Keep BFF endpoint/action strings centralized in the existing API facade.
- Make freshness tiers, query keys, mutation invalidation, conflict behavior,
  live invalidation, and real-gateway circuit breaking explicit and testable.
- Leave `useAgentsStore` responsible only for UI/local interaction state and
  any non-authoritative live display overlay that remains necessary.

**Non-Goals:**

- Do not redesign the Agents visual layout in this change.
- Do not introduce direct browser-to-Gateway calls.
- Do not add automatic mutation retry, offline mutation queues, IndexedDB
  persistence, custom lint rules, or generated live projection patch fields.
- Do not implement patch reducers for `agent-status` unless the reducer and
  rollback behavior are covered by focused tests in this change.
- Do not run unsafe real Gateway writes unless the E2E fixture is run-scoped and
  cleanup can prove it will not touch non-test agents.

## Decisions

### Decision: keep `src/api.ts` as the transport facade

Agents Data Fabric hooks will wrap the existing frontend facade functions such
as `fetchAgentsList`, `fetchAgentDetail`, `fetchAgentSkills`,
`updateAgentSkills`, `createAgent`, and `deleteAgent`. The module will not move
raw BFF paths or `POST /deck/agents` action strings into React components.

Rationale: `src/api.ts` already centralizes Gateway RPC normalization, BFF
route construction, mutation acknowledgement handling, and DTO imports. Moving
paths into hooks would duplicate contract knowledge and weaken the existing
route-governance boundary.

Alternative considered: call `deckFetch` or `createDeckGatewayClient` directly
from module hooks. Rejected because it would create a second transport boundary
inside the business module and make later contract-gate audits harder.

### Decision: use module-local query keys with shared prefixes

Agents will expose stable keys from `data/modules/agents/keys.ts`, including:

- `agentsKeys.list()`
- `agentsKeys.detail(agentId)`
- `agentsKeys.health()`
- `agentsKeys.skills(agentId)`
- `agentsKeys.subagents(agentId)`
- `agentsKeys.eventStreams(agentId)`
- `agentsKeys.toolPolicy(agentId)`
- `agentsKeys.systemPrompt(agentId)`
- `agentsKeys.files(agentId)`
- `agentsKeys.file(agentId, name)`
- `agentsKeys.identity(agentId)`

These keys must remain serializable and compatible with the shared `deckKeys`
shape introduced by the foundation. Query keys will include runtime scope if the
foundation exposes it as part of the active query scope; otherwise they will use
the existing default runtime behavior without inventing a parallel runtime
selector.

Alternative considered: use ad hoc arrays in each hook. Rejected because live
projection invalidation and mutation invalidation need stable targets.

### Decision: freshness follows the contract role of each read

Agents list and configured-model inventory use `inventory`. Skills, subagent
config, and event streams use `config-authority` because they mirror
`openclaw.json`-backed configuration and carry config hashes. Health/status uses
`live-workbench`. Detail, files, file content, identity, tool-policy preview,
and system-prompt preview use `lazy-detail`.

Alternative considered: put every Agents query on one `inventory` preset.
Rejected because config-hash reads and live status reads have different
freshness and refresh expectations.

### Decision: mutations are conservative and contract-derived

All Agents mutations will use Data Fabric mutation wrappers with `retry: false`,
no offline replay, and explicit invalidation. Config-hash writes
(`skills.set`, `subagents.set`, `eventStreams.set`) must block in the UI or hook
before calling the API when the required `configHash`/`baseHash` is absent.
Create/update/delete/file-save mutations invalidate affected list/detail keys;
config writes invalidate the matching config-authority query and relevant
detail/list keys. `main`/default protected delete behavior remains disabled in
the UI even if the mutation hook exists.

Alternative considered: optimistic updates for list and nested config. Rejected
for this reference slice because rollback is not exact for Gateway-backed
normalization and config-hash conflicts.

### Decision: `agent-status` uses invalidation and gap recovery first

The existing `agent-status` live projection metadata has refresh endpoints and
`gapPolicy: refresh`, but it does not have generated `patchStrategy` or
`patchKeys`. This change will map known `agent.status.changed`,
`activity.event`, and `projection.gap` events to Agents query invalidation and
stale marking. Any existing live metric reducer may remain only as a
non-authoritative display overlay while authoritative reads refresh.

Alternative considered: add generated patch fields now. Rejected because the
foundation explicitly defers projection contract expansion to a separate
proposal.

### Decision: tests prove architecture, not only rendering

Unit and hook tests must cover keys, freshness choice, duplicate request reuse,
mutation invalidation/safety, and live invalidation mapping. Component tests
must mount Agents through `DataFabricTestProvider`. Browser evidence must cover
mock-functional behavior and real Gateway read paths; real writes are limited to
run-scoped fixture actions that can be safely cleaned up.

## Risks / Trade-offs

- **Risk: AgentsPanel is large and heavily stateful** -> migrate server state in
  vertical slices while keeping visual/UI state local; avoid design refactors in
  this change.
- **Risk: background refresh could blank cached detail data** -> query display
  helpers and component tests must preserve cached data during refetch failure.
- **Risk: config-hash conflicts are easy to hide** -> baseHash-required mutation
  hooks must refuse missing hashes and surface upstream conflict details without
  overwriting local drafts.
- **Risk: real Gateway writes can mutate user config** -> L5 tests must create
  run-scoped agents only, cleanup only names/ids containing the run id, and
  circuit-break after environment failures instead of broadening cleanup.
- **Risk: current full frontend test suite has unrelated failures** -> focused
  Agents/Data Fabric tests are required for task completion; full-suite failures
  must be recorded with evidence and separated from the Agents migration.

## Migration Plan

1. Add Agents Data Fabric key/query/mutation/projection modules.
2. Refactor `useAgentsStore` so it no longer owns list fetch lifecycle; preserve
   selection and UI helpers.
3. Refactor `AgentsPanel` to consume Data Fabric hooks for list/detail/child
   sections and mutation wrappers for writes.
4. Wire the `agent-status` subscription into Data Fabric invalidation and gap
   recovery.
5. Update unit/component tests, add or update mock-functional E2E, and run real
   Gateway E2E with the defined circuit breaker.

Rollback is code-level: revert the Agents module hook adoption and restore the
store/component fetch lifecycle. No persistent data migration is introduced by
this change.

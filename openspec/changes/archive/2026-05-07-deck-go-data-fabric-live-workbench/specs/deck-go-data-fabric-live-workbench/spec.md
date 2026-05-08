## ADDED Requirements

### Requirement: Live workbench modules SHALL expose Data Fabric boundaries

`frontend-new` SHALL provide Data Fabric module boundaries for `sessions`,
`approvals`, `activity`, `gateway`, `usage`, `logs`, `alerts`, `budget`,
`cron`, `threads`, and `webhooks` server state.

#### Scenario: Module directories follow the reference shape

- **WHEN** the scoped live workbench modules are inspected
- **THEN** each module SHALL expose stable query keys and query hooks or query
  option factories under `frontend-new/src/data/modules/<module>/`
- **AND** modules with writes SHALL expose mutation wrappers in the same module
  boundary
- **AND** modules with current live projection metadata SHALL expose a
  projection invalidation policy

#### Scenario: Existing API facades remain the backend boundary

- **WHEN** a scoped Data Fabric query or mutation needs backend data
- **THEN** it SHALL call an existing or newly added `src/api.ts` facade
- **AND** browser code SHALL continue to talk only to deck-go backend routes
- **AND** diagnostic Gateway RPC or batch calls SHALL continue through deck-go
  backend adapters rather than direct Gateway URLs

### Requirement: Scoped live workbench panels SHALL use Data Fabric for server reads

Scoped live workbench panel server-state reads SHALL consume server state through
module Data Fabric hooks or query option factories instead of component-owned
first-load/background-refresh fetch lifecycles.

#### Scenario: Panel read lifecycle is migrated

- **WHEN** a scoped panel needs list, detail, config, status, queue, history,
  monitor, usage, log, or delivery data from deck-go backend
- **THEN** it SHALL import the matching Data Fabric hook or query option factory
- **AND** it SHALL NOT add new raw `deckFetch`, raw Gateway client, or
  component-local `useEffect(fetch*)` server fetch lifecycles for migrated data

#### Scenario: UI state remains local

- **WHEN** a scoped panel manages selected items, tabs, filters, search input,
  drafts, dialogs, expanded rows, command text, or transient result state
- **THEN** that state SHALL remain in React local state or a UI store
- **AND** it SHALL NOT be modeled as TanStack Query server data

#### Scenario: Cached data survives refresh failure

- **WHEN** a scoped query has cached data and a background refresh fails
- **THEN** the panel SHALL keep rendering the cached data
- **AND** it SHALL surface a recoverable stale/error state without returning to
  a first-load skeleton

### Requirement: Live workbench freshness SHALL match source semantics

Scoped module queries SHALL declare freshness tiers according to the product
semantics and contract role of each read.

#### Scenario: Live workbench reads use live freshness

- **WHEN** sessions list, approvals queue, cron status/jobs, active monitor runs,
  or active Gateway diagnostic status are queried
- **THEN** the query SHALL use `live-workbench` or `runtime-liveness` freshness
  according to the source behavior

#### Scenario: Historical reads use historical freshness

- **WHEN** activity history, monitor history/stats, usage history, log tail
  snapshot, cron runs, usage session logs, or webhook deliveries are queried
- **THEN** the query SHALL use the `historical` tier unless a more specific
  stream-driven contract applies

#### Scenario: Detail and command reads are not over-fetched

- **WHEN** session detail/history, compaction checkpoints, selected monitor run
  detail, Gateway describe, webhook test result, or diagnostic action results
  are represented as server state
- **THEN** the query SHALL use `lazy-detail`, `stream-driven`, or another
  explicitly documented tier matching its product semantics
- **AND** fresh navigation back to the panel SHALL reuse fresh cache rather than
  issuing duplicate identical reads

### Requirement: Live workbench mutations SHALL follow contract safety

Scoped module mutations SHALL implement safety and invalidation behavior derived
from `deck-mutations.contract.json`,
`deck-config-write-safety.contract.json`, and route governance metadata.

#### Scenario: Fixture-safe writes remain scoped

- **WHEN** alerts, budget, webhooks, or cron write mutations run in tests or real
  E2E
- **THEN** they SHALL use run-scoped or disposable fixtures when a real write is
  performed
- **AND** delete helpers SHALL refuse or skip non-run-scoped destructive targets
  in automated real evidence

#### Scenario: Conflict-sensitive writes preserve upstream behavior

- **WHEN** approvals, sessions, or diagnostic Gateway actions return validation,
  conflict, forbidden, or upstream errors
- **THEN** mutation wrappers SHALL preserve local drafts or transient UI state
- **AND** they SHALL surface upstream error details without automatic mutation
  retry or offline replay

#### Scenario: Mutation invalidation is explicit

- **WHEN** a scoped mutation succeeds
- **THEN** it SHALL invalidate the declared module query keys needed to keep the
  current panel correct
- **AND** it SHALL NOT invent broad app-wide invalidation unless the module
  contract requires it

### Requirement: Live workbench projection metadata SHALL be respected

Scoped modules SHALL consume current live projection metadata for invalidation
and gap recovery without requiring generated patch fields.

#### Scenario: Activity projection updates activity and monitor keys

- **WHEN** `activity-feed` events or `projection.gap` are handled
- **THEN** activity events, monitor runs, monitor stats, and selected monitor
  detail keys SHALL be invalidated or marked stale according to the module
  policy

#### Scenario: Approval projection updates approval keys

- **WHEN** `approval.pending`, `approval.resolved`, or `projection.gap` are
  handled for `approval-queue`
- **THEN** pending approval, approval list, and plugin approval keys SHALL be
  invalidated or marked stale according to the module policy

#### Scenario: Session list projection updates sessions keys

- **WHEN** `sessions.changed`, `session-state`, or `projection.gap` are handled
  for `session-list`
- **THEN** the Sessions panel session list and preview keys SHALL be invalidated
  or marked stale according to the module policy

#### Scenario: Logs stream remains specialized

- **WHEN** `log-tail` metadata is handled
- **THEN** Data Fabric SHALL own the `GET /logs` read key and manual invalidation
  policy
- **AND** it SHALL NOT invent projection-gap recovery because the current
  contract declares `gapPolicy: none`

#### Scenario: Patch fields remain out of scope

- **WHEN** scoped projection code is compiled or tested
- **THEN** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields

### Requirement: Live workbench verification SHALL include mock and real evidence

The migration SHALL provide deterministic code-level checks, L4
mock-functional browser evidence, and L5 real Gateway evidence or documented
circuit-breaker handoffs for every scoped live workbench module.

#### Scenario: Mock-functional module evidence runs

- **WHEN** L4 mock-functional evidence runs for scoped modules
- **THEN** it SHALL cover navigation, first-load ready state, cached-data
  behavior where applicable, and at least one safe or blocked mutation path for
  modules with writes
- **AND** unexpected browser console, page, or BFF API errors SHALL fail the
  evidence

#### Scenario: Real-gateway module evidence is bounded

- **WHEN** L5 real Gateway evidence runs for scoped modules
- **THEN** it SHALL use the isolated real stack
- **AND** it SHALL prefer read paths, validation-only paths, or disposable
  fixtures for writes according to mutation evidence
- **AND** it SHALL record exact command evidence and scenario outcomes

#### Scenario: Repeated real environment failure uses circuit breaker

- **WHEN** real Gateway startup or environment setup fails twice without new
  narrowing evidence
- **THEN** the change SHALL record the command, failure, affected module, and
  follow-up handoff
- **AND** deterministic code-level checks SHALL remain green before proceeding

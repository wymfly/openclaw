## ADDED Requirements

### Requirement: Config and inventory modules SHALL expose Data Fabric boundaries

`frontend-new` SHALL provide Data Fabric module boundaries for `skills`,
`models`, `channels`, `routing`, `nodes`, `settings`, `plugins`, `docs`,
`memory`, and `config` server state.

#### Scenario: Module directories follow the reference shape

- **WHEN** the scoped modules are inspected
- **THEN** each module SHALL expose stable query keys and query hooks or option
  factories under `frontend-new/src/data/modules/<module>/`
- **AND** modules with writes SHALL expose mutation wrappers in the same module
  boundary
- **AND** modules with current live projection metadata SHALL expose a
  projection invalidation policy

#### Scenario: Existing API facades remain the backend boundary

- **WHEN** a scoped Data Fabric query or mutation needs backend data
- **THEN** it SHALL call an existing or newly added `src/api.ts` facade
- **AND** browser code SHALL continue to talk only to deck-go backend routes
- **AND** Gateway protocol adapter calls SHALL continue through generated
  backend RPC facades rather than direct Gateway URLs

### Requirement: Scoped panel server-state reads SHALL use Data Fabric

Scoped panel server-state reads SHALL consume server state through module Data
Fabric hooks instead of component-owned first-load/background-refresh fetch
lifecycles. This applies to the `skills`, `models`, `channels`, `routing`,
`nodes`, `settings`, `plugins`, `docs`, `memory`, and `config` panels.

#### Scenario: Panel read lifecycle is migrated

- **WHEN** a scoped panel needs list, detail, config, status, search, or
  inventory data from deck-go backend
- **THEN** it SHALL import the matching Data Fabric hook or query option factory
- **AND** it SHALL NOT add new raw `deckFetch`, raw Gateway client, or
  component-local `useEffect(fetch*)` server fetch lifecycles for that migrated
  data

#### Scenario: UI state remains local

- **WHEN** a scoped panel manages selected items, tabs, filters, search input,
  drafts, dialogs, expanded rows, or transient command state
- **THEN** that state SHALL remain in React local state or a UI store
- **AND** it SHALL NOT be modeled as TanStack Query server data

#### Scenario: Cached data survives refresh failure

- **WHEN** a scoped query has cached data and a background refresh fails
- **THEN** the panel SHALL keep rendering the cached data
- **AND** it SHALL surface a recoverable stale/error state without returning to
  a first-load skeleton

### Requirement: Config and inventory freshness SHALL match source semantics

Scoped module queries SHALL declare freshness tiers according to the contract
role of each read.

#### Scenario: Config-authority reads use config freshness

- **WHEN** config snapshots, settings, models config, channel config/status, or
  routing bindings are queried
- **THEN** the query SHALL use the `config-authority` tier unless a more specific
  live contract applies

#### Scenario: Inventory reads use inventory freshness

- **WHEN** skills, plugins, models runtime/catalog inventory, nodes, docs list,
  memory browse/search, or similar inventory lists are queried
- **THEN** the query SHALL use the `inventory` tier

#### Scenario: Detail and transient command reads are not over-fetched

- **WHEN** docs detail, skill hub detail, node detail, memory health, routing
  simulate/validate, or model auth probe results are represented as server state
- **THEN** the query SHALL use `lazy-detail`, `live-workbench`, or another
  explicitly documented tier matching its product semantics
- **AND** fresh navigation back to the panel SHALL reuse fresh cache rather than
  issuing duplicate identical reads

### Requirement: Config and inventory mutations SHALL follow contract safety

Scoped module mutations SHALL implement safety and invalidation behavior derived
from `deck-mutations.contract.json` and
`deck-config-write-safety.contract.json`.

#### Scenario: Hash-required writes block before backend calls

- **WHEN** a `client-required` write is requested without the required hash
- **THEN** the mutation SHALL NOT call the backend
- **AND** the UI SHALL preserve local drafts and surface a refresh/conflict
  recovery path

#### Scenario: Hash-optional and backend-derived writes preserve upstream behavior

- **WHEN** a `client-optional`, `backend-derived`, `not-applicable`, or
  `no-hash` write runs
- **THEN** the mutation SHALL NOT invent a stricter client hash requirement
- **AND** conflict-like failures SHALL preserve user drafts where the UI has
  editable drafts

#### Scenario: Mutation defaults remain conservative

- **WHEN** scoped mutations are inspected
- **THEN** they SHALL use no automatic mutation retry
- **AND** they SHALL NOT queue offline replay
- **AND** they SHALL invalidate declared module query keys on success

### Requirement: Scoped live projection metadata SHALL be respected without new patch fields

Config/inventory Data Fabric modules SHALL consume only current live projection
metadata for invalidation and gap recovery.

#### Scenario: Device pairing updates settings keys

- **WHEN** `device.pair.requested`, `device.pair.resolved`, or
  `projection.gap` is received for `device-pairing`
- **THEN** settings/device pairing keys SHALL be invalidated or marked stale
- **AND** gap handling SHALL follow the current `gapPolicy: refresh`

#### Scenario: Routing bindings do not invent live stream behavior

- **WHEN** the `routing-bindings` metadata is inspected
- **THEN** Data Fabric SHALL preserve it as an invalidation/read-model policy
  without adding a stream subscription because the current contract declares no
  stream events and `gapPolicy: none`

#### Scenario: Patch fields remain out of scope

- **WHEN** scoped projection code is compiled or tested
- **THEN** it SHALL NOT require generated `patchStrategy` or `patchKeys` fields

### Requirement: Config and inventory verification SHALL include module-level mock and real evidence

The migration SHALL provide deterministic code-level checks, L4 mock-functional
browser evidence, and L5 real Gateway evidence or documented circuit-breaker
handoffs for the scoped modules.

#### Scenario: Mock-functional module evidence runs

- **WHEN** L4 mock-functional evidence runs for the scoped modules
- **THEN** it SHALL cover navigation, first-load ready state, fresh-cache return
  or cached-data preservation where applicable, and at least one safe or blocked
  mutation path for modules with writes
- **AND** unexpected browser console, page, or BFF API errors SHALL fail the
  evidence

#### Scenario: Real-gateway module evidence is bounded

- **WHEN** L5 real Gateway evidence runs for the scoped modules
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

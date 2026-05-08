# deck-go-data-fabric-foundation Specification

## Purpose

Define the shared `frontend-new` server-state foundation, including the Data
Fabric provider, query defaults, BFF/Gateway transport separation, freshness
policy, runtime summary query migration, live invalidation baseline, and test
support for later module migrations.

## Requirements

### Requirement: Data Fabric provider SHALL own frontend-new server-state defaults

`deck-go/frontend-new` SHALL mount one Data Fabric provider that owns the
TanStack Query client, shared query defaults, mutation defaults, scope context,
and test override points for server state.

#### Scenario: Application mounts one provider

- **WHEN** `frontend-new` renders the normal application entrypoint
- **THEN** the application SHALL mount exactly one Data Fabric query provider
  above `DeckGoApp`
- **AND** panel code SHALL be able to consume Data Fabric hooks without mounting
  its own query client

#### Scenario: Provider defaults are conservative

- **WHEN** the Data Fabric query client is created
- **THEN** query defaults SHALL avoid refetching fresh data on every component
  mount
- **AND** mutation defaults SHALL use `retry: false`
- **AND** mutation defaults SHALL NOT enable automatic offline replay

#### Scenario: Runtime scope uses contract-owned default identity

- **WHEN** Data Fabric query keys or Gateway backend routes need a default
  runtime id
- **THEN** frontend code SHALL use a contract-owned or explicitly verified
  runtime default authority
- **AND** it SHALL NOT introduce additional hand-written `"rt_local"` fallbacks
  in Data Fabric key or transport code

### Requirement: Data Fabric SHALL separate BFF endpoint reads from Gateway RPC reads

Data Fabric SHALL expose transport helpers that distinguish deck-go BFF endpoint
reads from generated Gateway RPC method calls, while keeping all browser traffic
routed through the deck-go backend.

#### Scenario: Runtime summary uses BFF endpoints

- **WHEN** runtime bootstrap or runtime gateway status is loaded
- **THEN** Data Fabric SHALL call the existing BFF-backed
  `fetchBootstrapStatus()` and `fetchRuntimeGatewayStatus()` paths or
  equivalent BFF wrappers
- **AND** it SHALL NOT represent `/bootstrap/status` or `/runtime/gateway` as
  Gateway RPC method names

#### Scenario: Gateway RPC uses backend adapter

- **WHEN** Data Fabric calls a generated Gateway RPC method
- **THEN** the browser request SHALL route through
  `/api/v1/runtimes/{runtimeId}/gateway/rpc`
- **AND** Data Fabric SHALL NOT open a direct browser connection to OpenClaw
  Gateway

#### Scenario: Gateway RPC preserves per-request tracing

- **WHEN** Gateway RPC transport performs multiple default requests
- **THEN** each request SHALL preserve fresh request tracing semantics
- **AND** reusable client or method state SHALL NOT cause default requests to
  reuse a stale `X-Request-Id`
- **AND** explicit caller-provided request ids SHALL remain supported

### Requirement: Freshness policy SHALL be explicit and testable

Data Fabric SHALL define named freshness presets for `static`, `runtime-liveness`, `config-authority`, `inventory`, `live-workbench`, `historical`, `lazy-detail`, and `stream-driven` data classes.

#### Scenario: Freshness presets are mapped to query options

- **WHEN** tests inspect the freshness policy
- **THEN** every named freshness tier SHALL map to deterministic `staleTime`, `gcTime`, focus-refetch, and reconnect-refetch behavior
- **AND** the `runtime-liveness` tier SHALL support low-latency refresh without re-fetching fresh data on every panel switch

#### Scenario: Background refresh fails with cached data

- **WHEN** a query has cached data and a background refresh fails
- **THEN** Data Fabric UI helpers SHALL preserve the cached data
- **AND** they SHALL expose a non-blocking stale or error state instead of replacing the view with a first-load skeleton

### Requirement: Runtime summary SHALL use Data Fabric query hooks

The deck UI runtime/bootstrap summary SHALL be loaded through Data Fabric runtime query hooks instead of a duplicated local polling lifecycle in `DeckUIProvider`.

#### Scenario: Initial runtime summary loads

- **WHEN** the deck UI starts with a valid access token or no token requirement
- **THEN** runtime bootstrap and runtime gateway status SHALL load through Data Fabric query hooks
- **AND** the existing `bootstrap`, `runtime`, `summaryReady`, `summaryError`, and auth-required UI states SHALL remain available to existing components

#### Scenario: Manual runtime refresh remains available

- **WHEN** existing UI calls `refreshRuntimeSummary()`
- **THEN** the call SHALL invalidate or refetch the Data Fabric runtime summary queries
- **AND** callers SHALL NOT need to know whether the data is cached or locally stored

#### Scenario: Fresh navigation avoids duplicate summary fetch

- **WHEN** a user switches away from a panel and returns while runtime summary data is still fresh
- **THEN** Data Fabric SHALL return cached runtime summary data without issuing another identical runtime summary request

### Requirement: Data Fabric SHALL provide reusable test support

Data Fabric SHALL include a test provider that creates an isolated query client, supplies mock BFF/Gateway transport behavior, and records calls for assertions.

#### Scenario: Hook test uses DataFabricTestProvider

- **WHEN** a Data Fabric hook test is run
- **THEN** the test SHALL be able to mount the hook with an isolated query client and mock transport
- **AND** recorded calls SHALL allow assertions that duplicate consumers share cached results where applicable

### Requirement: Foundation SHALL not enable deferred hardening features

The foundation implementation SHALL NOT enable automatic mutation retry, offline mutation queueing, IndexedDB query persistence, custom oxlint rules, or generated live projection `patchStrategy`/`patchKeys` fields.

#### Scenario: Deferred feature remains absent

- **WHEN** reviewers inspect foundation implementation
- **THEN** mutation retry SHALL remain opt-in only for later proposals
- **AND** no offline write queue SHALL be exposed in UI copy or Data Fabric defaults
- **AND** live projection handling SHALL use existing contract fields unless a later proposal extends the contract source and generator

### Requirement: Data Fabric reference modules SHALL use a repeatable module shape

Data Fabric module migrations SHALL expose query keys, query option factories or
hooks, mutation wrappers, and live projection mapping from a module-local
directory under `frontend-new/src/data/modules/<module>/`.

#### Scenario: Agents establishes reference module shape

- **WHEN** the Agents reference migration is implemented
- **THEN** it SHALL place Agents query keys, read hooks/options, mutation
  wrappers, and projection invalidation policy under
  `frontend-new/src/data/modules/agents/`
- **AND** later modules SHALL be able to copy that shape without adding a second
  server-state framework

#### Scenario: Module hooks use foundation defaults

- **WHEN** an Agents Data Fabric hook or mutation is inspected
- **THEN** it SHALL use the foundation query client, freshness presets,
  conservative mutation defaults, and test provider support
- **AND** it SHALL NOT enable deferred hardening features unless a later
  proposal explicitly adds them

### Requirement: Foundation SHALL support Chat surrounding server-state boundaries

The Data Fabric foundation SHALL support Chat surrounding read models and
invalidation without requiring transcript streams to move into query cache.

#### Scenario: Stream-owned renderers keep specialized reducers

- **WHEN** Chat transcript or canvas stream renderers are inspected
- **THEN** they SHALL be allowed to keep specialized reducer/store logic for
  streaming bytes and local projection state
- **AND** Data Fabric SHALL own only the authoritative snapshot, list,
  discovery, mutation, and invalidation boundaries introduced by scoped changes

#### Scenario: Chat modules reuse existing foundation primitives

- **WHEN** Chat and command Data Fabric modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL NOT add a second server-state framework

### Requirement: Data Fabric module migrations SHALL support config and inventory breadth

The Data Fabric foundation SHALL support repeated config/inventory module
migrations without adding a second server-state framework or broad module
special cases.

#### Scenario: Config and inventory modules reuse foundation primitives

- **WHEN** scoped config/inventory modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL only add module-local keys, hooks, mutations, and projection
  policies

#### Scenario: Cross-module reads are shared intentionally

- **WHEN** multiple scoped modules need the same server-state source such as
  channel inventory or configured models
- **THEN** they MAY reuse a single Data Fabric query source
- **AND** the shared key/invalidation owner SHALL be explicit in the module
  boundary

### Requirement: Data Fabric module migrations SHALL support live workbench breadth

The Data Fabric foundation SHALL support live and historical workbench module
migrations without adding a second server-state framework or broad module
special cases.

#### Scenario: Live workbench modules reuse foundation primitives

- **WHEN** scoped live workbench modules are implemented
- **THEN** they SHALL reuse the foundation query client, freshness presets,
  transport wrappers, error normalization, test provider, and conservative
  mutation defaults
- **AND** they SHALL only add module-local keys, hooks, mutations, and projection
  policies

#### Scenario: Stream-owned renderers remain specialized

- **WHEN** a panel has existing stream-owned rendering such as log tail or chat
  transcript rendering
- **THEN** Data Fabric SHALL migrate the authoritative refresh/read-model
  boundary without forcing stream bytes into query cache unless a separate
  proposal proves the reducer and rollback behavior

### Requirement: Foundation SHALL provide Data Fabric governance support

The Data Fabric foundation SHALL support a narrow governance mechanism for
tracking and testing remaining intentional exceptions.

#### Scenario: Governance registry is available to tests and documentation

- **WHEN** the governance sweep is implemented
- **THEN** the Data Fabric layer SHALL expose or document an exception registry
  for residual raw server-state or stream patterns
- **AND** the registry SHALL be usable by focused tests without introducing a
  custom lint dependency

#### Scenario: Governance does not add deferred hardening features

- **WHEN** governance support is inspected
- **THEN** it SHALL NOT enable automatic mutation retry, offline mutation
  queueing, IndexedDB query persistence, DevTools, custom lint, or generated
  projection patch fields

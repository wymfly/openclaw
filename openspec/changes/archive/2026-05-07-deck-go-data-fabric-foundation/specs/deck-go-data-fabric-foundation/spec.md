## ADDED Requirements

### Requirement: Data Fabric provider SHALL own frontend-new server-state defaults

`deck-go/frontend-new` SHALL mount one Data Fabric provider that owns the TanStack Query client, shared query defaults, mutation defaults, scope context, and test override points for server state.

#### Scenario: Application mounts one provider

- **WHEN** `frontend-new` renders the normal application entrypoint
- **THEN** the application SHALL mount exactly one Data Fabric query provider above `DeckGoApp`
- **AND** panel code SHALL be able to consume Data Fabric hooks without mounting its own query client

#### Scenario: Provider defaults are conservative

- **WHEN** the Data Fabric query client is created
- **THEN** query defaults SHALL avoid refetching fresh data on every component mount
- **AND** mutation defaults SHALL use `retry: false`
- **AND** mutation defaults SHALL NOT enable automatic offline replay

### Requirement: Data Fabric SHALL separate BFF endpoint reads from Gateway RPC reads

Data Fabric SHALL expose transport helpers that distinguish deck-go BFF endpoint reads from generated Gateway RPC method calls, while keeping all browser traffic routed through the deck-go backend.

#### Scenario: Runtime summary uses BFF endpoints

- **WHEN** runtime bootstrap or runtime gateway status is loaded
- **THEN** Data Fabric SHALL call the existing BFF-backed `fetchBootstrapStatus()` and `fetchRuntimeGatewayStatus()` paths or equivalent BFF wrappers
- **AND** it SHALL NOT represent `/bootstrap/status` or `/runtime/gateway` as Gateway RPC method names

#### Scenario: Gateway RPC uses backend adapter

- **WHEN** Data Fabric calls a generated Gateway RPC method
- **THEN** the browser request SHALL route through `/api/v1/runtimes/{runtimeId}/gateway/rpc`
- **AND** Data Fabric SHALL NOT open a direct browser connection to OpenClaw Gateway

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

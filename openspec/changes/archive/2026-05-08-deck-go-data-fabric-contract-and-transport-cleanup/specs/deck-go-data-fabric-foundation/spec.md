## MODIFIED Requirements

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

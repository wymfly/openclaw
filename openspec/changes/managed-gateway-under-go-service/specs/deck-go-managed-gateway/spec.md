## ADDED Requirements

### Requirement: Go backend owns managed Gateway lifecycle

The `deck-go` backend SHALL be able to run as the sole operator-managed backend service while owning the lifecycle of one managed OpenClaw Gateway process.

#### Scenario: Backend startup auto-starts Gateway

- **WHEN** the `deck-go` backend starts with managed Gateway mode enabled and valid token/configuration
- **THEN** the backend SHALL automatically start or adopt its owned Gateway without requiring a separate `openclaw gateway` service to be installed or started

#### Scenario: Frontend never starts Gateway directly

- **WHEN** the frontend needs chat, runtime, or Gateway status
- **THEN** it SHALL call the Go backend APIs only and SHALL NOT execute or directly manage a Gateway process

#### Scenario: Operator manages only Go backend and frontend

- **WHEN** the Go backend and frontend are supervised by deployment infrastructure
- **THEN** a healthy managed Gateway SHALL be maintained by the Go backend without an additional operator-managed Gateway service

### Requirement: Managed Gateway uses canonical deck-go token

The `deck-go` backend SHALL resolve one canonical service token and use it for both protected Go API requests and managed Gateway authentication.

#### Scenario: Frontend and Gateway share canonical token

- **WHEN** `DECK_GO_ACCESS_TOKEN` or persisted `settings.accessToken` is configured
- **THEN** the frontend SHALL authenticate to Go using that token and the Go backend SHALL authenticate to its managed Gateway using the same token

#### Scenario: Compatibility Gateway token seeds canonical token

- **WHEN** no canonical access token exists but an existing `DECK_GO_GATEWAY_TOKEN` or persisted `managedGateway.gatewayToken` exists
- **THEN** the backend SHALL be able to migrate or seed the canonical service token from that value without requiring users to configure two tokens

#### Scenario: Missing token in managed mode

- **WHEN** managed Gateway mode requires authentication and no token is configured
- **THEN** the backend SHALL generate or request a canonical token before launching Gateway and SHALL NOT launch Gateway with unauthenticated non-loopback access

### Requirement: Gateway token is not exposed through process arguments

The `deck-go` backend SHALL NOT pass the canonical service token to Gateway through command-line arguments.

#### Scenario: Launch command excludes token argument

- **WHEN** the Go backend launches managed Gateway
- **THEN** the process arguments SHALL NOT include `--token`, `--token=<value>`, `--password`, or other secret-bearing auth arguments derived from the canonical token

#### Scenario: Gateway receives token through protected runtime configuration

- **WHEN** the Go backend launches managed Gateway
- **THEN** Gateway SHALL receive the canonical token through `OPENCLAW_GATEWAY_TOKEN` or another protected configuration surface that does not expose the token via normal process listings

#### Scenario: Runtime status redacts token

- **WHEN** runtime status, bootstrap status, logs, or frontend state are rendered
- **THEN** they SHALL indicate whether a token is configured without exposing the token value

### Requirement: Managed Gateway autostart is enabled by default

Managed Gateway autostart SHALL be the default behavior for `deck-go` deployments unless explicitly disabled by the operator.

#### Scenario: Default effective settings enable autostart

- **WHEN** no explicit autostart override is present in env or persisted settings
- **THEN** the effective managed Gateway settings SHALL set `autoStart=true`

#### Scenario: Explicit disable is respected

- **WHEN** the operator explicitly sets managed Gateway autostart to false
- **THEN** the backend SHALL leave Gateway stopped on boot and SHALL report that autostart is disabled

### Requirement: Backend does not kill unrelated Gateway port listeners

The managed Gateway launcher SHALL NOT kill or replace a listener on the target Gateway port unless it proves the listener is the Gateway instance owned by the current `deck-go` managed runtime.

#### Scenario: Target port is free

- **WHEN** the target Gateway port has no listener
- **THEN** the backend SHALL launch managed Gateway without using a force-kill behavior

#### Scenario: Existing owned Gateway is adopted

- **WHEN** the target port has a listener whose PID, state directory, launch fingerprint, and authenticated health probe match the backend's managed ownership metadata
- **THEN** the backend SHALL adopt that Gateway as its managed runtime instead of launching a duplicate process

#### Scenario: Existing unowned listener blocks startup

- **WHEN** the target port has a listener and ownership cannot be proven
- **THEN** the backend SHALL fail managed Gateway startup with a port-conflict status and SHALL NOT terminate the listener

### Requirement: Managed Gateway ownership metadata is durable

The backend SHALL persist enough managed Gateway ownership metadata to distinguish its own Gateway from unrelated processes across backend restarts.

#### Scenario: Metadata is written on launch

- **WHEN** the backend successfully launches managed Gateway
- **THEN** it SHALL persist metadata containing owner ID, PID, bind host, bind port, managed state directory, launch fingerprint, token hash, and start timestamp

#### Scenario: Metadata is validated before adoption

- **WHEN** the backend restarts and finds existing managed Gateway metadata
- **THEN** it SHALL validate process liveness, launch fingerprint, state directory, and authenticated Gateway health before adopting the process

#### Scenario: Stale metadata is ignored

- **WHEN** persisted metadata references a dead PID or a process that fails ownership validation
- **THEN** the backend SHALL ignore or replace the metadata and SHALL NOT treat the process as owned

### Requirement: Supervisor recovers unhealthy or crashed Gateway

The managed Gateway supervisor SHALL recover its owned Gateway from abnormal exits and sustained unhealthy probes.

#### Scenario: Abnormal exit restarts Gateway

- **WHEN** an owned Gateway exits unexpectedly while autostart is enabled
- **THEN** the supervisor SHALL schedule a restart using bounded exponential backoff and SHALL update runtime status with restart attempt details

#### Scenario: Sustained probe failure restarts Gateway

- **WHEN** an owned Gateway was healthy and then fails health probes beyond the configured recovery threshold
- **THEN** the supervisor SHALL mark the runtime degraded or restarting and SHALL replace the owned Gateway according to the recovery policy

#### Scenario: Static configuration error stops retry loop

- **WHEN** Gateway startup fails because of invalid managed config, missing command, missing token, or preflight failure
- **THEN** the supervisor SHALL mark the runtime failed and SHALL NOT enter an endless restart loop until configuration changes

#### Scenario: Healthy period resets backoff

- **WHEN** a restarted Gateway remains healthy for the configured stability period
- **THEN** the supervisor SHALL reset the restart backoff and attempt counter

### Requirement: Managed Gateway status is observable through Go APIs

The Go backend SHALL expose managed Gateway lifecycle and recovery state through existing runtime/bootstrap APIs without exposing secrets.

#### Scenario: Runtime status includes recovery details

- **WHEN** the frontend calls the runtime Gateway status API
- **THEN** the response SHALL include status, health, Gateway URL, PID when known, autostart flag, ownership/adoption state, restart attempt count, next retry time, last exit code/time, and last non-secret error

#### Scenario: Bootstrap reflects Gateway connectivity

- **WHEN** the managed Gateway is running and healthy
- **THEN** bootstrap status SHALL report Gateway connected using the Go-owned runtime connection

#### Scenario: Port conflict is visible

- **WHEN** managed Gateway startup is blocked by an unowned listener
- **THEN** runtime status SHALL expose a non-secret port-conflict failure phase and actionable message

### Requirement: Managed settings and state are stored securely

The backend SHALL store token-bearing settings and managed runtime state with owner-only permissions where the platform supports POSIX-style permissions.

#### Scenario: Settings file contains token material

- **WHEN** `settings.json` contains the canonical service token or migration token material
- **THEN** the file SHALL be written with owner-readable and owner-writable permissions only

#### Scenario: Managed state directory is created

- **WHEN** the backend creates the managed Gateway state directory
- **THEN** it SHALL use owner-only directory permissions where supported

#### Scenario: Metadata avoids raw tokens

- **WHEN** ownership metadata is persisted
- **THEN** it SHALL store only a one-way token hash or token fingerprint and SHALL NOT store raw token values

### Requirement: Backend shutdown only stops owned Gateway

The backend SHALL stop only the Gateway process it owns and SHALL leave unrelated Gateway processes untouched.

#### Scenario: Intentional backend shutdown

- **WHEN** the backend receives an intentional shutdown signal and has an owned managed Gateway running
- **THEN** it SHALL gracefully stop that Gateway within the configured timeout and escalate only against the owned process if needed

#### Scenario: Stop request with unowned listener

- **WHEN** a stop request is made but the current listener on the Gateway port is not owned by the backend
- **THEN** the backend SHALL report that no owned Gateway was stopped and SHALL NOT terminate the unowned listener

### Requirement: Local stack uses single-token managed Gateway defaults

The local `deck-go` stack scripts and examples SHALL reflect the production ownership model.

#### Scenario: Example env uses one token

- **WHEN** a developer copies the example `deck-go` env file
- **THEN** it SHALL configure one canonical service token and SHALL NOT require separate Deck and Gateway token values for normal managed mode

#### Scenario: Stack start brings up healthy Gateway

- **WHEN** a developer runs the local stack start command with default managed settings
- **THEN** the Go backend, frontend, and Go-owned Gateway SHALL become healthy without requiring a separate runtime-start command

#### Scenario: Smoke test verifies managed recovery

- **WHEN** the managed Gateway process is terminated during local stack smoke verification
- **THEN** the Go backend SHALL restart or recover the Gateway and the smoke test SHALL verify chat/bootstrap connectivity afterward

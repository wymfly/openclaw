## MODIFIED Requirements

### Requirement: SSE Stream Bridge

The Deck Server SHALL expose a realtime stream endpoint that uses the same authentication model as the protected REST API surface and supports durable catch-up.

#### Scenario: Browser stream uses Deck access token

- **WHEN** Deck access protection is enabled
- **THEN** the browser realtime stream client SHALL authenticate using the same Deck access token model as protected REST requests

#### Scenario: Catch-up reads from persistent event storage

- **WHEN** a browser reconnects to the realtime stream with a `Last-Event-ID`
- **THEN** the server SHALL replay missed events from persistent event storage or a durable projection source, not only from a transient in-memory ring buffer

### Requirement: Typed client coverage

The Deck typed client SHALL cover all Gateway methods that are called by the dashboard and have result schemas. The `GatewayMethodMap` SHALL include entries for every method with a registered result schema in `methodDefs`.

#### Scenario: All 5 new upstream methods appear in GatewayMethodMap

- **WHEN** `pnpm protocol:gen:ts` is executed after adding result schemas
- **THEN** the generated `GatewayMethodMap` SHALL include entries for `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, and `skills.install` in addition to all previously covered methods

#### Scenario: No regression in existing typed methods

- **WHEN** `pnpm protocol:gen:ts` is executed after adding new result schemas
- **THEN** all 25 existing `deck.*` typed methods and all previously typed `chat.*` / `sessions.*` methods SHALL remain in the generated output unchanged

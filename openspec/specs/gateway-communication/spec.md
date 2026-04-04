## MODIFIED Requirements

### Requirement: SSE Stream Bridge

The Deck Server SHALL expose a realtime stream endpoint that uses the same authentication model as the protected REST API surface and supports durable catch-up.

#### Scenario: Browser stream uses Deck access token

- **WHEN** Deck access protection is enabled
- **THEN** the browser realtime stream client SHALL authenticate using the same Deck access token model as protected REST requests

#### Scenario: Catch-up reads from persistent event storage

- **WHEN** a browser reconnects to the realtime stream with a `Last-Event-ID`
- **THEN** the server SHALL replay missed events from persistent event storage or a durable projection source, not only from a transient in-memory ring buffer

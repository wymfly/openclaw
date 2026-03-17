## ADDED Requirements

### Requirement: WebSocket Gateway Adapter

The Deck Server SHALL maintain a persistent WebSocket connection to the OpenClaw Gateway using Protocol v3. The adapter SHALL handle challenge-response authentication, automatic reconnection with exponential backoff, and message serialization/deserialization per the Gateway protocol contract.

#### Scenario: Successful connection and authentication

- **WHEN** the Deck Server starts with a valid Gateway URL and token configured
- **THEN** the adapter SHALL establish a WebSocket connection to the Gateway on port 18789 and complete challenge-response authentication within 10 seconds

#### Scenario: Automatic reconnection on disconnect

- **WHEN** the WebSocket connection drops unexpectedly
- **THEN** the adapter SHALL attempt reconnection with exponential backoff (starting at 1s, max 30s) and emit a `gateway.disconnected` event on the EventBus

### Requirement: EventBus Internal Routing

The EventBus SHALL provide a typed publish/subscribe mechanism for routing Gateway events to internal consumers (API routes, SSE bridge, projection store). All Gateway WS messages SHALL be re-emitted as typed EventBus events.

#### Scenario: Gateway event propagation

- **WHEN** a Gateway WS message of type `chat` arrives (payload contains `state` field: `delta` for streaming chunks, `final` for completion, `error` for failures)
- **THEN** the EventBus SHALL emit a corresponding typed event to all registered subscribers within the same tick

#### Scenario: Subscriber isolation

- **WHEN** a subscriber callback throws an error
- **THEN** the EventBus SHALL catch the error, log it, and continue delivering the event to remaining subscribers without interruption

### Requirement: SSE Stream Bridge

The Deck Server SHALL expose an SSE endpoint (`GET /api/stream`) that bridges EventBus events to the browser. The browser SHALL receive real-time updates without polling.

#### Scenario: Browser receives real-time events

- **WHEN** a browser client connects to `GET /api/stream` with a valid session
- **THEN** the server SHALL keep the connection open and deliver EventBus events as SSE messages with `event:` and `data:` fields

#### Scenario: SSE reconnection with last-event-id

- **WHEN** a browser reconnects to the SSE endpoint with a `Last-Event-ID` header
- **THEN** the server SHALL replay any missed events from the projection store since that event ID

### Requirement: SQLite Projection Store

The projection store SHALL persist Gateway events to a local SQLite database (`deck.db`) for replay, aggregation, and offline query. Events SHALL be written to an outbox table with monotonic sequence IDs.

#### Scenario: Event persistence

- **WHEN** an event is emitted on the EventBus
- **THEN** the projection store SHALL insert the event into the `event_outbox` table with a monotonically increasing `seq_id`, event type, JSON payload, and timestamp

#### Scenario: Event replay for SSE catch-up

- **WHEN** the SSE bridge requests events after a given `seq_id`
- **THEN** the projection store SHALL return all events with `seq_id` greater than the requested value, ordered by `seq_id` ascending

### Requirement: Browser Isolation

The browser SHALL NEVER connect directly to the OpenClaw Gateway. All Gateway communication MUST be proxied through the Deck Server's API routes and SSE endpoint.

#### Scenario: No direct Gateway access from browser

- **WHEN** the browser application initializes
- **THEN** it SHALL only communicate with the Deck Server via REST API calls and the SSE stream endpoint — no WebSocket or direct TCP connection to the Gateway SHALL be established from client-side code

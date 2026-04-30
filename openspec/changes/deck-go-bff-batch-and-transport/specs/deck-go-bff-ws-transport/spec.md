## ADDED Requirements

### Requirement: BFF exposes WebSocket upgrade endpoint for client-edge transport

deck-go BFF SHALL expose `GET /api/v1/runtimes/{rt}/gateway/ws` that performs HTTP-to-WebSocket upgrade and provides frame-level pass-through to the openclaw gateway. The endpoint SHALL coexist with `/api/v1/runtimes/{rt}/gateway/rpc` (HTTP) and `/api/v1/runtimes/{rt}/gateway/batch` (HTTP); semantically equivalent operations on the same runtime SHALL produce identical results regardless of transport.

#### Scenario: Upgrade succeeds with valid token in Authorization header

- **WHEN** a client opens a WebSocket connection to `/api/v1/runtimes/rt_local/gateway/ws` with `Authorization: Bearer <valid-deck-token>`
- **THEN** the BFF responds with HTTP 101 Switching Protocols and the WebSocket connection is established

#### Scenario: Upgrade succeeds with token in query parameter (browser fallback)

- **WHEN** a client opens a WebSocket connection to `/api/v1/runtimes/rt_local/gateway/ws?token=<valid-deck-token>` without Authorization header
- **THEN** the BFF responds with HTTP 101 and the connection is established

#### Scenario: Upgrade fails with invalid token

- **WHEN** a client attempts the upgrade with no token or an invalid token
- **THEN** the BFF responds with HTTP 401 Unauthorized and no WebSocket connection is established

#### Scenario: Upgrade fails with unknown runtime

- **WHEN** a client attempts the upgrade with `runtimeId` that is not the registered runtime
- **THEN** the BFF responds with HTTP 404 with body `{error:{code:"RUNTIME_NOT_FOUND"}}`

### Requirement: WebSocket transport uses connect-time auth, not per-frame auth

The BFF SHALL validate the deck-token during the upgrade handshake. Subsequent frames on the established WebSocket SHALL NOT carry the token. To bound token revocation exposure, the BFF SHALL re-check the originally authenticated token against the current deck-go access-token state during heartbeat processing and SHALL close revoked or rotated-token connections within 60 seconds.

#### Scenario: Frames sent after upgrade do not require token

- **WHEN** an authenticated WebSocket connection is established and the client sends `{type:"req", id:"1", method:"health"}` without an embedded token
- **THEN** the BFF forwards the frame to openclaw and returns the response without rejecting the frame

#### Scenario: Token revocation closes live connections within heartbeat window

- **WHEN** the deck-token is revoked while a WebSocket is active
- **THEN** the active connection may continue until the next heartbeat validation, but BFF MUST close it within 60 seconds using a legal close code

### Requirement: BFF transparently forwards typed RPC frames

For every client-sent frame `{type:"req", id, method, params}`, the BFF SHALL first validate `method` against the same `generated.TypedMethodNames` allowlist used by HTTP `/gateway/rpc`. Allowed frames SHALL be forwarded equivalently to openclaw and the response frame SHALL be returned to the client preserving `id`, `ok`, and `payload | error` fields exactly. Disallowed frames SHALL return an error response to the same client and SHALL NOT be forwarded.

#### Scenario: Single typed RPC over WebSocket succeeds

- **WHEN** the client sends `{type:"req", id:"frame-1", method:"agents.list", params:{}}`
- **THEN** the client receives `{type:"res", id:"frame-1", ok:true, payload:{agents:[...]}}` whose payload bytes are equivalent to the same call made via `POST /api/v1/runtimes/{rt}/gateway/rpc`

#### Scenario: gateway.batch over WebSocket is supported

- **WHEN** the client sends `{type:"req", id:"frame-2", method:"gateway.batch", params:{calls:[...]}}`
- **THEN** the response is `{type:"res", id:"frame-2", ok:true, payload:{results:[...]}}` with the same fan-out semantics as the HTTP `/gateway/batch` endpoint

#### Scenario: Disallowed method over WebSocket is rejected before forwarding

- **WHEN** the client sends `{type:"req", id:"frame-3", method:"internal.untyped.debug", params:{}}`
- **THEN** the client receives `{type:"res", id:"frame-3", ok:false, error:{code:"INVALID_GATEWAY_METHOD", ...}}` and openclaw receives no forwarded frame for that method

### Requirement: Multiple WebSocket clients share BFF's single openclaw connection

To prevent O(N×M) backend connections, the BFF SHALL multiplex multiple client WebSocket connections over its single openclaw connection by prefixing client frame ids before forwarding and unprefixing on response.

#### Scenario: Two clients send concurrent requests with overlapping frame ids

- **WHEN** client A and client B both send `{type:"req", id:"1", method:"health"}` concurrently
- **THEN** each client receives its own response and there is no cross-talk between clients

#### Scenario: Frame id collision is prevented by BFF prefixing

- **WHEN** the BFF forwards client A's frame id "1" to openclaw
- **THEN** the forwarded frame id is `<bff-client-prefix>-1` (or equivalent unique prefix), and the response is unprefixed before delivery to client A

### Requirement: WebSocket transport supports event subscription forwarding

When a client invokes `*.subscribe` over the WebSocket, the BFF SHALL forward subsequent event frames from openclaw matching that subscription to the originating client (and only that client unless multiple clients subscribed).

#### Scenario: Single client receives subscribed events

- **WHEN** client A sends `{type:"req", id:"sub-1", method:"sessions.messages.subscribe", params:{key:"s1"}}` and openclaw later emits a matching `session.message` event
- **THEN** client A receives `{type:"event", event:"session.message", payload:{...}}` and other connected clients do NOT receive this event unless they also subscribed

### Requirement: WebSocket transport implements heartbeat with timeout

The BFF SHALL send a WebSocket ping frame every 30 seconds and SHALL close the connection if no pong is received within 60 seconds.

#### Scenario: Idle connection stays alive with proper pong response

- **WHEN** a client maintains an idle WebSocket connection and responds to ping frames
- **THEN** the connection remains established indefinitely

#### Scenario: Unresponsive client is disconnected

- **WHEN** a client fails to respond to two consecutive ping frames within 60s
- **THEN** the BFF closes the WebSocket with a legal timeout close code (for example app-defined `4000`) and decrements its client-side ref count; tests MUST NOT require BFF to transmit reserved code `1006`

### Requirement: WebSocket transport does not extend openclaw connection lifecycle

When a client WebSocket closes, the BFF SHALL NOT close its underlying single connection to openclaw, because the latter is shared across all clients and HTTP requests.

#### Scenario: Last WebSocket client disconnect does not cascade to openclaw

- **WHEN** the last connected client WebSocket closes
- **THEN** the BFF's openclaw `Realtime` connection remains open, ready to serve future HTTP RPC or new WebSocket clients

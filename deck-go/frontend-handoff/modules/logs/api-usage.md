# logs - API usage

## Deck-facing API

### `GET /logs`

Frontend wrapper:

```ts
fetchLogsTail({ cursor?: number; limit?: number; maxBytes?: number })
```

Response:

```ts
type DeckGoLogsTailResponse = {
  cursor?: number;
  lines?: unknown[];
  reset?: boolean;
};
```

Usage rules:

- The production panel should pass `cursor`, `limit: 200`, and
  `maxBytes: 65536`.
- `lines` may contain strings or objects. Parse defensively.
- Missing optional fields render as unavailable, empty, or omitted.
- The UI must not add level/source/session query params in this change.

### `GET /logs/stream`

Frontend wrapper:

```ts
streamLogEvents({
  signal,
  initialLastEventId,
  onStatusChange,
  onEvent,
});
```

Event envelope:

```ts
type DeckGoLogStreamEvent = {
  id?: string;
  event?: string;
  data?: string;
  json?: unknown;
};
```

Known event kinds:

- `log.batch`: payload may include `cursor?: number` and `lines?: unknown[]`.
- `log.reset`: payload resets local tail lines.

## Backend chain

```txt
LogsPanel
  -> frontend-new/src/api.ts
  -> GET /logs or /logs/stream
  -> deck-go Go BFF
  -> runtime facade
  -> OpenClaw Gateway logs.tail
```

Current exploration found no deterministic `/logs` query-forwarding drift:
`cursor`, `limit`, and `maxBytes` are forwarded by the Go BFF.

## Contract-chain exception

Gateway `logs.tail` is still untyped in deck-go generated Gateway artifacts
because upstream OpenClaw does not currently expose a schema for that method.
This is an existing `upstream-schema-missing` exception and is not fixed by this
frontend visual pass.

## Mock requirements

The mock Gateway fixture should return contract-shaped data for `logs.tail`:

```json
{
  "cursor": 4208,
  "lines": [
    "2026-05-03T08:41:18Z [INFO] [gateway] gateway ready sessionKey=sess-main",
    {
      "timestamp": "2026-05-03T08:41:24Z",
      "level": "warn",
      "source": "agent",
      "sessionKey": "sess-build",
      "message": "tool retry scheduled sessionKey=sess-build"
    }
  ],
  "reset": false
}
```

SSE mock behavior can be implemented by the existing Go BFF stream loop polling
the mock `logs.tail` method. Visual E2E evidence should be labeled as mock
visual coverage only.

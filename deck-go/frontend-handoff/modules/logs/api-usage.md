# logs — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The logs module reads tail and stream evidence from the deck-go BFF, which
forwards to upstream OpenClaw `gateway.logs.*`. The browser never calls
Gateway directly.

## Deck-facing API

### `GET /api/deck/logs`

Wrapper:

```ts
fetchLogsTail({ cursor?: number; limit?: number; maxBytes?: number })
  : Promise<DeckGoLogsTailResponse>
```

Request params:

- `cursor` — last-seen cursor for incremental tail. Initial fetch omits it.
- `limit` — maximum lines to return (prototype + production default `200`).
- `maxBytes` — soft cap on response bytes (prototype + production `65536`).

Response:

```ts
type DeckGoLogsTailResponse = {
  cursor?: number;
  lines?: unknown[];
  reset?: boolean;
};
```

`reset: true` means the tail server-side window rolled over; the client should
clear local rows and keep `cursor` from the response as the new anchor.

### `GET /api/deck/logs/stream`

Wrapper:

```ts
streamLogEvents({
  signal: AbortSignal,
  initialLastEventId: string | null,
  onStatusChange: (s: "connecting" | "connected" | "reconnecting" | "error") => void,
  onEvent: (evt: DeckGoLogStreamEvent) => void,
});
```

Event envelope:

```ts
type DeckGoLogStreamEvent = {
  id?: string;
  event?: string; // "log.batch" | "log.reset"
  data?: string; // raw SSE data line
  json?: unknown; // parsed JSON payload (when present)
};
```

Known `event` kinds:

- `log.batch` — payload `{ cursor?: number, lines?: unknown[] }`. Append the
  lines, persist `id` to `deckGoLogsLastEventId`, persist `cursor` to
  `deckGoLogsCursor`.
- `log.reset` — payload `{ reset: true, cursor?: number }`. Drop local lines,
  reset cursor, push a reset row into the live tape.

## Mock requirements

```ts
{
  cursor: 4498,
  reset: false,
  lines: [
    {
      cursor: 4498,
      ts: "2026-05-03T08:31:18.422Z",
      level: "info",
      source: "gateway",
      sessionKey: "sess-main",
      message: "gateway ready bind=127.0.0.1:18789 runtime=bundled",
      correlationId: "trace-9d8a2f",
      fields: { method: "deck.config.get", latencyMs: 18, peerId: "tcp-127.0.0.1-49382" }
    },
    /* ... ≥ 100 entries covering all 4 levels × 8 sources × 9 sessions ... */
    {
      cursor: 4377,
      ts: "2026-05-03T09:18:02.901Z",
      level: "error",
      source: "agent",
      sessionKey: "sess-incident-2026-05-03",
      message: "agent handoff failed sessionKey=sess-incident reason=\"upstream timeout\"",
      correlationId: "trace-feec22",
      fields: { step: 73, tokens: 4124, model: "sonnet-4.6" },
      stack: "Error: upstream timeout for visual fixture\n    at AgentHandoff.dispatch (...)\n    ..."
    }
  ]
}
```

Mock must include:

- ≥ 100 entries (prototype seeds 124 via mulberry32).
- All 4 levels (debug / info / warn / error) — error rate roughly 8%.
- ≥ 6 sources — prototype uses 8 (gateway / agent / channel / tool / deck-bff /
  scheduler / router / http).
- ≥ 5 sessions — prototype uses 9.
- ~50% of lines carry a `correlationId` — at least 3 traces have ≥ 5 lines so
  the "filter by correlation" workflow produces a meaningful span.
- All error lines carry a `stack` string.

## BFF projection assumption — `lines: unknown[]` shape

The contract types `lines` as `unknown[]`. Today Gateway forwards strings _or_
objects depending on the upstream emitter. The prototype assumes the BFF
normalizes each line into:

```ts
{
  cursor: number,
  ts: string,             // ISO8601
  level: "debug" | "info" | "warn" | "error",
  source: string,
  sessionKey: string,
  message: string,
  correlationId?: string,
  fields?: Record<string, unknown>,
  stack?: string          // present iff level === "error"
}
```

If upstream OpenClaw publishes a `DeckGoLogLine` schema this becomes
contractual. Until then production must defensively parse both shapes — see
`api-discrepancy.md` if the runtime shape diverges from the prototype.

## Endpoint summary

| Endpoint                          | Method    | When                          | DTO                           |
| --------------------------------- | --------- | ----------------------------- | ----------------------------- |
| `/api/deck/logs`                  | GET       | Initial load + manual refresh | `DeckGoLogsTailResponse`      |
| `/api/deck/logs/stream`           | GET (SSE) | Live tape + line append       | `DeckGoLogStreamEvent` frames |
| (planned) `/api/deck/logs/export` | GET       | Future durable download       | `application/octet-stream`    |

## Backend chain

```
LogsApp
  → frontend-new/src/api/logs.ts
  → deck-go Go BFF routes
    ├── GET /api/deck/logs        → Gateway RPC logs.tail
    └── GET /api/deck/logs/stream → Gateway SSE logs.stream
  → Gateway (only via the BFF / runtime boundary)
```

## Contract chain exception

Gateway `logs.tail` is currently flagged
`upstream-schema-missing` in deck-go's generated Gateway protocol artifacts —
upstream OpenClaw does not publish a TypeBox schema for the method. This v2
visual pass does **not** fix the upstream gap; it documents the assumed shape
above and relies on the BFF for normalization.

## Open contract assumptions

- **`lines: unknown[]`** — assumed normalized to the LogLine shape above.
  Confirm with backend before treating it as a contract.
- **Session filter** — local-only on parsed `sessionKey`. The wrapper does
  **not** pass a `session` query param to Gateway in this change.
- **Level / source filter** — local-only on parsed level / source. Same as
  session: no Gateway query param.
- **`correlationId` is exact match** — substring match would scale poorly with
  4-byte trace ids (`trace-9d8a2f`) — exact-match keeps the UI predictable.
- **Buffer cap = 5000** is a UI choice. Backend stream may push more; client
  drops the oldest 1,000 on overflow.
- **Export = preview only.** No real download endpoint exists in the contract
  yet. The dialog is intentionally read-only with a disabled "Download .log"
  button.

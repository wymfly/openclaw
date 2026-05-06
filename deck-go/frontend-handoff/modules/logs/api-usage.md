# logs — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The logs module reads tail and stream evidence from the deck-go BFF, which
forwards to upstream OpenClaw `gateway.logs.*`. The browser never calls
Gateway directly.

## Deck-facing API

### `GET /api/logs`

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
  file?: string;
  lines?: string[];
  reset?: boolean;
  size?: number;
  truncated?: boolean;
};
```

`reset: true` means the tail server-side window rolled over; the client should
clear local rows and keep `cursor` from the response as the new anchor.

### `GET /api/logs/stream`

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

- `log.batch` — payload `{ cursor?: number, lines?: string[] }`. Append the
  lines, persist `id` to `deckGoLogsLastEventId`, persist `cursor` to
  `deckGoLogsCursor`.
- `log.reset` — payload `{}` today. Drop local lines and push a reset row into
  the live tape. If a future stream contract adds a cursor, update
  `deck-go/contracts/source/deck-streams.contract.json` first.

## Mock requirements

```ts
{
  cursor: 4498,
  reset: false,
  lines: [
    "2026-05-03T08:31:18.422Z [INFO] [gateway] gateway ready sessionKey=sess-main bind=127.0.0.1:18789 runtime=bundled correlationId=trace-9d8a2f method=deck.config.get latencyMs=18",
    /* ... ≥ 100 entries covering all 4 levels × 8 sources × 9 sessions ... */
    "2026-05-03T09:18:02.901Z [ERROR] [agent] agent handoff failed sessionKey=sess-incident-2026-05-03 correlationId=trace-feec22 reason=\"upstream timeout\" model=gpt-5.4 step=73 tokens=4124"
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
- Error-line stack evidence is not contractual in `string[]` rows; production
  shows a stack section only when a future/object-shaped row includes one.

## BFF projection assumption — typed string rows, parsed local shape

The current contract types `lines` as `string[]` on both generated Gateway and
Deck-facing DTOs. Production parses those strings into local display rows. The
prototype's visual model is the parsed local shape:

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

If upstream OpenClaw publishes a `DeckGoLogLine` schema this richer shape may
become contractual. Until then production must parse string rows and may keep
defensive compatibility for historical object-shaped fixtures — see
`api-discrepancy.md` if the runtime shape diverges from the current string-row
contract.

## Endpoint summary

| Endpoint                     | Method    | When                          | DTO                           |
| ---------------------------- | --------- | ----------------------------- | ----------------------------- |
| `/api/logs`                  | GET       | Initial load + manual refresh | `DeckGoLogsTailResponse`      |
| `/api/logs/stream`           | GET (SSE) | Live tape + line append       | `DeckGoLogStreamEvent` frames |
| (planned) `/api/logs/export` | GET       | Future durable download       | `application/octet-stream`    |

## Backend chain

```
LogsApp
  → frontend-new/src/api.ts
  → deck-go Go BFF routes
    ├── GET /api/logs        → Gateway RPC logs.tail
    └── GET /api/logs/stream → BFF SSE poller over logs.tail
  → Gateway (only via the BFF / runtime boundary)
```

## Contract chain note

Gateway `logs.tail` is typed in the current generated protocol:
`LogsTailParams` and `LogsTailResult` include `cursor`, `file`, `lines`, `size`,
`reset`, and `truncated`. The remaining dynamic surface is the SSE event
`json` payload leaf carried by `DeckGoLogStreamEvent`.

## Open contract assumptions

- **`lines: string[]`** — parsed locally into the LogLine display shape above.
  Do not treat structured fields/stack as contractual until a `DeckGoLogLine`
  schema exists.
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

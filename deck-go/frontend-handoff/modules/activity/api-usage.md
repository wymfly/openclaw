# activity — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The activity module consumes the BFF `activity` endpoint, which is itself a projection over
Gateway lifecycle messages, agent run events, channel webhooks, and audit-log writes. The
browser never calls Gateway directly.

## Deck-facing API

### `GET /api/deck/activity`

Wrapper: `fetchActivity()`. Response: `DeckGoActivityResponse` with
`events: DeckGoActivityEvent[]`.

Snapshot of recent events. Backend chooses retention window; deck-go currently asks for the
last 24h.

### `GET /api/deck/activity/stream` (production target)

Wrapper: `streamActivity(handler)`. Server-sent events stream of fresh events. Not exercised
in the prototype; documented here as the production target.

## DTO shapes (canonical)

```ts
type DeckGoActivityEvent = {
  id: string;
  timestamp: number;
  type: string; // open enum; see TYPE_FAMILY in icons.jsx for the closed set the panel handles
  agentId?: string;
  agentName?: string;
  description: string;
  details?: string;
};

type DeckGoActivityResponse = {
  events: DeckGoActivityEvent[];
};
```

## BFF projections (not part of the contract)

### Severity decoding

The contract does not carry a severity field. The deck-go BFF could project one in the future;
today the prototype derives severity client-side via `TYPE_FAMILY` in `icons.jsx`:

```ts
type Severity = "info" | "ok" | "warn" | "err" | "muted";
const TYPE_FAMILY: Record<string, { Icon: ComponentType; severity: Severity }>;
```

If the BFF starts emitting `severity` directly, drop the client-side mapping. Until then,
unknown event types fall through to `severity: "muted"` with a generic Activity glyph.

### Family decoding

Same shape: families (`agent | tool | msg | subagent | channel | ops`) are derived from `type`
prefix on the client. If the BFF prefers to emit `family` directly, the toolbar maps directly
without the FILTER_GROUPS heuristic.

## Endpoint summary

| Endpoint                          | Method | When                   | DTO                      |
| --------------------------------- | ------ | ---------------------- | ------------------------ |
| `/api/deck/activity`              | GET    | Initial load + refresh | `DeckGoActivityResponse` |
| `/api/deck/activity/stream` (SSE) | GET    | Live tail (production) | newline-delimited events |

## Backend chain

```
ActivityPanel
  → frontend-new/src/api/activity.ts
  → deck-go Go BFF route
    ├── Gateway lifecycle messages
    ├── agent run events
    ├── channel webhook frames
    └── audit log writes
  → unified DeckGoActivityEvent
```

## Mock requirements

- 60+ events across all 21 mock event types defined in `EVENT_TYPES`.
- Severity coverage: `info`, `ok`, `warn`, `err` all represented.
- At least 4 system-only events (no `agentId`).
- At least one event per family for filter sanity.

## Open contract assumptions

- **`type` is open string.** Prototype maps the closed set above; new types fall through.
- **No severity in contract.** Severity is BFF / client projection. Stable until contract
  expands.
- **`details` is freeform string.** Prototype treats it as preformatted text; production
  may want to parse known prefixes (e.g., `runId=`) into linkified affordances.
- **Live tail.** Not in current contract. Prototype shows snapshot only. SSE / WebSocket
  contract should match the snapshot DTO so the deck-go renderer is shape-stable.
- **Retention window.** Snapshot returns "last 24h" today; not part of the contract. Production
  may need a `?since=<ms>` query param for paginated history.

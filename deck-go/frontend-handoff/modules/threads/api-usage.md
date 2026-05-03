# threads — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The threads module reads bindings from the deck-go BFF, which forwards to
upstream OpenClaw `gateway.threads.list`. Browser code never calls Gateway
directly.

## Deck-facing API

### `GET /api/deck/threads`

Wrapper:

```ts
fetchThreads({ channelKind?, agentId?, status? })
  : Promise<DeckGoThreadsResponse>
```

Query params:

- `channelKind` — optional filter (`discord` / `telegram` / `wecom` /
  `slack` / `qq`).
- `agentId` — optional filter on `agentId`.
- `status` — `active` | `all` (default `active`).

Response:

```ts
type DeckGoThreadsResponse = {
  threads?: DeckGoThreadEntry[];
};

type DeckGoThreadEntry = {
  threadId: string;
  channelId: string;
  agentId: string;
  targetSessionKey: string;
  targetKind: string; // "claude-code-session" | "agent-loop" | "external-bot"
  boundAt: number; // unix ms
  lastActivityAt: number;
  accountId: string;
  boundBy: string;
  label?: string;
};
```

### `DELETE /api/deck/threads/<threadId>` _(BFF assumed)_

Wrapper:

```ts
unbindThread(threadId: string): Promise<{ ok: boolean }>
```

Hard removes the binding. The conversation transcript under
`targetSessionKey` is NOT deleted.

### `PATCH /api/deck/threads/<threadId>` _(BFF assumed)_

Wrapper:

```ts
patchThread(
  threadId: string,
  partial: Partial<Pick<DeckGoThreadEntry, "agentId" | "label">>
): Promise<{ thread: DeckGoThreadEntry }>
```

Used by **Re-bind** (sets `agentId`) and **Rename label** (sets `label`,
or clears via `label: null`).

## DTO shapes (canonical)

```ts
type DeckGoThreadEntry = {
  /* see above */
};
type DeckGoThreadsResponse = { threads?: DeckGoThreadEntry[] };
```

## BFF projections (not part of the contract)

### `recentActivity: ActivityEvent[]`

```ts
interface ActivityEvent {
  ts: number;
  kind: "tool.call" | "model.call" | "channel.inbound" | "channel.outbound" | "agent.handoff";
  title: string;
  note?: string;
}
```

BFF projection over `DeckGoMonitorRunEvent` filtered by
`session_key = thread.targetSessionKey`. Used by the **Recent activity**
tab.

### `auditTrail: AuditEvent[]`

```ts
interface AuditEvent {
  ts: number;
  actor: "system" | string; // "operator:user@example.com" | "manual:legacy-importer"
  action:
    | "bound"
    | "auto-bound"
    | "imported"
    | "unbound"
    | "rebound"
    | "label-set"
    | "label-updated"
    | string;
  note?: string;
}
```

BFF projection over the BFF mutation log. Used by the **Audit** tab.

## Endpoint summary

| Endpoint                                | Method | When                        | DTO                             |
| --------------------------------------- | ------ | --------------------------- | ------------------------------- |
| `/api/deck/threads`                     | GET    | List view                   | `DeckGoThreadsResponse`         |
| `/api/deck/threads/<id>` (BFF assumed)  | PATCH  | RebindDialog / RenameDialog | `{ thread: DeckGoThreadEntry }` |
| `/api/deck/threads/<id>` (BFF assumed)  | DELETE | UnbindDialog                | `{ ok: boolean }`               |
| `/api/deck/threads/<id>/activity` (BFF) | GET    | Detail Recent activity tab  | `ActivityEvent[]`               |
| `/api/deck/threads/<id>/audit` (BFF)    | GET    | Detail Audit tab            | `AuditEvent[]`                  |

(The mutation endpoints + last two are BFF-only and not part of the raw
Gateway threads contract.)

## Backend chain

```
ThreadsApp
  → frontend-new/src/api/threads.ts
  → deck-go Go BFF routes
    ├── Gateway RPC threads.list
    ├── BFF mutations (unbind / patch — BFF-owned)
    └── BFF projections (activity from monitor events, audit from mutation log)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- ≥ 8 thread bindings (prototype seeds 10).
- Coverage of all 5 channel kinds (discord / telegram / wecom / slack / qq).
- All 3 target kinds (claude-code-session / agent-loop / external-bot).
- Mix of `boundBy`: operator (≥3), auto-binding (≥3), manual:legacy-importer (≥2).
- ≥ 2 stale rows (lastActivityAt > 24h ago) to validate the stale tint.
- ≥ 5 rows with optional `label`, ≥ 3 without.
- Recent activity for at least 6 threads.
- Audit projection for all bindings.

## Open contract assumptions

- **Mutation endpoints (PATCH/DELETE)** are BFF-assumed in this v2 visual
  pass. Confirm with backend whether they exist as documented or whether
  Gateway should expose typed mutation RPCs.
- **`targetKind`** is `string` in the raw contract — the prototype assumes
  the closed enum `claude-code-session | agent-loop | external-bot`.
  Unknown values fall back to `iron` tone.
- **`boundBy`** is free-form `string`. The prototype parses prefix (`operator:` /
  `manual:` / `system` / `auto-binding`) for display tone but does **not**
  treat it as enum.
- **`channelId`** is `<channelKind>:<channel-specific-id>`. Used for
  `channelKindFromId` parser (split on `:`). If upstream changes the
  separator the prototype breaks.
- **Recent activity** is BFF-projected from `DeckGoMonitorRunEvent` keyed by
  `session_key`. There is no contract guarantee that every binding has
  monitor events — the empty-card fallback handles the gap.
- **Audit projection** is BFF-only. There is no contract for binding
  history.
- **Stale threshold = 24h** is a UI choice, not a contract field.
- **No transcript view** — the contract has no message DTO. The "Open chat"
  CTA defers to the `Chat` panel for the actual conversation; PRD's
  original "transcript with branch indicators" is dropped per
  contract-reality (see README scope correction).

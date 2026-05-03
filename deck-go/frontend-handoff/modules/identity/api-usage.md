# identity — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The identity module reads bindings from the deck-go BFF, which forwards
to upstream OpenClaw `gateway.deck.identity.*` Gateway methods. Browser
code never calls Gateway directly.

## Deck-facing API

### `GET /api/deck/identity`

Wrapper:

```ts
fetchIdentityLinks(): Promise<DeckGoIdentityLinksResponse>
```

Response:

```ts
type DeckGoIdentityLinksResponse = {
  links: DeckGoIdentityLink[];
  configHash?: string;
};

type DeckGoIdentityLink = {
  canonical: string;
  peers: DeckGoIdentityPeer[];
};

type DeckGoIdentityPeer = {
  channel: string;
  peerId: string;
};
```

The contract is **minimal**: only `channel` + `peerId` per peer. The
prototype enriches each peer with `displayName`, `lastSeenMs`,
`lastLinkedMs`, and `actor` — these are **BFF projections**, not in
the wire contract. Production should either:

- Extend `DeckGoIdentityPeer` to include the activity fields (clean
  but adds wire weight every fetch), or
- Add a sibling `GET /api/deck/identity/activity` endpoint and join
  client-side (lighter contract; one extra request per page-load).

See open question §3 in README.

### `POST /api/deck/identity` — Link

Wrapper:

```ts
linkIdentityPeer(canonical: string, channel: string, peerId: string, baseHash: string): Promise<DeckGoIdentityLinksResponse>
```

Body:

```json
{
  "action": "link",
  "canonical": "main",
  "channel": "telegram",
  "peerId": "tg-daisy-personal",
  "baseHash": "identity-hash-visual-2"
}
```

Response: refreshed `DeckGoIdentityLinksResponse` with new
`configHash`.

Errors:

- `409 Conflict` — `baseHash` mismatch. UI surfaces "baseHash drift —
  refresh and retry" in the dialog phase strip.
- `400 Bad Request` — validation (e.g., empty peerId). UI surfaces in
  dialog field error.
- `5xx` — generic. Dialog stays in error phase.

### `POST /api/deck/identity` — Unlink

Wrapper:

```ts
unlinkIdentityPeer(canonical: string, channel: string, peerId: string, baseHash: string): Promise<DeckGoIdentityLinksResponse>
```

Body:

```json
{
  "action": "unlink",
  "canonical": "main",
  "channel": "telegram",
  "peerId": "tg-daisy-personal",
  "baseHash": "identity-hash-visual-2"
}
```

Response: refreshed `DeckGoIdentityLinksResponse` with peer removed.

### `POST /api/deck/identity` — Rename / Create / Delete (prototype-assumed)

**These three mutations are not in the contract today.** The prototype
assumes they extend the same `POST /api/deck/identity` action surface:

```json
// Rename
{
  "action": "rename",
  "canonical": "team",
  "newName": "team-builder",
  "baseHash": "identity-hash-visual-2"
}

// Create
{
  "action": "create",
  "canonical": "review-pool",
  "description": "Reserved review canonical",
  "baseHash": "identity-hash-visual-2"
}

// Delete
{
  "action": "delete",
  "canonical": "review-pool",
  "baseHash": "identity-hash-visual-2"
}
```

Production needs to add these (see open question §1 in README) before
the panel can fully implement v2 behavior. Until then, the UI should
surface those CTAs as disabled with explanatory tooltip.

### `GET /api/agents/{agentId}/identity`

Wrapper:

```ts
fetchAgentIdentity(agentId: string): Promise<DeckGoAgentIdentityResponse>
```

Response:

```ts
type DeckGoAgentIdentityResponse = {
  agentId: string;
  name?: string;
  avatar?: string;
  emoji?: string;
};
```

Used to surface the emoji on the canonical hero when canonical name
matches agentId. The broader profile UX lives in the `agents` panel.

### `GET /api/bootstrap/status`

The identity module reads `bootstrap.ok` to gate mutations (see
`states.md`). Same shape as in settings panel.

## DTO shapes (canonical)

```ts
type DeckGoIdentityPeer = {
  /* see above */
};
type DeckGoIdentityLink = {
  /* see above */
};
type DeckGoIdentityLinksResponse = {
  /* see above */
};
type DeckGoAgentIdentityResponse = {
  /* see above */
};
```

## BFF projections (not part of the contract)

### `peer activity (lastSeenMs / lastLinkedMs / actor / displayName)`

The prototype enriches each peer with these fields. The BFF would
project from:

- `lastSeenMs` — last channel event from this peerId (channels mutation
  log).
- `lastLinkedMs` — when this link was created (identity mutation log).
- `actor` — operator who linked the peer (mutation log).
- `displayName` — channel-side name lookup (Discord username, Telegram
  display name, etc.).

These are convenient for UX but not contract-required. If production
goes the sibling-endpoint route (open question §3), this projection
moves to a separate `GET /api/deck/identity/activity` endpoint and the
UI joins client-side.

### `recentMutations: SaveEvent[]`

```ts
interface SaveEvent {
  ts: number;
  actor: string; // "operator:user@example.com" | "system" | "automation:..."
  kind: "link-peer" | "unlink-peer" | "rename-canonical" | "create-canonical" | "delete-canonical";
  canonical: string; // current canonical name (post-rename)
  peer?: { channel: string; peerId: string };
  from?: string; // for rename: previous name
  to?: string; // for rename: new name
  ok: boolean;
  error?: string;
}
```

BFF projection over the BFF mutation log. The prototype shows the last
8 entries scoped to the selected canonical.

## Endpoint summary

| Endpoint                             | Method | When                                       | DTO                                       |
| ------------------------------------ | ------ | ------------------------------------------ | ----------------------------------------- |
| `/api/deck/identity`                 | GET    | Initial load + Refresh                     | `DeckGoIdentityLinksResponse`             |
| `/api/deck/identity` (action=link)   | POST   | LinkPeerDialog confirm                     | `DeckGoIdentityLinksResponse` (refreshed) |
| `/api/deck/identity` (action=unlink) | POST   | UnlinkPeerDialog confirm                   | `DeckGoIdentityLinksResponse` (refreshed) |
| `/api/deck/identity` (action=rename) | POST   | RenameCanonicalDialog confirm (TBD)        | `DeckGoIdentityLinksResponse` (refreshed) |
| `/api/deck/identity` (action=create) | POST   | CreateCanonicalDialog confirm (TBD)        | `DeckGoIdentityLinksResponse` (refreshed) |
| `/api/deck/identity` (action=delete) | POST   | DeleteCanonicalDialog confirm (TBD)        | `DeckGoIdentityLinksResponse` (refreshed) |
| `/api/agents/{agentId}/identity`     | GET    | Hero render when canonical matches agentId | `DeckGoAgentIdentityResponse`             |
| `/api/bootstrap/status`              | GET    | Page load + 30s poll                       | `DeckGoBootstrapStatusResponse`           |

## Backend chain

```
IdentityApp
  → frontend-new/src/api/identity.ts
  → deck-go Go BFF routes
    ├── deck-go/backend/internal/server/inventory.go (link + unlink handlers)
    ├── Gateway typed client: deck.identity.list / deck.identity.link / deck.identity.unlink
    └── BFF projection: recentMutations + peer activity (mutation log)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 5 canonicals — at minimum:
  - 1 with peers across 3+ channels (multi-channel happy path)
  - 1 with peers across 1 channel only
  - 1 empty (delete-eligible boundary)
  - 1 named `system` (immutable boundary)
  - 1 with automation actor (e.g., hooks/ops-rotation)
- 4 recentMutations: 3 ok across link/unlink/rename + 1 error (baseHash drift on link)
- Stable `configHash` (e.g., `identity-hash-visual-2`); advances on every successful mutation.
- `bootstrap.ok === true` by default; Tweaks toggle could simulate
  `false` for the disabled-CTAs state.
- `agentProfile` for the canonical that matches `main` (so emoji
  prefix renders).

## Error and drift rules (production)

- Missing `configHash` blocks every mutation in the UI. The dialogs
  refuse to submit.
- Failed mutation refreshes the list so the visible hash stays
  backend-owned.
- 409 from the BFF means the operator's `baseHash` is stale —
  refresh-and-retry. The UI must NOT auto-retry (the new hash may
  reflect a mutation the operator didn't intend to follow).
- Do not infer channel display names, trust, proofing, account
  ownership, or contact graph from the identity payload.
- Do not add direct Gateway calls from browser code.

## Open contract assumptions

- **Rename / Create / Delete** mutations have no contract today. See
  open question §1 in README.
- **Peer activity** (lastSeen / lastLinked / actor / displayName) is
  BFF-projected. See open question §3 in README.
- **`recentMutations`** is BFF-projected. Should the contract gain
  `GET /api/deck/identity/mutations?limit=N`?
- **Channel taxonomy** is open (`channel: string`). Production may want
  an enum. See open question §5 in README.
- **`system` canonical reserved name** is UI-only; should be a
  contract assertion or a `protected: true` flag.

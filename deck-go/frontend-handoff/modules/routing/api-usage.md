# routing - API usage

## Data sources

### `fetchRoutingBindings(params?)`

Wrapper around `GET /deck/routing`.

Query fields:

- `agentId?: string`
- `channel?: string`
- `accountId?: string`

Response:

```ts
type DeckGoRoutingListResponse = {
  bindings: DeckGoRoutingBinding[];
  defaultAgentId: string;
  dmScope: string;
  configHash: string;
};
```

Usage:

- initial load
- filter refresh
- post-mutation refresh
- binding queue and selected detail source

### `validateRoutingBinding(params)`

Wrapper around `POST /deck/routing` with `action: "validate"`.

Payload:

```ts
{
  agentId: string;
  match: DeckGoRoutingMatch;
}
```

Response:

```ts
type DeckGoRoutingValidateResponse = {
  ok: boolean;
  tier: string;
  conflicts: DeckGoRoutingConflict[];
};
```

Usage:

- validates the add-binding draft before or instead of writing config
- backend/Gateway result is authoritative over local advisory conflict markers

### `addRoutingBinding(params)`

Wrapper around `POST /deck/routing` with `action: "add"`.

Payload:

```ts
{
  agentId: string;
  match: DeckGoRoutingMatch;
  baseHash: string;
  comment?: string;
  position?: number;
}
```

Usage:

- adds a new binding
- second half of reorder flow after remove returns a fresh `configHash`

### `removeRoutingBinding(params)`

Wrapper around `POST /deck/routing` with `action: "remove"`.

Payload:

```ts
{
  id: string;
  baseHash: string;
}
```

Usage:

- removes the selected binding
- first half of reorder flow

### `simulateRouting(params)`

Wrapper around `POST /deck/routing` with `action: "simulate"`.

Payload:

```ts
{
  channel: string;
  accountId?: string;
  guildId?: string;
  teamId?: string;
  memberRoleIds?: string[];
  peer?: DeckGoRoutingPeer;
}
```

Response:

```ts
type DeckGoRoutingSimulateResponse = {
  agentId: string;
  matchedBy: string;
  sessionKey: string;
  tiers: DeckGoRoutingSimulationTier[];
};
```

Usage:

- route simulator card
- navigation bridge to agent/session/channel/access panels

### `patchDeckConfig({ session: { dmScope } }, configHash)`

Existing config patch wrapper.

Usage:

- updates the DM scope strategy
- must preserve base-hash behavior

### `fetchActivityEvents(20)`

Existing activity wrapper.

Usage:

- routing-adjacent activity section filters events whose type includes `routing` or `route`, or events tied to an `agentId`
- Gateway-not-configured sentinel renders the shared first-run empty state

## Mock rules

- Mock data must include at least three bindings across peer, guild/role, and channel tiers.
- Mock data must include one local conflict scenario to exercise advisory conflict markers.
- Mock simulation must include matched, checked, and skipped tiers.
- Mock mutation responses must include `configHash` so hash-aware UI can refresh.

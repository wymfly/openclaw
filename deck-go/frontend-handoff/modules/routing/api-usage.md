# API usage

DTO authority: `deck-go/contracts/source/deck-api.contract.ts:815-882`. The frontend speaks only to the Go BFF — never directly to the Gateway.

## DTOs

```ts
type DeckGoRoutingPeer = {
  kind: "direct" | "group" | "channel";
  id: string;
};

type DeckGoRoutingMatch = {
  channel: string;
  accountId?: string;
  peer?: DeckGoRoutingPeer;
  guildId?: string;
  roles?: string[];
  teamId?: string;
};

type DeckGoRoutingBinding = {
  id: string;
  agentId: string;
  tier: string; // "peer" | "guild+roles" | "guild" | "team" | "channel"
  match: DeckGoRoutingMatch;
  comment?: string;
};

type DeckGoRoutingConflict = {
  type: string; // "subset" | "shadowed-by" | "duplicate" (open enum)
  bindingId: string;
  agentId: string;
  detail: string;
};

type DeckGoRoutingListResponse = {
  bindings: DeckGoRoutingBinding[];
  defaultAgentId: string;
  dmScope: string;
  configHash: string;
};

type DeckGoRoutingAddResponse = {
  ok: boolean;
  binding: DeckGoRoutingBinding;
  configHash: string;
  warnings: DeckGoRoutingConflict[];
};

type DeckGoRoutingRemoveResponse = {
  ok: boolean;
  removed: DeckGoRoutingBinding;
  configHash: string;
  impact: string;
};

type DeckGoRoutingValidateResponse = {
  ok: boolean;
  tier: string;
  conflicts: DeckGoRoutingConflict[];
};

type DeckGoRoutingSimulationTier = {
  tier: string;
  matched: boolean;
  checked: boolean;
};

type DeckGoRoutingSimulateResponse = {
  agentId: string;
  matchedBy: string; // binding id or "default"
  sessionKey: string;
  tiers: DeckGoRoutingSimulationTier[];
};
```

The frontend MUST consume these via `import type { ... } from "@/types/deck-api"` — do not redeclare.

## Endpoints

The routing panel uses **two HTTP routes**:

### List — `GET /deck/routing`

```
GET /deck/routing[?agentId=...&channel=...&accountId=...]
→ 200 DeckGoRoutingListResponse
→ 401 if scope insufficient
```

Query filters are optional. Filtering happens on the BFF; the UI only sends non-empty values.

```ts
const list = await fetchRoutingBindings({ channel: "discord" });
// list.bindings - DeckGoRoutingBinding[]
// list.defaultAgentId - string
// list.dmScope - string
// list.configHash - string (REQUIRED for any subsequent mutation)
```

### Action-discriminated mutations — `POST /deck/routing`

```
POST /deck/routing
Content-Type: application/json
{ "action": "validate" | "add" | "remove" | "simulate", ... }
→ 200 (shape depends on action)
→ 400 invalid action / payload / hash mismatch
→ 401 if scope insufficient
→ 5xx upstream Gateway error
```

Action-by-action shapes:

| action     | request body                                                                            | response                        |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| `validate` | `{ action: "validate", agentId, match }`                                                | `DeckGoRoutingValidateResponse` |
| `add`      | `{ action: "add", agentId, match, baseHash, comment?, position? }`                      | `DeckGoRoutingAddResponse`      |
| `remove`   | `{ action: "remove", id, baseHash }`                                                    | `DeckGoRoutingRemoveResponse`   |
| `simulate` | `{ action: "simulate", channel, accountId?, peer?, guildId?, teamId?, memberRoleIds? }` | `DeckGoRoutingSimulateResponse` |

```ts
const v = await validateRoutingBinding({
  agentId: "ops",
  match: { channel: "discord", accountId: "enterprise" },
});
const added = await addRoutingBinding({
  agentId,
  match,
  baseHash: list.configHash,
  comment,
  position,
});
const removed = await removeRoutingBinding({ id: binding.id, baseHash: list.configHash });
const sim = await simulateRouting({
  channel: "discord",
  accountId: "enterprise",
  peer: { kind: "direct", id: "lead" },
});
```

### DM scope patch — reuses `patchDeckConfig`

```ts
await patchDeckConfig({ session: { dmScope: "per-channel-peer" } }, list.configHash);
```

DM scope changes are **not** a routing action — they go through the existing config patch wrapper because the scope lives in `session.dmScope` of the deck-go config schema.

### Activity — reuses `fetchActivityEvents`

```ts
const events = await fetchActivityEvents(20);
const routingEvents = events.filter(
  (e) => e.type.startsWith("routing.") || e.type.startsWith("route.") || !!e.agentId,
);
```

The activity panel filters routing-relevant events client-side. Production may add a server-side filter param to keep the payload small.

## Hash-aware mutation rule

**Every** mutating action requires `baseHash` (the current `configHash`). The BFF returns a new `configHash` on success; the UI re-renders the new hash via `<HashChip>` and uses it for the next mutation.

If a mutation's `baseHash` doesn't match the BFF's current state, the BFF returns 4xx with a hash-mismatch error. The UI must:

1. Surface a warn-tinted MutationStrip ("Config hash advanced; please refresh")
2. Re-fetch the list to get the new hash
3. Let the user retry the action

This is the deck-go config's standard optimistic-concurrency pattern.

## Caching strategy (production)

| Resource                           | Cache                                                        | Invalidation                                                |
| ---------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `GET /deck/routing`                | per-filter map; refetch on tab focus + Refresh               | After any `add` / `remove` / scope patch (success path)     |
| `POST validate` (draft)            | Not cached (each call has unique draft)                      | —                                                           |
| `POST add` / `remove` / `simulate` | Not cached (each call is a state mutation or a unique input) | —                                                           |
| `fetchActivityEvents`              | 10s TTL; refetch on tab focus + Refresh                      | After any routing mutation (push fresh activity to the top) |

## Drift gate

Run `cd deck-go && make contract-gate` after any DTO source edit. CI blocks merges that desync `deckapi.generated.go` and `deck-api.generated.ts` from `deck-api.contract.ts`.

## BFF projection

The BFF translates between contract DTOs and underlying Gateway typed methods:

- `GET /deck/routing` → `deck.routing.list` (typed; backed by a Deck view that batches `config.get` + `agents.list` when upstream Gateway path is not directly available)
- `POST /deck/routing` action=`validate` → `deck.routing.validate` (typed)
- `POST /deck/routing` action=`add` → `deck.routing.add` (typed)
- `POST /deck/routing` action=`remove` → `deck.routing.remove` (typed)
- `POST /deck/routing` action=`simulate` → `deck.routing.simulate` (typed)
- DM scope patch → `deck.config.patch` (existing typed method)

All routing methods are typed end-to-end. There are no dynamic-envelope exceptions in this panel.

The wire DTO must stay byte-stable across BFF refactors. The frontend MUST NOT depend on Gateway internal shapes.

## Error & drift rules

- Empty `bindings` (undefined or `[]`) renders empty queue + empty hero.
- Missing `comment` in a binding renders the row without the comment line.
- Missing optional match fields (accountId / peer / guildId / teamId / roles) gracefully shrink the match-chip-row.
- 4xx with hash mismatch → warn MutationStrip + auto-refetch + retry CTA.
- 4xx with validation failure (add) → render returned conflicts in the validation strip.
- 5xx → mutationStrip danger; preserve last-known state.
- `simulateRouting` returning matchedBy === "default" is a **legitimate** outcome, not an error — UI shows fall-through warn pill.
- Validate's `ok: false` is **advisory**, not blocking — operator may override and Add anyway. The Add request will be re-validated server-side.
- Move = remove + add (two POSTs in sequence). Partial failure (remove ok, add 5xx) is the BFF's responsibility to detect and roll back; the UI shows danger MutationStrip with retry.

## Scope & audit

| Action                       | Required scope   | Audit row                                          |
| ---------------------------- | ---------------- | -------------------------------------------------- |
| `GET /deck/routing`          | `operator.read`  | none                                               |
| `POST validate`              | `operator.read`  | none                                               |
| `POST simulate`              | `operator.read`  | none                                               |
| `POST add`                   | `operator.write` | yes (binding + warnings)                           |
| `POST remove`                | `operator.write` | yes (binding + impact)                             |
| Move (= remove + add)        | `operator.write` | yes (two audit rows linked by reorder id)          |
| `patchDeckConfig` (DM scope) | `operator.admin` | yes (old scope + new scope + base hash + new hash) |

The deck-go session token must carry the right scope. Below `operator.write`: hide Add/Remove/Move buttons (don't disable). Below `operator.admin`: hide Patch scope (don't disable). The queue + simulator + activity always render (read-only).

## Open Gateway questions (carried into api-discrepancy.md)

- Whether Gateway should expose a typed `deck.routing.reorder` action instead of the current remove + add flow (avoids partial-failure window)
- Whether backend validation should return a richer `severity: "blocker" | "warn" | "info"` instead of advisory-only
- Whether route simulation should include a `tiers[].reason: string` for human-readable explanation
- Whether binding IDs should become stable backend IDs rather than computed hashes from match content

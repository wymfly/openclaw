# API usage

DTO authority: `deck-go/contracts/source/deck-api.contract.ts:1546-1620`. The frontend speaks only to the Go BFF — never directly to the Gateway.

## DTOs

```ts
type DeckGoNodeSummary = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  pathEnv?: string;
  permissions?: Record<string, boolean>;
  connectedAtMs?: number;
  paired: boolean;
  connected: boolean;
};

type DeckGoPairingRequest = {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
};

type DeckGoNodesResponse = {
  nodes?: DeckGoNodeSummary[];
};

type DeckGoNodePairingResponse = {
  pending?: DeckGoPairingRequest[];
};

type DeckGoNodePairRequestInput = {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  remoteIp?: string;
  silent?: boolean;
};

type DeckGoNodePairRequestResponse = {
  status?: string; // "queued" | "approved" | "rejected" | "verified" | "invalid"
  request?: DeckGoPairingRequest;
  created?: boolean;
};

type DeckGoNodeInvokeResponse = {
  ok?: boolean;
  nodeId?: string;
  command?: string;
  payload?: unknown;
  payloadJSON?: string | null;
};

type DeckGoNodePendingWorkType = "status.request" | "location.request";
type DeckGoNodePendingWorkPriority = "normal" | "high";

type DeckGoNodePendingEnqueueResponse = {
  nodeId?: string;
  revision?: number;
  queued?: Record<string, unknown>;
  wakeTriggered?: boolean;
};
```

The frontend MUST consume these via `import type { ... } from "@/types/deck-api"` — do not redeclare.

## Endpoints

The nodes panel uses **two HTTP routes**, action-discriminated by JSON body:

### Inventory & node-scoped actions — `/api/nodes`

```
GET /api/nodes
→ 200 DeckGoNodesResponse
→ 401 if scope insufficient

POST /api/nodes
Content-Type: application/json
{ "action": "describe" | "rename" | "invoke" | "pending.enqueue", ... }
→ 200 (shape depends on action)
→ 400 invalid action / payload
→ 401 if scope insufficient
→ 5xx upstream Gateway error
```

Action-by-action shapes:

| action            | request body                                                  | response                                                            |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `describe`        | `{ action: "describe", nodeId }`                              | `DeckGoNodeSummary` (full record, not response wrapper)             |
| `rename`          | `{ action: "rename", nodeId, displayName }`                   | `DeckGoNodeInvokeResponse` (envelope echoes the dispatched payload) |
| `invoke`          | `{ action: "invoke", nodeId, command, params, timeoutMs }`    | `DeckGoNodeInvokeResponse` (envelope; payload may be unknown shape) |
| `pending.enqueue` | `{ action: "pending.enqueue", nodeId, type, priority, wake }` | `DeckGoNodePendingEnqueueResponse`                                  |

```ts
const list = await fetchNodes();
const detail = await describeNode("node-alpha");
await renameNode("node-alpha", "Alpha Mac");
const invoked = await invokeNodeCommand("node-alpha", "system.notify", { message: "ping" }, 15000);
const enqueued = await enqueueNodePendingWork({
  nodeId: "node-alpha",
  type: "status.request",
  priority: "high",
  wake: true,
});
```

### Pairing — `/api/nodes/pair`

```
GET /api/nodes/pair
→ 200 DeckGoNodePairingResponse
→ 401 if scope insufficient

POST /api/nodes/pair
Content-Type: application/json
{ "action": "request" | "approve" | "reject" | "verify", ... }
→ 200 DeckGoNodePairRequestResponse
→ 400 invalid action / payload
→ 401 if scope insufficient
→ 5xx upstream Gateway error
```

Action-by-action shapes:

| action    | request body                                           | response                                                       |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| `request` | `{ action: "request", ...DeckGoNodePairRequestInput }` | `{ status: "queued", request, created: true }`                 |
| `approve` | `{ action: "approve", requestId }`                     | `{ status: "approved", request, created: false }`              |
| `reject`  | `{ action: "reject", requestId }`                      | `{ status: "rejected", request, created: false }`              |
| `verify`  | `{ action: "verify", nodeId, token }`                  | `{ status: "verified" \| "invalid", request, created: false }` |

```ts
const pairing = await fetchNodePairing();
const reqResult = await requestNodePairing({
  nodeId: "node-stub",
  displayName: "New device",
  platform: "darwin",
});
await approveNodePairing("pair-beta-repair");
await rejectNodePairing("pair-orphan-omega");
const verified = await verifyNodePairing("node-alpha", "ABC1234567");
```

## Dynamic envelope rule

`node.invoke` and `node.pending.enqueue` are **dynamic envelopes** because the Gateway has no typed schema for advertised commands or pending-work payloads. The UI:

- never invents a per-command form schema
- presents a freeform JSON textarea for `invoke.params` (validated as `JSON.parse` only)
- renders `DeckGoNodeInvokeResponse.payload` and `DeckGoNodePendingEnqueueResponse.queued` verbatim via `<JsonView>`
- labels the action card "dynamic envelope" so operators understand the contract intent

If `node.commands.describe` ever ships in the contract, the prototype's freeform textarea should be swapped for a generated form (see api-explorer panel for the pattern).

## Caching strategy (production)

| Resource                                     | Cache                                            | Invalidation                                                                       |
| -------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `GET /api/nodes`                             | 5–10s TTL; refetch on tab focus + manual Refresh | After any `rename` / `pair.approve` / `pair.reject` / `pair.verify` (success path) |
| `GET /api/nodes/pair`                        | 5–10s TTL; refetch on tab focus + manual Refresh | After any `pair.request` / `pair.approve` / `pair.reject`                          |
| `POST describe`                              | 60s per nodeId in a Map; refresh on selection    | Manual reload only                                                                 |
| `POST rename` / `invoke` / `pending.enqueue` | Not cached (each call is a state mutation)       | —                                                                                  |
| `POST pair.*`                                | Not cached                                       | —                                                                                  |

## Drift gate

Run `cd deck-go && make contract-gate` after any DTO source edit. CI blocks merges that desync `deckapi.generated.go` and `deck-api.generated.ts` from `deck-api.contract.ts`.

## BFF projection

The BFF translates between contract DTOs and underlying Gateway typed methods + dynamic exceptions:

- `GET /api/nodes` → `node.list` (typed)
- `POST /api/nodes` action=`describe` → `node.describe` (typed)
- `POST /api/nodes` action=`rename` → `node.rename` (typed)
- `POST /api/nodes` action=`invoke` → **`node.invoke`** (dynamic exception — no upstream schema)
- `POST /api/nodes` action=`pending.enqueue` → **`node.pending.enqueue`** (dynamic exception — no upstream schema)
- `GET /api/nodes/pair` → `node.pair.list` (typed)
- `POST /api/nodes/pair` action=`request` → `node.pair.request` (typed)
- `POST /api/nodes/pair` action=`approve` → `node.pair.approve` (typed)
- `POST /api/nodes/pair` action=`reject` → `node.pair.reject` (typed)
- `POST /api/nodes/pair` action=`verify` → `node.pair.verify` (typed)

Two of the ten Gateway methods are active **dynamic envelopes** (`node.invoke`, `node.pending.enqueue`); the rest are typed.

The wire DTO must stay byte-stable across BFF refactors. The frontend MUST NOT depend on Gateway internal shapes.

## Error & drift rules

- Empty `nodes` (undefined or `[]`) renders rail empty state; KPIs all show 0.
- Empty `pairing` (undefined or `[]`) hides the Pending pairing surface.
- Missing optional node fields (modelIdentifier, remoteIp, pathEnv, permissions) gracefully shrink the hero/cap blocks.
- Invalid invoke params JSON blocks submit before calling the wrapper.
- Pairing reject always uses `confirm.danger` (red); approve/request/verify use neutral confirm (yellow).
- 4xx → toast with the action name; revert UI to idle (`pendingAction = null`, `actionResult = null`).
- 5xx → toast with retry; preserve `actionResult` from a prior successful run; reset busy.
- Verify with token < 6 chars: client-side gate; do not send.
- Orphan pairing requests must be selectable + actionable without `node.describe` (no node to describe).

## Scope & audit

| Action                                     | Required scope   | Audit row                                                     |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------- |
| `GET /api/nodes`                           | `operator.read`  | none                                                          |
| `POST /api/nodes` action=`describe`        | `operator.read`  | none                                                          |
| `GET /api/nodes/pair`                      | `operator.read`  | none                                                          |
| `POST /api/nodes` action=`rename`          | `operator.write` | yes (nodeId + new displayName)                                |
| `POST /api/nodes` action=`invoke`          | `operator.write` | yes (nodeId + command + params hash + timeout)                |
| `POST /api/nodes` action=`pending.enqueue` | `operator.write` | yes (nodeId + type + priority + wake)                         |
| `POST /api/nodes/pair` action=`request`    | `operator.write` | yes (input)                                                   |
| `POST /api/nodes/pair` action=`approve`    | `operator.admin` | yes (requestId + approving operator id)                       |
| `POST /api/nodes/pair` action=`reject`     | `operator.admin` | yes (requestId + rejecting operator id + reason if available) |
| `POST /api/nodes/pair` action=`verify`     | `operator.write` | yes (nodeId + token hash + verdict)                           |

The deck-go session token must carry the right scope. Below `operator.write`: hide invoke / pending / rename / pair.request buttons (don't disable). Below `operator.admin`: hide Approve / Reject pairing buttons (don't disable). The rail always renders inventory + pending list (read-only).

## Open Gateway questions (carried forward)

- Whether future contracts will type advertised command schemas (so the UI can swap `<JsonView>` form for `<FormGenerator>`)
- Whether `node.pending.enqueue` will graduate to a typed Deck-facing pending-work DTO (currently `Record<string, unknown>` for `queued`)
- Whether production pairing should surface richer trust evidence (CA chain, attestation receipts) — not yet in contract
- Whether `silent` flag in `DeckGoNodePairRequestInput` should be exposed (currently the prototype always omits)

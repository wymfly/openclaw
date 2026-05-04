# API usage

The API Explorer is the **meta-panel** — every method it lists is itself a backend endpoint. Source of truth for the catalog: `deck.gateway.describe` (RPC over the BFF). Source of truth for individual method shapes: each method's own contract entry in `deck-go/contracts/source/deck-api.contract.ts`.

## Endpoint table

| Verb   | Path                    | Request                              | Response                                                                       |
| ------ | ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| `POST` | `/api/gateway/invoke`   | `{ method: string, params: object }` | `{ ok, body, statusCode, headers, error? }`                                    |
| `GET`  | `/api/gateway/describe` | —                                    | `DeckGoGatewayDescribeResponse` (cached projection of `deck.gateway.describe`) |

Most browser interactions go through the single `invoke` envelope. The `describe` endpoint is a convenience GET wrapper around `invoke({ method: "deck.gateway.describe", params: {} })` — both produce the same payload.

## Frontend wrapper signatures

```typescript
// frontend-new/src/api/gateway.ts
export async function describeGateway(): Promise<DeckGoGatewayDescribeResponse>;
export async function invokeGateway<T = unknown>(
  method: string,
  params: Record<string, unknown>,
): Promise<{
  statusCode: number;
  body: T;
  headers: Record<string, string>;
  success: boolean;
  error?: string;
}>;
```

The Explorer panel's Run button maps directly to `invokeGateway(method, draft)`.

## Catalog response shape

```jsonc
{
  "namespaces": [
    {
      "namespace": "deck.agents",
      "description": "Agent registry and runtime control",
      "methods": [
        {
          "name": "deck.agents.detail",
          "kind": "query",
          "scope": "operator.read",
          "description": "Fetch agent identity, runtime stats, and recent sessions.",
          "params": {
            "type": "object",
            "properties": {
              "agentId": { "type": "string", "description": "Stable agent id" },
              "include": { "type": "array", "items": { "type": "string" } },
            },
            "required": ["agentId"],
          },
          "result": "DeckGoAgentDetailResponse",
          "sample": { "agentId": "agent-fix-bug", "include": ["sessions", "policy"] },
        },
      ],
    },
  ],
  "runtimeVersion": "0.5.0",
  "describedAt": "2026-05-04T08:14:32.103Z",
}
```

## Invocation envelope

### Request

```jsonc
{
  "method": "deck.agents.detail",
  "params": { "agentId": "agent-fix-bug", "include": ["sessions"] },
}
```

### Response (success path)

```jsonc
{
  "ok": true,
  "statusCode": 200,
  "body": {
    "agent": {
      /* DeckGoAgent */
    },
  },
  "headers": {
    "content-type": "application/json",
    "x-deck-trace": "trace-7c2f9b...",
    "x-deck-duration-ms": "142",
  },
}
```

### Response (error path)

```jsonc
{
  "ok": false,
  "statusCode": 403,
  "body": null,
  "error": "scope denied: requires operator.admin",
  "headers": {
    "content-type": "application/json",
    "x-deck-trace": "trace-3f8a2d...",
  },
}
```

## Method kinds

| `kind`     | Semantics                                                   | UI badge tone   |
| ---------- | ----------------------------------------------------------- | --------------- |
| `query`    | Idempotent read — safe to retry, no audit trail             | info (blue)     |
| `mutation` | Side-effecting — write audit row, may require admin scope   | warn (yellow)   |
| `stream`   | Long-lived response (SSE / WS) — single Run yields N events | accent (purple) |

The Explorer renders all three but the response pane treats `stream` differently in production: it appends events to a scrollable list rather than replacing a single body. **Stream rendering is out of scope this iteration.**

## Required scopes

Every method declares one of:

- `operator.read` — read-only, no audit row written
- `operator.write` — side-effecting, audit row written, may be approval-gated
- `operator.admin` — sensitive (kill, delete, scope changes), always audit-logged + approval-required for some

If the BFF returns 403 with body `{ error: "scope denied: requires <scope>" }`, the response pane paints err and surfaces the scope mismatch. The Explorer **does not** attempt to elevate scope — that lives in the operator's session credential, not in the panel.

## Headers

The Explorer's Headers tab in the request builder is read-only because the BFF transport injects auth/trace/scope headers automatically. Browser code cannot override them.

Standard headers (always present):

| Header                           | Source                       | Notes                                              |
| -------------------------------- | ---------------------------- | -------------------------------------------------- |
| `Authorization: Bearer <token>`  | session cookie → BFF derives | Never visible to JS code                           |
| `X-Deck-Scope`                   | session credential           | Effective scope for this operator                  |
| `X-Deck-Trace`                   | request middleware generates | New per-request UUID, used for distributed tracing |
| `Content-Type: application/json` | BFF default                  | All bodies are JSON                                |

Custom headers (per-method):

| Method                     | Header                       | Purpose                                               |
| -------------------------- | ---------------------------- | ----------------------------------------------------- |
| `deck.gateway.batch`       | `X-Deck-Batch-Stop-On-Error` | Mirrors `options.stopOnError` for upstream visibility |
| `deck.sessions.transcript` | `X-Deck-Cursor`              | Pagination cursor (when set)                          |

## Catalog cache + invalidation

- `gateway.describe` result cached in browser for 5 minutes per environment (stale-while-revalidate)
- On environment switch → invalidate (different env's catalog may differ)
- On runtime version mismatch (the describe response includes `runtimeVersion`) → toast: "Gateway runtime updated; refresh catalog?" with refetch button
- Schema-driven form re-renders on catalog change because each method's params schema may have evolved

## History persistence

Production:

- Per-environment `localStorage` key (`deck:apiExplorerHistory:<env>`)
- Cap at 100 entries per env (50 in the prototype)
- Expire entries older than 30 days on mount
- Includes the full draft snapshot (not just paramsPreview) so re-loading a history entry restores the exact request

Prototype: in-memory only; cleared on reload.

## BFF projections (frontend-only state)

| Projection                 | Source                          | Where computed                                                  |
| -------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Response duration in trace | `headers["x-deck-duration-ms"]` | Browser parses; SYNTHETIC_SPANS used in prototype               |
| Trace span breakdown       | OpenTelemetry tail (proposed)   | **TODO** — backend needs OT export to surface per-stage timings |
| Method "popularity" sort   | history aggregation             | **Future** — group history by method, sort tree by frequency    |

## Auth + scope

All endpoints require Deck operator scope. Reading the catalog (`describe`) requires `operator.read`. Invoking each method requires that method's declared scope. Browser code never elevates scope; if the operator lacks scope for a method, that method is greyed out in the tree (production behavior; prototype always allows selection).

## Error handling

| Backend error           | Frontend surface                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------- |
| `400 validation_failed` | Response pane err tone, body shows server-supplied validation messages                          |
| `403 scope_denied`      | Response pane err tone, body shows scope diff                                                   |
| `404 method_not_found`  | Toast: `That method is no longer in the registry — refreshing catalog`; auto-`describe` refresh |
| `429 rate_limit`        | Response pane err tone with retry-after hint                                                    |
| `5xx server_error`      | Response pane err tone with full error body for debugging                                       |
| Network failure         | Status row shows `—` + `Failed`; body shows transport error message                             |

## Contract drift gates

The catalog itself is regenerated by `cd deck-go && make protocol-update` and verified by `make protocol-check`. Any change to a method's `params` schema MUST run those gates plus the per-DTO contract gate (`make contract-gate`) for any types referenced in `result`.

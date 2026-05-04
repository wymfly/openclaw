# States

State machines for the api-explorer panel. Where transition timing is given, it represents the **prototype's simulated behavior** — production timing is bounded by Gateway round-trips.

## Top-level state

```
┌──────────────────────────────────┐
│  initial-load                    │
│  selectedMethodName from URL     │
│  catalog from data.js (in-mem)   │
└────────┬─────────────────────────┘
         │ resolve method from name
         │ seed draft from method.sample
         │ rawBody = JSON.stringify(sample, null, 2)
         ▼
┌──────────────────────────────────┐
│  ready                           │
│  builder rendered                │
│  response = null                 │
│  bodyMode = "form"               │
└──────────────────────────────────┘
```

## Run lifecycle

```
ready ──onRun (running=false, bodyError=null)──▶ running
running ──~480-760ms sim──▶ ready (response set, lastDurationMs set, history prepended)
running (Run clicked again) ──no-op (button disabled)──▶ running
```

In production, run uses `AbortController` so a second click cancels the first.

## Method selection

```
selectedMethodName ──onSelect(name)──▶ name in URL hash
                                        + draft seeded from new method.sample
                                        + rawBody re-stringified
                                        + bodyMode reset to "form"
                                        + bodyError cleared
                                        + response cleared
                                        + lastDurationMs cleared
```

When the same method is re-selected (history click loads its method back), state is **not** reset (params keep current values). This preserves work-in-progress when toggling around.

## Body mode toggle

```
form ──onBodyMode("raw")──▶ raw  (rawBody mirrors current draft)
raw  ──onBodyMode("form")──▶ form (draft is whatever was last successfully parsed from raw)
```

Editing in raw mode:

- Each keystroke parses the JSON
- On parse success: `bodyError = null`, `draft = parsed`
- On parse failure: `bodyError = e.message`, draft is preserved (last good)
- The Body tab shows a red dot in its tab label when `bodyError` is set
- Run is disabled while `bodyError` is set

## Tab state

Both `RequestBuilder` and `ResponsePane` have local `tab` state. Switching tabs is local and doesn't trigger any side effects.

## Response shapes

```typescript
type ResponseShape = {
  statusCode: number; // 200/202/3xx/4xx/5xx; null on network failure
  body: any; // JSON-decoded
  headers: Record<string, string>;
  success: boolean; // statusCode < 400 in mock; production: also network failures
  error?: string; // present when !success or transport-level failure
};
```

## Response classification

| Condition                         | Status pane class                                                          |
| --------------------------------- | -------------------------------------------------------------------------- |
| `statusCode` 2xx + no error       | `--ok` (green tint)                                                        |
| `statusCode` 3xx                  | `--info` (blue tint) — same as 2xx visually but body label says "Redirect" |
| `statusCode` 4xx                  | `--warn` (yellow tint) — body shows server validation message              |
| `statusCode` 5xx                  | `--err` (red tint) — body shows server error                               |
| Transport failure (no statusCode) | `--err` with error string from fetch                                       |
| Scope rejection (403 with error)  | `--err` shows scope diff                                                   |

## Empty / sparse states

| Condition                                                             | Surface                                                                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `selectedMethodName` matches no method (stale URL hash)               | Center pane: "Pick a method on the left to start building a request." with IconCode                           |
| `catalog.length === 0` (would only happen if describe returned empty) | Tree pane: "No methods match." Tree counts say `0 / 0`. Builder pane keeps last-known method.                 |
| `query` matches nothing                                               | Tree pane: "No methods match."                                                                                |
| `response === null && !running`                                       | Response pane: status row shows "No response yet"; body shows "Click Run to send the request to the gateway." |
| `running === true`                                                    | Response pane: spinner + "Running…"; body shows "Awaiting Gateway response. Click Run again to cancel."       |
| `history.length === 0`                                                | History rail: "No history yet."                                                                               |

## Loading vs. ready

The prototype starts in `ready` (catalog is in-memory). In production:

- Initial mount calls `gateway.describe`; until it returns, the tree shows skeleton namespaces (3-5)
- The center builder pane shows skeleton hero + skeleton tabs while resolving the URL hash method
- History loads from `localStorage` synchronously (no skeleton needed)

## URL hash sync

```
mount: if window.location.hash matches "#/<method-name>"
       → selectedMethodName = method-name
       else selectedMethodName = "deck.agents.detail" (default)

onSelect: window.history.replaceState(null, "", `#/${name}`)
```

Hash sync is one-way (URL ← state); `popstate` is not handled in this iteration. Browser back button would not navigate between previously selected methods.

## Environment switch

```
local ─→ stage ─→ prod (or any combination)

Side effects on switch:
- response cleared (to avoid showing stale prod data after switching to local)
- history filtered? No — history shows all envs, env tagged on each row
- catalog re-described? Yes in production (different env may have different method registry)
```

In the prototype, the catalog is shared across environments. In production, switching env triggers a fresh `gateway.describe` against the new endpoint.

## History entry shape

```typescript
type HistoryEntry = {
  id: string;
  method: string;
  paramsPreview: Record<string, any>; // first 3 keys only
  statusCode: number;
  durationMs: number;
  success: boolean;
  error?: string;
  at: string; // ISO
  env: "local" | "stage" | "prod";
};
```

Cap is 50 entries; older entries are dropped on each new run.

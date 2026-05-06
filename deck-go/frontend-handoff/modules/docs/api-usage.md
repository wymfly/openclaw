# API usage

DTO authority: `deck-go/contracts/source/deck-api.contract.ts:1459-1481`. The frontend speaks only to the Go BFF — never directly to the docs store or the agent runtime.

## DTO

```ts
type DeckGoDocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

type DeckGoDoc = {
  id: string; // stable identifier (used in URL hash + DELETE path)
  title: string;
  category: DeckGoDocCategory;
  content: string; // GitHub-flavored markdown
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string; // ISO 639-1 (e.g., "en", "zh")
  extractedAt: string; // ISO timestamp — when the BFF first harvested it
  updatedAt: string; // ISO timestamp — last edit
};

type DeckGoDocsResponse = {
  docs?: DeckGoDoc[];
};

type DeckGoDocsExtractResponse = {
  extracted?: number;
  docs?: DeckGoDoc[];
};
```

`DeckGoDocsResponse.docs` is optional. The frontend MUST treat `undefined` and `[]` the same way — render the empty state.

## Endpoints

### List

```
GET /api/docs?category={category}&q={query}
→ 200 DeckGoDocsResponse
→ 401 if scope insufficient
```

The Go BFF supports optional `category` (matches `DeckGoDocCategory`) and `q` (free-text query) filter params. The panel may filter locally for immediate visual feedback (the prototype does), but it MUST NOT invent fields or shapes beyond `DeckGoDoc`.

```ts
const response = await fetchDocs({ category: "summary", query: "webhook" });
const docs = response.docs ?? [];
```

### Detail

```
GET /api/docs/{id}
→ 200 DeckGoDoc
→ 404 if doc no longer exists
→ 401 if scope insufficient
```

Use this for the active doc when the list endpoint stripped `content` for payload economy. The prototype's data fixture inlines `content` in the list response; production may switch to list-without-content + detail-on-demand once doc count grows.

```ts
const doc = await fetchDoc(docId);
```

### Extract

```
POST /api/docs/extract
Content-Type: application/json

{ "sessionKey": "<session-id>" }

→ 200 DeckGoDocsExtractResponse
→ 400 if sessionKey is empty / unknown
→ 401 if scope insufficient
```

The backend requires a non-empty `sessionKey`, calls managed runtime chat history, extracts long assistant messages, classifies them into a `DeckGoDocCategory`, and appends the generated docs to the local store. The response gives back both the count (`extracted`) and the new docs (`docs`).

```ts
const result = await extractDocs(activeSessionId);
const newDocs = result.docs ?? [];
const count = result.extracted ?? 0;
```

The UI MUST disable the Extract button when there is no active session. The prototype's popover uses an in-memory `ACTIVE_SESSION` stub; production reads from the session store.

### Delete

```
DELETE /api/docs/{id}
→ 200 `{ ok: true }` on current BFF success
→ 204 is tolerated by the frontend wrapper if a future BFF switches to empty success
→ 404 if already gone; the production `deleteDoc` wrapper treats this as success with `{ missing: true }` so the UI can refresh and continue
→ 401 if scope insufficient
```

Delete is a local store mutation. The UI MUST require confirmation (two-click or modal) and refresh the inventory after success.

```ts
await deleteDoc(docId);
```

## Caching strategy (future production)

The current implementation caches only in React state for the panel lifetime. A future production cache can persist the list/detail response with the following invalidation rules:

- `extractedAt` / `updatedAt` change in a subsequent list refresh
- The user explicitly reloads
- The local store is invalidated by a delete or extract

If persisted later, use a bounded TTL and invalidate on:

- Successful `POST /api/docs/extract` (new docs invalidate list)
- Successful `DELETE /api/docs/{id}` (drop the entry, refresh list)

## Streaming / WebSocket

Not applicable. Docs are static once extracted. The extract action is a fire-and-respond HTTP POST — no streaming progress required at this scale (typical sessions yield 1-3 docs in <1s).

## Drift gate

Run `cd deck-go && make contract-gate` after any DTO source edit. CI blocks merges that desync `deckapi.generated.go` and `deck-api.generated.ts` from `deck-api.contract.ts`. The current frontend consumes generated Deck types through the `frontend-new/src/api.ts` facade/re-export path — do not redeclare the shape locally.

## BFF projection

The BFF transparently forwards requests to its docs store handler — there is no projection logic between the contract DTO and the frontend. If a future version moves docs into a remote service (e.g., a vector store), the BFF MAY adapt the shape but the **wire DTO must stay byte-stable**.

## Error & drift rules

- Empty `docs` (`undefined` or `[]`) renders an empty registry state with a "Try Extract from session" hint.
- Missing detail (`GET /api/docs/{id}` 404) returns a standard fetch error and MUST show an error block in the viewer with a Retry action.
- Missing `sourceSession` or `sourceAgent` renders as `no session` / `no agent` (muted text) — do not invent a placeholder agent.
- Extraction with no active session is blocked **before** network submit (button disabled in popover).
- Visual smoke / E2E tests MAY seed via `POST /api/docs/extract` against a deterministic mock chat history; do **not** add a test-only seed endpoint.
- The browser code MUST go through the BFF — no direct Gateway calls, no direct file-system reads.

## Scope & audit

| Action                   | Current implementation                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `GET /api/docs`          | Requires the deck-go access token; no per-action scope gate is exposed in the UI contract yet             |
| `GET /api/docs/{id}`     | Requires the deck-go access token; returns 404 when absent                                                |
| `POST /api/docs/extract` | Requires a non-empty `sessionKey`; calls managed runtime `chat.history`; no durable audit feed is exposed |
| `DELETE /api/docs/{id}`  | Hard-deletes from the local store; UI requires confirmation; no durable audit feed is exposed             |

Future operator scopes can hide Extract/Delete based on `operator.write` / `operator.admin`, but that scope signal is not part of the current docs panel contract chain.

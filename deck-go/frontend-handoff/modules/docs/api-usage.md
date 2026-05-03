# Docs API Usage

## List

```ts
const response = await fetchDocs({ category: "summary", query: "contract" });
```

Expected shape:

```ts
type DeckGoDocsResponse = {
  docs?: DeckGoDoc[];
};
```

`GET /api/docs` supports optional `category` and `q` query params in the Go BFF. The panel may filter locally for immediate visual feedback, but it must not invent fields beyond `DeckGoDoc`.

## Detail

```ts
const doc = await fetchDoc(docId);
```

Expected shape:

```ts
type DeckGoDoc = {
  id: string;
  title: string;
  category: "summary" | "plan" | "spec" | "manual" | "draft";
  content: string;
  sourceSession: string | null;
  sourceAgent: string | null;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
};
```

## Extract

```ts
const result = await extractDocs(activeSessionKey);
```

Expected shape:

```ts
type DeckGoDocsExtractResponse = {
  extracted?: number;
  docs?: DeckGoDoc[];
};
```

The backend requires a non-empty `sessionKey`, calls managed runtime chat history, extracts long assistant messages, and appends generated docs to the local store.

## Delete

```ts
await deleteDoc(docId);
```

Delete is a local store mutation. The UI must require confirmation and refresh inventory after success.

## Error And Drift Rules

- Empty `docs` renders an empty local registry state.
- Missing detail returns a standard fetch error and must show an error state.
- Missing `sourceSession` or `sourceAgent` renders as unavailable evidence.
- Extraction with no active session is blocked before network submit.
- Mock visual extraction should seed through `POST /api/docs/extract` and deterministic mock `chat.history`, not a test-only seed endpoint.
- Do not add direct Gateway calls from browser code.

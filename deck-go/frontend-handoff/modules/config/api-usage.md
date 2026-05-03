# Config API Usage

## Snapshot

```ts
const snapshot = await fetchDeckConfig();
```

Expected shape:

```ts
type DeckGoConfigSnapshotResponse = {
  path?: string;
  exists?: boolean;
  valid?: boolean;
  raw?: string | null;
  config?: unknown;
  hash?: string;
  baseHash?: string;
};
```

## Apply

```ts
await applyDeckConfig(raw, baseHash);
```

Request body:

```json
{
  "raw": "{ ... }",
  "baseHash": "config-hash-1"
}
```

## Schema Lookup

```ts
await lookupConfigPath("agents.defaults");
```

Expected shape:

```ts
type DeckGoConfigLookupResponse = {
  path: string;
  schema?: Record<string, unknown>;
  hint?: Record<string, unknown>;
  children: Array<{
    key: string;
    path: string;
    type?: string | string[];
    required: boolean;
    hasChildren: boolean;
    hint?: Record<string, unknown>;
    hintPath?: string;
  }>;
};
```

## Error And Drift Rules

- Raw config draft must be a JSON object before apply.
- Base-hash conflicts trigger latest-config fetch and remote-vs-local diff preview.
- Structured edits remain local until apply.
- Sensitive masking is UI-only.
- Do not add direct Gateway calls from browser code.

# config — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The config module reads bindings from the deck-go BFF, which forwards to
upstream OpenClaw `gateway.config.snapshot` / `gateway.config.apply` /
`gateway.config.lookup`. Browser code never calls Gateway directly.

## Deck-facing API

### `GET /api/config`

Wrapper:

```ts
fetchSnapshot(): Promise<DeckGoConfigSnapshotResponse>
```

Response:

```ts
type DeckGoConfigSnapshotResponse = {
  path?: string; // ".openclaw/openclaw.json" or absolute path resolved by BFF
  exists?: boolean; // false → file missing, prompt to create
  valid?: boolean; // false → file fails schema validation; raw editor only
  raw?: string | null; // pretty-printed JSON text (canonical formatter applied by BFF)
  config?: unknown; // parsed object (only valid when `valid: true`)
  hash?: string; // sha-256 (or any opaque opaque server hash) of `raw`
  baseHash?: string; // same value at fetch — used for optimistic concurrency on apply
};
```

Empty / error rules:

- `exists: false` → prototype seeds `exists: true`. Production should render
  an EmptyState with a CTA ("Create config from defaults") that POSTs an
  initial scaffold.
- `valid: false` → form pane is hidden; raw pane forces `mode: "raw"`.
- 5xx → full-width retry overlay.

### `POST /api/config/apply`

Wrapper:

```ts
applyConfig({ baseHash, raw }: { baseHash: string; raw: string })
  : Promise<DeckGoConfigApplyResponse>
```

Body:

```ts
{
  baseHash: string; // hash from the snapshot the user fetched
  raw: string; // the new JSON text to write
}
```

Response:

```ts
type DeckGoConfigApplyResponse = {
  ok?: boolean;
  baseHash?: string; // new baseHash to use for the next apply
  hash?: string; // hash of the just-written file (matches baseHash)
};
```

Errors:

- `409 Conflict` — `baseHash` mismatch (someone else applied changes). UI
  enters apply-dialog `phase--error` and prompts Refresh & retry.
- `422 Unprocessable Entity` — schema validation failure. Server returns
  `{ ok: false, errors: [{ path, message }, …] }` (BFF projection); UI
  echoes errors inline on the offending fields.
- `5xx` — generic error overlay; user can retry.

### `POST /api/config/schema-lookup`

Wrapper:

```ts
lookupSchema(path: string): Promise<DeckGoConfigLookupResponse>
```

Body:

```ts
{
  path: string; // dotted path (e.g. "agents.defaults"), or "" for root
}
```

Response:

```ts
type DeckGoConfigLookupChild = {
  key: string;
  path: string;
  type?: string | string[];
  required: boolean;
  hasChildren: boolean;
  hint?: Record<string, unknown>; // { description, enum, minimum, maximum, format, secret, … }
  hintPath?: string;
};

type DeckGoConfigLookupResponse = {
  path: string;
  schema?: Record<string, unknown>;
  hint?: Record<string, unknown>;
  children: DeckGoConfigLookupChild[];
};
```

Caching:

- Cache by `path`; cache lifetime = until next successful apply.
- On successful apply, **invalidate all cached lookups** — schema may have
  changed if the apply added/removed a section.
- Cache misses don't block the form — render `subsection__empty` with a
  Refresh CTA, fire the lookup in the background, populate when it returns.

## DTO shapes (canonical)

```ts
type DeckGoConfigSnapshotResponse = {
  /* see above */
};
type DeckGoConfigApplyResponse = {
  /* see above */
};
type DeckGoConfigLookupChild = {
  /* see above */
};
type DeckGoConfigLookupResponse = {
  /* see above */
};
```

## BFF projections (not part of the contract)

### `recentApplies: ApplyEvent[]`

```ts
interface ApplyEvent {
  ts: number; // unix ms
  actor: string; // "operator:user@example.com" | "system" | "automation:..."
  paths: string[]; // dotted-path list of changed leaves
  previousHash: string;
  newHash: string;
  ok: boolean;
  error?: string; // populated when `ok: false`
}
```

BFF projection over the BFF mutation log. The contract has **no apply audit
endpoint**. Used by the **History** tab in the right pane.

### Section catalog

The 6 top-level sections (`agents` / `models` / `channels` / `plugins` /
`hooks` / `runtime`) are a **UI catalog**, not a contract list. Production
should sniff the snapshot's top-level keys to drive the section nav, with
human labels + descriptions held in i18n locale files.

### Field-type tones (FieldTypeBadge)

Mapping `type` ∈ `{string, integer, number, boolean, array, object}` to
visual tone is purely UI:

- `accent` → string
- `violet` → integer / number
- `success` → boolean
- `amber` → array
- `magenta` → object
- `iron` → unknown / "any"

Not a contract field. Engineering may diverge if the design system grows
new tones.

## Endpoint summary

| Endpoint                    | Method | When                                      | DTO                            |
| --------------------------- | ------ | ----------------------------------------- | ------------------------------ |
| `/api/config`               | GET    | Initial load + Refresh button             | `DeckGoConfigSnapshotResponse` |
| `/api/config/apply`         | POST   | ApplyConfirmDialog confirm                | `DeckGoConfigApplyResponse`    |
| `/api/config/schema-lookup` | POST   | Subsection expand (lazy) + section change | `DeckGoConfigLookupResponse`   |

## Backend chain

```
ConfigApp
  → frontend-new/src/api/config.ts
  → deck-go Go BFF routes
    ├── Gateway RPC config.snapshot
    ├── Gateway RPC config.apply (with baseHash gate)
    ├── Gateway RPC config.lookup (per path)
    └── BFF projection: recentApplies (mutation log)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 6 top-level sections × ~30 leaf fields covering all 6 field types.
- ≥ 1 secret field (`hint.secret: true`) with `$ENV_VAR` placeholder default.
- ≥ 1 enum field per section to exercise `<select>` rendering.
- ≥ 1 array field with newline-delimited textarea.
- ≥ 1 required field per section to exercise the required-empty validation.
- 4 recentApplies (3 ok, 1 error) covering operator + system actors.
- baseHash + hash matching string format `"config-hash-vX-NNN"`.

## Open contract assumptions

- **Apply audit log** is BFF-projected. Contract may want
  `GET /api/config/apply-history?limit=N` to make this first-class.
- **Schema-lookup batch endpoint** — for the section nav to render dirty
  counts without N round-trips, a batch lookup would help. Currently the
  prototype precomputes the full tree client-side; production must either
  walk it or batch.
- **`hint.secret`** is a synthetic UI hint. The contract may want
  `format: "env-ref"` or `secret: true` as a first-class hint key so
  multiple panels (config / channels / models) render the same secret
  treatment without duplicating logic.
- **`exists: false` + create** — there is no contract for "scaffold default
  config". Production may need `POST /api/config/scaffold` or rely on the
  Gateway to lazily create on first apply.
- **Field-type tones** — the 6-tone mapping is a UI choice; if the contract
  ever returns custom enum types, the prototype falls back to `iron`.

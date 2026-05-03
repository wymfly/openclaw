# models — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Deck-facing API

### `GET /models/config`

Wrapper: `fetchModelsConfig()`. Response: `DeckGoModelsConfigResponse`
(`raw`, `hash`).

- `raw` = raw JSON string of the models slice of `openclaw.json`.
- The panel parses it and exposes structured editors over the draft;
  save serializes back to `raw`.
- `hash` is the base hash for `PATCH /models/config`.

### `PATCH /models/config`

Wrapper: `patchModelsConfig(rawDraft, baseHash)`. Response:
`DeckGoConfigApplyResponse`.

- Send full updated `raw` + `baseHash`. On 409 reload + re-prompt.
- Used for: set-default, add-model, edit-fallback-chain, edit
  provider-allowlist, configure-auth.

### `POST /config/schema-lookup`

Wrapper: `lookupConfigSchema(path)` → JSON schema fragment. Optional
in prototype.

### `GET /models/usage/cost`

Wrapper: `fetchUsageCost(window?)`. Response:
`DeckGoUsageCostResponse` (`runtimeId`, `currency`, `totals`,
`perProvider`, `perModel`).

### `GET /models/usage/providers`

Wrapper: `fetchUsageProviders()`. Response:
`DeckGoUsageProvidersResponse` (array of
`DeckGoUsageProviderStatus`).

## Gateway RPC (via runtime)

### `models.configured`

Response includes `payload.models` or `payload.items` (array of
`DeckGoRuntimeConfiguredModel`). Runtime emits on every models config
change.

### `deck.auth.overview`

Response: `DeckGoModelAuthOverviewResponse` (`payload.providers` or
`providers` — both shapes accepted). Refresh after PATCH success.

### `models.catalog.providers`

Response: `DeckGoModelCatalogProvidersResponse`. Drives
`CatalogDialog`.

### `deck.auth.probe`

Response: `DeckGoModelProbeResponse`. `status` ∈ `ok | cooldown |
error | unknown`. `reasonCode` (e.g. `rate-limit`) drives banner copy.

## BFF projections

### `pricing: Record<modelId, ModelPricing>`

```ts
interface ModelPricing {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  source: string;
}
```

BFF maintains snapshot of vendor pricing. Vendor invoice is
authoritative.

### `audit: AuditEntry[]`

```ts
interface AuditEntry {
  ts: number;
  model: string;
  actor: string;
  action: "set-default" | "added" | "removed" | "rotate-key" | "added-fallback" | string;
  before?: string;
  after?: string;
  chain?: string[];
  note?: string;
}
```

BFF projection over `PATCH /models/config` history.

## Endpoint summary

| Endpoint                         | Method | When                                               | DTO                                     |
| -------------------------------- | ------ | -------------------------------------------------- | --------------------------------------- |
| `/models/config`                 | GET    | Initial load + after PATCH                         | `DeckGoModelsConfigResponse`            |
| `/models/config`                 | PATCH  | Set default / add / configure auth / fallback edit | `DeckGoConfigApplyResponse`             |
| `/config/schema-lookup`          | POST   | Form schema hints (optional)                       | JSON schema fragment                    |
| `/models/usage/cost`             | GET    | KPI strip + Pricing tab + Usage tab                | `DeckGoUsageCostResponse`               |
| `/models/usage/providers`        | GET    | Usage tab provider-health tiles                    | `DeckGoUsageProvidersResponse`          |
| `models.configured` (RPC)        | RPC    | List rows                                          | `DeckGoRuntimeConfiguredModelsResponse` |
| `deck.auth.overview` (RPC)       | RPC    | Provider auth row, OAuth, cooldown, usage windows  | `DeckGoModelAuthOverviewResponse`       |
| `models.catalog.providers` (RPC) | RPC    | CatalogDialog                                      | `DeckGoModelCatalogProvidersResponse`   |
| `deck.auth.probe` (RPC)          | RPC    | Per-row probe pill + ProbeResultDialog             | `DeckGoModelProbeResponse`              |

## Backend chain

```
ModelsPanel / model helper components
  → frontend-new/src/api/models.ts
  → deck-go Go BFF routes
  → runtime openclaw managed adapter
  → Gateway (only behind the BFF / runtime boundary)
```

## Mock requirements

- 9+ models across 4 providers.
- 5 auth providers (4 ready + 1 missing/error).
- 5 catalog providers including one with `models: []`.
- Probe coverage: ok / cooldown / unknown / error.
- Usage cost: per-provider + per-model with 0-usage models.
- 5 usage providers covering ready / cooldown / missing.
- Pricing snapshot for 7 of 9 models (2 local should have 0 pricing).
- Audit entries spanning set-default / added / rotate-key /
  added-fallback.

## Open contract assumptions

- `DeckGoRuntimeConfiguredModel` shape (`id, provider, family,
displayName, contextWindow, maxTokens, reasoning?, isDefault?,
fallback?, local?, lastUsedMs?`). If runtime emits thinner DTO,
  project these fields BFF-side.
- Pricing snapshot shape is BFF-only; if vendor pricing is heavily
  multi-tier (cached vs uncached input), extend with optional fields
  and keep `inputPer1MTokens` as blended baseline.
- Audit projection is BFF-only and may not exist server-side yet.
- `deck.auth.probe` is assumed cached ~30s server-side. The dialog's
  "Run probe" force-refresh assumes a force flag exists.

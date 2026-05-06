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

Wrapper: `saveModelsConfig(rawDraft, baseHash)`. Response:
`DeckGoConfigApplyResponse`.

- Send full updated `raw` + `baseHash`. On 409 reload + re-prompt.
- Used for: set-default, add-model, edit-fallback-chain, edit
  provider-allowlist, configure-auth.

### `POST /config/schema-lookup`

Wrapper: `lookupConfigSchema(path)` → JSON schema fragment. Optional
in prototype.

### `GET /usage/cost`

Wrapper: `fetchModelUsageCost(days?)`. Response:
`DeckGoUsageCostResponse` (`runtimeId`, `currency`, `totals`,
`perProvider`, `perModel`).

`GET /models/usage/cost` remains available as a Models-compatible BFF
alias, but the current frontend wrapper uses canonical `/usage/cost`.

### `GET /usage/providers`

Wrapper: `fetchModelUsageProviders()`. Response:
`DeckGoUsageProvidersResponse` (array of
`DeckGoUsageProviderStatus`).

`GET /models/usage/providers` remains available as a Models-compatible
BFF alias, but the current frontend wrapper uses canonical
`/usage/providers`.

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

### `pricing: Record<modelId, ModelPricing>` (projected)

```ts
interface ModelPricing {
  inputPer1MTokens: number;
  outputPer1MTokens: number;
  source: string;
}
```

This is a handoff-level projection, not a currently guaranteed
Deck-facing DTO. Vendor invoice remains authoritative.

### `audit: AuditEntry[]` (projected)

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

This is a handoff-level projection over possible `PATCH /models/config`
history. It is not currently guaranteed by the Deck-facing DTOs.

## Endpoint summary

| Endpoint                               | Method | When                                                                                         | DTO                                     |
| -------------------------------------- | ------ | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| Endpoint / method                      | Method | When                                                                                         | DTO                                     |
| --------------------------------       | ------ | --------------------------------------------------                                           | --------------------------------------- |
| `/models/config`                       | GET    | Initial load + after PATCH                                                                   | `DeckGoModelsConfigResponse`            |
| `/models/config`                       | PATCH  | Set default / add / configure auth / fallback edit                                           | `DeckGoConfigApplyResponse`             |
| `/config/schema-lookup`                | POST   | Form schema hints (optional)                                                                 | `DeckGoConfigLookupResponse`            |
| `/usage/cost`                          | GET    | KPI strip + Pricing tab + Usage tab                                                          | `DeckGoUsageCostResponse`               |
| `/usage/providers`                     | GET    | Usage tab provider-health tiles                                                              | `DeckGoUsageProvidersResponse`          |
| `/models/usage/cost`                   | GET    | Compatibility alias                                                                          | `DeckGoUsageCostResponse`               |
| `/models/usage/providers`              | GET    | Compatibility alias                                                                          | `DeckGoUsageProvidersResponse`          |
| `models.configured` (typed RPC)        | POST   | List rows via `/v1/runtimes/{runtimeId}/gateway/rpc`                                         | `DeckGoRuntimeConfiguredModelsResponse` |
| `deck.auth.overview` (typed RPC)       | POST   | Provider auth row, OAuth, cooldown, usage windows via `/v1/runtimes/{runtimeId}/gateway/rpc` | `DeckGoModelAuthOverviewResponse`       |
| `models.catalog.providers` (typed RPC) | POST   | CatalogDialog via `/v1/runtimes/{runtimeId}/gateway/rpc`                                     | `DeckGoModelCatalogProvidersResponse`   |
| `deck.auth.probe` (typed RPC)          | POST   | Per-provider probe via `/v1/runtimes/{runtimeId}/gateway/rpc`                                | `DeckGoModelProbeResponse`              |

## Backend chain

```
ModelsPanel / model helper components
  → frontend-new/src/api.ts
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
- `deck.auth.probe` cache/force-refresh semantics are not guaranteed by
  the current wrapper, which passes only `{ provider }`.

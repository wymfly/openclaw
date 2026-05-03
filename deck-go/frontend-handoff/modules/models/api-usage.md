# Models API Usage

## Deck BFF Endpoints

### `GET /models/config`

Returns `DeckGoModelsConfigResponse`.

Used for the raw config draft and base hash.

### `PATCH /models/config`

Accepts `{ raw, baseHash }` and returns `DeckGoConfigApplyResponse`.

The UI must continue to submit the raw draft. Structured controls are projections
over that draft, not independent patch authority.

### `POST /config/schema-lookup`

Accepts `{ path }` and returns `DeckGoConfigLookupResponse`.

Used by the schema lookup strip.

### `GET /models/usage/cost`

Returns `DeckGoUsageCostResponse`.

Used for daily cost bars and latest/window totals. Mock evidence is not billing
truth.

### `GET /models/usage/providers`

Returns `DeckGoUsageProvidersResponse`.

Used for provider pressure/quota cards.

## Gateway RPC Through Deck Client

### `models.configured`

Called by `fetchRuntimeConfiguredModels`. Expected shape is
`DeckGoRuntimeConfiguredModelsResponse.payload.models` or `.payload.items`.

### `deck.auth.overview`

Called by `fetchRuntimeModelAuthOverview`. Expected shape includes provider
status, source/scope, auth presence, optional OAuth, optional cooldown, and
optional usage evidence.

### `models.catalog.providers`

Called by `fetchRuntimeModelCatalogProviders`. Expected shape includes catalog
providers and optional model entries.

### `deck.auth.probe`

Called by `probeRuntimeModelAuth`. The UI renders the result and then refreshes
auth overview.

## Known Drift To Check During Implementation

- The bundled mock Gateway currently lacks default handlers for Models RPC.
- Real Gateway result optionality should not be tightened from mock data alone.
- Usage provider pressure and auth provider `usage` windows may overlap but are
  not the same authority.

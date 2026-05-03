# Models States

## Ready

All configured data resolves:

- model config raw JSON + hash
- runtime configured models
- model auth overview
- catalog providers
- usage cost
- provider pressure
- schema lookup

The first viewport shows readiness, providers, configured models, auth providers,
catalog providers, latest cost, runtime provider rail, auth rail, and tab
navigation.

## Loading

The panel keeps the workbench frame stable while data loads. Loading should show
`Models loading` and avoid resizing the tab strip.

## Config Error

If any initial load call fails, show a compact error seam near the header. Do not
replace the whole workbench unless no data is available.

## Empty Runtime Models

If `models.configured` returns no models, keep provider config and raw config
available. Runtime inventory shows an unavailable/empty state.

## Empty Catalog Providers

If `models.catalog.providers` returns no providers, catalog actions are hidden
or disabled and the catalog tab explains that Gateway returned no providers.

## Provider Config

Global provider config edits are structured projections over the raw draft.
Fields update `models.providers.<provider>` and save through `/models/config`.

## Fallback Chains

Text and image chains show primary model plus ordered fallbacks. Unknown refs
remain visible; the UI must not silently remove unavailable fallbacks.

## Allowlist

When `agents.defaults.models` is present, each candidate ref can be enabled,
disabled, aliased, marked streaming, and given JSON params. Invalid params show
an error and do not mutate the draft.

## Probe Result

Probe result appears as evidence after `deck.auth.probe`. Auth overview refreshes
after the probe completes.

## Mock-Only Visual

Mock visual E2E evidence is not real Gateway/LLM evidence. Any screenshot or
report must label it as contract-shaped mock coverage.

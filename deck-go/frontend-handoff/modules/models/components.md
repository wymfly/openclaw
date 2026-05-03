# Models Components

## Component Tree

- `ModelsPanel`
  - `ModelsWorkbenchHeader`
  - `ModelMetricStrip`
  - `RuntimeProviderRail`
  - `ProviderAuthRail`
  - `RawConfigSidecar`
  - `ModelsWorkbenchTabs`
    - `RuntimeInventoryView`
      - `ProviderTree`
      - `ModelDetailCard`
      - `ModelInventoryRow`
    - `ProviderConfigView`
      - `SchemaLookupStrip`
      - `ProviderSidebar`
      - `ProviderConfigForm`
      - `BedrockDiscoveryCard`
      - `ProviderModelsEditor`
      - `StringRecordEditor`
    - `FallbackChainView`
      - `FallbackChainCard`
      - `FallbackEditor`
      - `AllowlistRow`
    - `UsageEvidenceView`
      - `UsageCostBar`
      - `ProviderQuotaCard`
      - `ProbeResultCard`

## Local Molecules

### Model Metric Tile

Displays label, numeric value, and small contract hint. It stays local until the
metric tile API is promoted by a dedicated design-system proposal.

### Runtime Provider Rail

Compact side rail grouped by provider. Selecting a provider updates the catalog
selection but does not fetch new data.

### Model Inventory Row

Table-like row with model name/ref, context window, input modes, default badges,
and quick actions. It is not a canonical DataTable yet.

### Provider Config Field Cluster

Groups provider API/auth/base URL/key/header/model fields while preserving raw
config mutation semantics.

### Fallback Chain Card

Shows primary model plus ordered fallbacks for text and image chains. The chain
visually communicates failover order without changing `agents.defaults` shape.

### Usage Cost Bar / Provider Quota Card

Shows mock/frontend usage evidence only. It should not imply live billing truth.

## Production Notes

- Keep all state in `ModelsPanel` unless a real duplication pressure appears.
- Keep `ProviderModelsEditor` and `StringRecordEditor` as local helpers.
- Keep copy in `i18n/en.json` and `i18n/zh.json`.
- Keep production CSS in `models-panel.css`; do not add inline styles.

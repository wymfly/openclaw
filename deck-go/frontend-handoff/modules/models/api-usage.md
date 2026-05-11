# models — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`. The frontend
> consumes generated DTOs from `@/api-types`. This file documents the
> typed config-authority chain that the production module uses.

## Authority split

| Path                                                                                                  | Authority                        | When                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------- |
| `GET /models/config/detail` (typed)                                                                   | Read authority for the typed UI. | Initial load + after any typed mutation success.           |
| `POST /models/providers/upsert` (typed)                                                               | Provider create/edit.            | Add Provider wizard submit + `ProviderDrawer` edit submit. |
| `POST /models/providers/delete-preview` + `POST /models/providers/delete` (typed)                     | Provider delete.                 | Provider delete impact check + commit.                     |
| `POST /models/{providerId}/models/upsert` (typed)                                                     | Model create/edit.               | Add model on a provider + `ModelDrawer` edit submit.       |
| `POST /models/{providerId}/models/delete-preview` + `POST /models/{providerId}/models/delete` (typed) | Model delete.                    | Model delete impact check + commit.                        |
| `POST /models/catalog/mode` (typed; supports `dryRun=true`/`commit=true`)                             | Catalog sync policy change.      | Policy dry-run impact check + commit.                      |

The typed BFF actions are the Models save path. Lower-level raw config routes
may remain available to generic configuration tooling, but the Models page,
drawers, wizard, and dialogs do not invoke a raw JSON editor.

## Frontend wrappers (`@/api`)

```ts
fetchModelsConfigDetail(): Promise<DeckGoModelsConfigDetailResponse>;
upsertModelProvider(req: DeckGoModelProviderUpsertRequest): Promise<...>;
previewProviderDelete(req: DeckGoModelDeletePreviewRequest): Promise<DeckGoModelImpactPreviewResponse>;
deleteModelProvider(req: DeckGoModelDeleteRequest): Promise<DeckGoConfigApplyResponse>;
upsertModel(providerId: string, req: DeckGoModelUpsertRequest): Promise<...>;
previewModelDelete(providerId: string, req: DeckGoModelDeletePreviewRequest): Promise<DeckGoModelImpactPreviewResponse>;
deleteModel(providerId: string, req: DeckGoModelDeleteRequest): Promise<DeckGoConfigApplyResponse>;
setModelsCatalogMode(req: DeckGoSetModelsCatalogModeRequest): Promise<...>;
```

All typed mutation requests carry `expectedBaseHash`. On `409` the BFF
returns a `conflict` error projected through `DataFabricError` with
`kind: "conflict"` and the underlying `configDetail` query is refetched
by `invalidateConfigSurfaces`.

## Data Fabric integration

Query keys live at
`frontend-new/src/data/modules/models/keys.ts`:

```ts
modelsKeys = {
  all,
  configDetail, // typed GET /models/config/detail
  configured, // models.configured RPC roll-up
  authOverview, // deck.auth.overview RPC roll-up
  catalogProviders, // models.catalog.providers RPC
  lookup,
  usageCost,
  usageProviders,
};
```

Query options at `queries.ts`:

- `modelsConfigDetailQueryOptions` — primary read; `bffSource` label
  `config-authority`.
- `modelCatalogProvidersQueryOptions` — wizard catalog (Gateway-backed).

Mutation hooks at `mutations.ts`:

- `useUpsertModelProviderMutation` (also handles wizard create via
  `isCreate=true`).
- `usePreviewProviderDeleteMutation`.
- `useDeleteModelProviderMutation`.
- `useUpsertModelMutation`.
- `usePreviewModelDeleteMutation`.
- `useDeleteModelMutation`.
- `useSetModelsCatalogModeMutation` (dry-run does NOT invalidate; commit
  invalidates `configDetail`, `config`, `configured`, `catalogProviders`).

`invalidateConfigSurfaces` is the shared invalidation helper for typed
mutations. Mode dry-run is the only typed action that intentionally skips
invalidation.

## Request / response shapes

All shapes are generated TypeScript from
`contracts/source/deck-api.contract.ts`. The fields below are reproduced
for handoff orientation; consult the contract source for the
authoritative shape.

### `DeckGoModelsConfigDetailResponse`

```ts
{
  runtimeId?: string;
  detail: DeckGoModelsConfigDetail;
}

DeckGoModelsConfigDetail = {
  hash: string;              // forwarded into expectedBaseHash on writes
  configPresent: boolean;
  mode: "merge" | "replace";
  modeSource: "config" | "default";
  defaults?: Record<string, { provider?: string; model?: string }>;
  providers: DeckGoModelProviderEntry[];
  runtime: DeckGoModelsConfigDetailRuntime; // catalog + auth + counts
};
```

### `DeckGoModelSecretInputStatus`

```ts
"missing" | "empty" | "ref" | "literal-redacted";
```

`literal-redacted` indicates the underlying config still has a literal
secret value; the typed UI never returns or displays the literal — it
exposes a Clear action to migrate to a SecretRef.

### `DeckGoModelProviderUpsertRequest`

```ts
{
  expectedBaseHash: string;
  providerId: string;
  isCreate: boolean;
  baseUrl?: string;
  api?: ModelApi;
  auth?: ModelProviderAuthMode;
  authHeader?: "enable" | "disable" | "preserve";
  injectNumCtxForOpenAICompat?: "enable" | "disable" | "preserve";
  apiKey?:
    | { action: "preserve" }
    | { action: "clear" }
    | { action: "set-ref"; ref: { source: "env" | "file" | "exec"; provider: string; id: string } };
  headers?: Record<string, { action: "preserve" | "remove" | "set-ref"; ref?: { source: "env" | "file" | "exec"; provider: string; id: string } }>;
  models?: DeckGoModelProviderUpsertModelInput[];
  preserveRequest?: boolean;
}
```

### `DeckGoModelUpsertRequest`

```ts
{
  expectedBaseHash: string;
  providerId: string;
  modelId: string;
  isCreate: boolean;
  name?: string;
  api?: ModelApi;
  inheritsApi?: boolean;
  reasoning?: "enable" | "disable" | "preserve";
  inputs?: Array<"text" | "image">;
  contextWindow?: number;
  contextTokens?: number;
  maxTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  headers?: Record<string, string>;
  preserveCompat?: boolean;
}
```

Numeric fields accept `undefined` for partial-config preservation. Empty
strings in the drawer are converted to `undefined` via
`toNumberOrUndefined`.

### Delete impact check / commit

```ts
DeckGoModelDeletePreviewRequest = {
  expectedBaseHash: string;
  providerId: string;     // or { providerId, modelId } in the model variant
};

DeckGoModelImpactPreview = {
  scope:
    | "provider.delete"
    | "model.delete"
    | "catalog.mode.merge"
    | "catalog.mode.replace";
  severity: "safe" | "info" | "warn" | "danger";
  references: DeckGoModelReferenceIndexEntry[]; // includes relation / role when known
  unavailableProviders?: string[];
  defaultsAffected?: boolean;
  impactToken: string;
  generatedAt: number;
  baseHash: string;
};

DeckGoModelDeleteRequest = {
  expectedBaseHash: string;
  impactToken: string;
  confirmText: "delete";
  providerId: string;     // or { providerId, modelId } in the model variant
};
```

### Mode set

```ts
DeckGoSetModelsCatalogModeRequest = {
  expectedBaseHash: string;
  targetMode: "merge" | "replace";
  dryRun?: boolean;
  commit?: boolean;
  impactToken?: string;            // required when commit=true
  confirmText?: "replace";         // required when commit=true and replacing
};
```

A single typed action handles both phases via the `dryRun`/`commit`
flags. Dry-run returns `DeckGoModelImpactPreviewResponse`; commit
returns `DeckGoConfigApplyResponse`.

## Gateway RPC roll-up

The typed BFF rolls Gateway runtime reads under `runtime` so the panel
does not call Gateway RPC paths directly:

- `models.configured` → `detail.runtime.catalog.status` +
  total/configured counts.
- `deck.auth.overview` → `detail.runtime.auth.status` + per-provider
  auth summaries.
- `models.catalog.providers` → exposed separately via
  `useModelCatalogProvidersQuery` for the Add Provider wizard, since the
  wizard runs in parallel with the detail query.

`deck.auth.probe` is intentionally not invoked by this module; probe is
out of scope for the typed UI.

## Endpoint summary

| Endpoint                                     | Method | When                                                      | Request DTO                         | Response DTO                                                                        |
| -------------------------------------------- | ------ | --------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| `/models/config/detail`                      | GET    | Initial load + post-mutation refetch                      | —                                   | `DeckGoModelsConfigDetailResponse`                                                  |
| `/models/providers/upsert`                   | POST   | Wizard submit + provider drawer edit                      | `DeckGoModelProviderUpsertRequest`  | `DeckGoConfigApplyResponse`                                                         |
| `/models/providers/delete-preview`           | POST   | Provider delete impact check                              | `DeckGoModelDeletePreviewRequest`   | `DeckGoModelImpactPreviewResponse`                                                  |
| `/models/providers/delete`                   | POST   | Provider commit-delete                                    | `DeckGoModelDeleteRequest`          | `DeckGoConfigApplyResponse`                                                         |
| `/models/{providerId}/models/upsert`         | POST   | Model drawer create/edit                                  | `DeckGoModelUpsertRequest`          | `DeckGoConfigApplyResponse`                                                         |
| `/models/{providerId}/models/delete-preview` | POST   | Model delete impact check                                 | `DeckGoModelDeletePreviewRequest`   | `DeckGoModelImpactPreviewResponse`                                                  |
| `/models/{providerId}/models/delete`         | POST   | Model commit-delete                                       | `DeckGoModelDeleteRequest`          | `DeckGoConfigApplyResponse`                                                         |
| `/models/catalog/mode`                       | POST   | Mode dry-run + commit                                     | `DeckGoSetModelsCatalogModeRequest` | `DeckGoModelImpactPreviewResponse` (dry-run) / `DeckGoConfigApplyResponse` (commit) |
| `models.catalog.providers` (typed RPC)       | POST   | Wizard catalog via `/v1/runtimes/{runtimeId}/gateway/rpc` | —                                   | `DeckGoModelCatalogProvidersResponse`                                               |

## Backend chain

```
ModelsPanel (orchestrator)
  → typed mutation hooks (frontend-new/src/data/modules/models)
  → frontend wrappers (frontend-new/src/api.ts)
  → deck-go Go BFF (typed routes — backend/internal/server/...)
  → runtime openclaw managed adapter
  → Gateway config.get / config.patch + relevant runtime RPC
```

The browser never calls the OpenClaw Gateway origin directly; only the
deck-go BFF routes are reachable from the frontend.

## SecretInput safety

The deck-go contract enforces that literal secrets never cross the
browser boundary. Concretely:

- The detail response surfaces only `DeckGoModelSecretInputStatus`.
- The upsert request accepts either `{ action: "preserve" }`,
  `{ action: "clear" }`, or `{ action: "set-ref", ref: SecretRef }`.
- A literal value is never accepted as input from the typed UI. Existing
  literals are shown as redacted status and must be migrated through a
  dedicated secret/config workflow outside the Models product surface.

## Conflict handling

- Typed mutations attach `expectedBaseHash` from the latest detail.
- A `409` from the BFF returns a `DataFabricError` with
  `kind: "conflict"`.
- The orchestrator surfaces a Banner inside the active drawer/dialog,
  refetches `configDetail`, and lets the user retry against the fresh
  base hash.

## Stale-preview handling

- Impact check responses include `impactToken` + `generatedAt` +
  `baseHash`.
- The commit request sends back `impactToken` + `expectedBaseHash`.
- The BFF re-runs the impact analysis at commit time. If the token is
  no longer valid (e.g. the underlying config moved), the commit fails
  with a stale-preview error and the orchestrator returns to the
  preview step.

## Mock requirements

For component tests and visual fixtures the minimal data set is:

- `detail.providers`: 2–3 providers with mixed auth modes
  (`api-key`, `aws-sdk`, `oauth`, `token`) and at least one provider
  in each `apiKeyStatus`: `missing`, `empty`, `ref`,
  `literal-redacted`.
- Nested provider `models`: 4–6 models across providers with reasoning
  enabled on at least one and partial cost configuration on at least one.
- Impact check fixtures: at least one reference per source
  (agent / channel / hook / tool / session) so the preview list is
  non-empty in destructive-flow tests. Include relation / role coverage for
  primary/default/fallback model references.
- `detail.runtime.catalogStatus`: covers `available`, `stale`, and
  `unavailable` statuses across at least one fixture each.
- Catalog providers query: at least one `models.catalog.providers`
  entry plus a "custom" pathway test (catalog query degraded).
- Impact check fixtures: cover `safe`, `info`, `warn`, `danger`
  severities and the `defaultsAffected: true` branch.

Component tests do not exercise mode dry-run vs. commit invalidation
beyond what `mutations.test.ts` already verifies at the data layer.

## Open contract assumptions

- `DeckGoModelImpactPreview` references include enough provenance
  (owner module + ref kind) for the dialog to render the human-readable
  summary; the BFF currently provides `module`, `kind`, and a stable
  `path` per entry. If the runtime exposes additional context (display
  name, last-used timestamp), the dialog can opportunistically render
  it without a contract change.
- `DeckGoCatalogProvider.authType` is a permissive string from the
  Gateway; the wizard validates it against `AUTH_MODES` and falls back
  to `api-key` for unknown values (logged as a follow-up).
- Pricing snapshots and PATCH audit projections are NOT part of this
  module's contract chain.

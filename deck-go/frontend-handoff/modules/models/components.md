# models — components

> Engineering target: `frontend-new/src/components/panels/models/`. The
> component tree below mirrors the production tree as of the typed
> config-authority rewrite.

## Production component tree

```
ModelsPanel (orchestrator)
  ├── parts/CatalogHeader
  │     ├── catalog sync policy badge (mode is secondary technical detail)
  │     ├── configured provider/model counts
  │     ├── runtime catalog status Badge
  │     ├── runtime auth status Badge
  │     └── action row: Refresh · Add Provider
  ├── parts/UsagePolicyOverview
  │     ├── read-only `DeckGoModelsConfigDetail.defaults` role grid
  │     ├── primary model + fallback labels
  │     └── Agents ownership chip
  ├── parts/ProviderListSection[]            (main configured provider groups)
  │     ├── provider auth/status badges
  │     ├── provider actions (Edit provider · Add model · Check impact)
  │     └── parts/ModelRow[]                 (nested configured models)
  │           ├── reasoning/input/contextWindow chips
  │           ├── default / fallback / primary / referenced badges
  │           └── row actions (Edit · Check impact)
  ├── drawers/ProviderDrawer
  │     ├── tab "overview"   — provider id / name / baseUrl / api / auth
  │     ├── tab "identity"   — apiKey via SecretInputField, provider headers
  │     ├── tab "networking" — request layout summary, injectNumCtx toggle
  │     ├── tab "models"     — read-only model count + jump-into-list
  │     └── tab "advanced"   — compat / unsupported field summary (read-only)
  ├── drawers/ModelDrawer
  │     ├── tab "overview"   — model id / name / providerId / api inherit
  │     ├── tab "identity"   — reasoning toggle / modality multi-select
  │     ├── tab "capacity"   — contextWindow, contextTokens, maxTokens
  │     ├── tab "cost"       — input / output / cacheRead / cacheWrite
  │     ├── tab "networking" — per-model headers (read-only summary +
  │     │                     SecretInputField for sensitive header values)
  │     └── tab "advanced"   — compat summary + unsupported fields
  ├── drawers/SecretInputField
  │     ├── radio: preserve / set-ref / clear
  │     └── env secret id input (when set-ref selected)
  ├── wizard/AddProviderWizard
  │     ├── step "select"    — copy a read-only template from
  │     │                     `models.catalog.providers`, or start blank
  │     │                     custom provider
  │     ├── step "configure" — provider id/baseUrl/api/auth + SecretInput
  │     │                     + selectable copied default models
  │     └── step "review"    — summary + submit (calls upsert mutation
  │                          with isCreate=true)
  ├── dialogs/ImpactPreviewDialog
  │     ├── severity Badge (`safe | info | warn | danger`)
  │     ├── scope description
  │     ├── reference list (agents / channels / hooks / tools / runtime
  │     │   / session sources) with relation / role metadata
  │     ├── Agents owner-boundary Banner for `agents.*` model policy
  │     ├── unavailable providers
  │     └── defaults-affected Banner
  ├── dialogs/TypeToConfirmDialog
  │     ├── description
  │     ├── input (must equal expected text — `delete` or `replace`)
  │     └── confirm/cancel actions
  └── lib/models-selectors.ts
        — pure projections used by parts/drawers/wizard/dialogs
        (getDetail, listProviders, findProvider, findModel,
        describeSecretStatus, isSecretConfigured, describeMode,
        severityVariant, impactReferenceCount, shouldBlockCommit,
        describeRuntime, modelInputsLabel, totalConfiguredModels,
        modelDefaultRoles, modelUsageRelations, modelUsageRoles,
        isProviderReferenced).
```

## Prototype file → production target

The typed config-authority rewrite moved the production module away from
the historical V2 list↔detail tree. The mapping below documents what the
old prototype names became:

| Historical prototype file                                | Current production target                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.jsx` (orchestrator)                                 | `ModelsPanel.tsx` (now a typed orchestrator with state machines, not a router)                                                                                                        |
| `list-view.jsx`                                          | `parts/CatalogHeader.tsx` + `parts/ProviderListSection.tsx` + `parts/ModelRow.tsx`                                                                                                    |
| `detail-view.jsx` (Limits/Pricing/Usage/Auth/Audit tabs) | Replaced by `drawers/ProviderDrawer.tsx` + `drawers/ModelDrawer.tsx` (no usage/audit tabs — out of scope)                                                                             |
| `dialogs.jsx` (Probe/Auth/Catalog)                       | Replaced by `dialogs/ImpactPreviewDialog.tsx` + `dialogs/TypeToConfirmDialog.tsx` (Probe and standalone Auth dialogs are out of scope; Catalog became `wizard/AddProviderWizard.tsx`) |
| `data.js`                                                | No mock fixture fork — production consumes `DeckGoModelsConfigDetailResponse` and `DeckGoModelCatalogProvidersResponse` directly. Component tests inline minimal fixtures.            |
| `icons.jsx`                                              | Dropped. Production uses `@/design-system/icons` re-exports + textual Badges.                                                                                                         |
| `styles.css`                                             | Dropped. Production uses `models-panel.css` + colocated atom CSS (kebab-case).                                                                                                        |
| `tokens.css`                                             | Dropped. Tokens canonical at `frontend-new/src/design-system/tokens/index.css`.                                                                                                       |
| `tweaks-panel.jsx`                                       | Dropped. Design-time tooling only.                                                                                                                                                    |

## Props (shape contracts)

Where types come from `@/api-types` (generated from
`contracts/source/deck-api.contract.ts`).

### `ModelsPanel`

Props: none — the panel is mounted by the panel registry. Internally reads
from the data-fabric query layer:

```ts
const detailQuery = useModelsConfigDetailQuery(); // DeckGoModelsConfigDetail
const catalogQuery = useModelCatalogProvidersQuery();
```

Mutations:

```ts
useUpsertModelProviderMutation();
usePreviewProviderDeleteMutation();
useDeleteModelProviderMutation();
useUpsertModelMutation();
usePreviewModelDeleteMutation();
useDeleteModelMutation();
useSetModelsCatalogModeMutation();
```

Internal state machines (see `states.md`):

- `ProviderEditorState = { kind: "idle" } | { kind: "new" } | { kind: "edit"; providerId: string }`
- `ModelEditorState   = { kind: "idle" } | { kind: "new"; providerId: string } | { kind: "edit"; providerId: string; modelId: string }`
- `DeleteFlowState    = { kind: "idle" } | { kind: "preview-provider"; providerId } | { kind: "confirm-provider"; preview: DeckGoModelImpactPreview } | { kind: "preview-model"; ... } | { kind: "confirm-model"; preview }`
- `ModeFlowState      = { kind: "idle" } | { kind: "preview"; targetMode: "merge" | "replace" } | { kind: "confirm"; preview: DeckGoModelImpactPreview }` — advanced policy path only.

### `parts/CatalogHeader`

```ts
interface CatalogHeaderProps {
  detail: DeckGoModelsConfigDetail;
  busy: boolean;
  onRefresh(): void;
  onAddProvider(): void;
  onModeChange(target: "merge" | "replace"): void;
}
```

Surfaces:

- catalog sync policy Badge + product-language Toggle (`onCheckedChange` +
  `aria-label`) is historical. Current production keeps normal setup focused
  on configured provider groups and the Add Provider wizard; `merge` /
  `replace` values are secondary technical copy and advanced policy controls
  only.
- configured provider/model counts (`totalConfiguredModels`,
  `detail.providers.length`).
- runtime catalog Badge: `available → ok`, `stale → warn`,
  `unavailable → neutral`.
- runtime auth Badge: same mapping over `detail.runtime.auth.status`.
- action buttons: Refresh, Add Provider.

### `parts/ProviderListSection`

```ts
interface ProviderListSectionProps {
  provider: DeckGoModelProviderDetail;
  models: DeckGoModelDetail[];
  references: DeckGoModelReferenceIndexEntry[];
  collapsed: boolean;
  onToggleCollapsed(): void;
  onEditProvider(): void;
  onAddModel(): void;
  onPreviewDeleteProvider(): void; // user-facing label: Delete... / impact check
  onEditModel(modelId: string): void;
  onPreviewDeleteModel(modelId: string): void; // user-facing label: Delete... / impact check
}
```

Header badges: auth mode, secret status, inject-num-ctx flag, auth-header
flag, referenced flag.

### `parts/ModelRow`

```ts
interface ModelRowProps {
  model: DeckGoModelDetail;
  isDefault: boolean;
  isReferenced: boolean;
  onEdit(): void;
  onPreviewDelete(): void;
}
```

Chips: reasoning, inputs (`modelInputsLabel`), context window. Badges:
default, referenced.

### `drawers/ProviderDrawer`

```ts
interface ProviderDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: DeckGoModelProviderDetail;
  expectedBaseHash: string;
  busy: boolean;
  conflict: boolean;
  errorMessage?: string;
  onClose(): void;
  onSubmit(request: DeckGoModelProviderUpsertRequest): void;
}
```

Tabs: `overview | identity | networking | models | advanced`. The
identity tab embeds `SecretInputField` for `apiKey`. `request`/`compat`
are surfaced read-only on the advanced tab to preserve unedited config
leaves.

### `drawers/ModelDrawer`

```ts
interface ModelDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  providerId: string;
  initial?: DeckGoModelDetail;
  expectedBaseHash: string;
  busy: boolean;
  conflict: boolean;
  errorMessage?: string;
  onClose(): void;
  onSubmit(request: DeckGoModelUpsertRequest): void;
}
```

Tabs: `overview | identity | capacity | cost | networking | advanced`.
Numeric inputs round-trip through `toNumberOrUndefined` so empty strings
become `undefined` (preserve partial configs).

### `drawers/SecretInputField`

```ts
interface SecretInputFieldProps {
  label: string;
  status: DeckGoModelSecretInputStatus;
  value: SecretEditAction;
  onChange(next: SecretEditAction): void;
}

type SecretEditAction =
  | { kind: "preserve" }
  | { kind: "clear" }
  | { kind: "set-ref"; ref: DeckGoModelSecretRef };
```

Existing status surfaced via `describeSecretStatus`. The radio defaults
to `preserve` so editing a provider does not unintentionally clear or
re-bind the secret.

### `wizard/AddProviderWizard`

```ts
interface AddProviderWizardProps {
  open: boolean;
  catalogProviders: DeckGoCatalogProvider[];
  expectedBaseHash: string;
  busy: boolean;
  errorMessage?: string;
  onCancel(): void;
  onSubmit(request: DeckGoModelProviderUpsertRequest): void;
}
```

Steps: `select | configure | review`. Custom-provider entry immediately
enters the visible configure step, skips the catalog
`defaultBaseUrl`/`authType` seeding, and starts from blank fields. Provider
Library Configure also enters the configure step with the catalog template
preselected. `authType` from the catalog is validated against
`AUTH_MODES = ["api-key", "aws-sdk", "oauth", "token"]` before assignment;
unknown values fall back to `api-key`.

### `dialogs/ImpactPreviewDialog`

```ts
interface ImpactPreviewDialogProps {
  open: boolean;
  preview: DeckGoModelImpactPreview;
  busy: boolean;
  errorMessage?: string;
  onCancel(): void;
  onContinue(): void;
}
```

Severity → Badge variant via `severityVariant`
(`safe → ok`, `info → neutral`, `warn → warn`, `danger → err`).
References render with their owner module + ref kind. Defaults-affected
flag surfaces as a Banner in the dialog body.

### `dialogs/TypeToConfirmDialog`

```ts
interface TypeToConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  expectedText: string; // CONFIRM_TEXT_DELETE = "delete" | CONFIRM_TEXT_REPLACE = "replace"
  busy: boolean;
  errorMessage?: string;
  onCancel(): void;
  onConfirm(confirmText: string): void;
}
```

`dismissOnScrimClick={false}` is required for destructive paths. The
confirm button is disabled until input matches `expectedText` (trimmed,
case-sensitive).

## Class naming

CSS lives at `frontend-new/src/components/panels/models/models-panel.css`
(kebab-case, no inline styles). Conventions:

- `.models-panel` root container.
- `.models-catalog-header` / `.models-catalog-header__row`.
- `.models-provider-section` / `.models-provider-section__head` /
  `.models-provider-section__body`.
- `.models-row` / `.models-row__main` / `.models-row__chips`.
- `.models-drawer-body` / `.models-drawer-tabs`.
- `.models-secret-field` / `.models-secret-field__radio`.
- `.models-impact-list` / `.models-impact-row`.
- `.models-dialog-head` / `.models-dialog-body` / `.models-dialog-foot`.
- `.models-wizard-steps` / `.models-wizard-body`.
- `.models-meta` / `.models-empty-state`.

## Accessibility

- Advanced mode-switch controls, when visible, require accessible labeling and
  impact-check gating. They are not part of the normal Provider Library setup
  path.
- Spinner instances require `aria-label` (the orchestrator passes the
  i18n loading copy).
- Drawer/Modal: focus trap inside while open; `Esc` closes the topmost
  drawer/dialog; trigger re-focuses on close.
- Tab strips inside drawers expose `role="tablist"` + `aria-selected`.
- Badges always carry textual labels; color is decoration only.
- TypeToConfirm input has `aria-label` from the i18n key
  `confirmDialog.inputLabel`.
- Banner is used for conflict / error / defaults-affected — one per
  surface, not duplicated for emphasis.

# models — interactions

## Pointer

- Click "Refresh" on the catalog header → re-fetch
  `models.config.detail` (and the catalog providers query when the wizard
  is open).
- Click "Add Provider" on the catalog header → open
  `wizard/AddProviderWizard` at the `select` step.
- Change catalog sync policy on the catalog header → enter `ModeFlowState`
  `preview` (server dry-run). On configured-assets-only (`replace`) selection,
  the type-to-confirm step is mandatory; on built-in-catalog (`merge`) the dry-run preview still runs but
  type-to-confirm is shown only when the impact severity is
  `warn | danger`.
- Click "Edit" on a provider → open `drawers/ProviderDrawer` in `edit`
  mode for that provider.
- Click "Add model" on a provider → open `drawers/ModelDrawer` in `new`
  mode scoped to that provider.
- Click "Delete..." on a provider → trigger
  `usePreviewProviderDeleteMutation`; transition `DeleteFlowState` from
  `idle` → `preview-provider` → on success → `confirm-provider`.
- Click "Edit" on a model row → open `drawers/ModelDrawer` in `edit`
  mode.
- Click "Delete..." on a model row → trigger
  `usePreviewModelDeleteMutation`; transition `DeleteFlowState` from
  `idle` → `preview-model` → on success → `confirm-model`.
- Inside `dialogs/ImpactPreviewDialog`:
  - Click "Continue" → switch to `dialogs/TypeToConfirmDialog`
    (carrying the impact token).
  - Click "Cancel" → return `DeleteFlowState`/`ModeFlowState` to `idle`.
- Inside `dialogs/TypeToConfirmDialog`:
  - Type the expected text (`delete` for delete flows, `replace` for
    mode replace) → enables the confirm button.
  - Click "Confirm" → run the corresponding commit mutation
    (`useDeleteModelProviderMutation` / `useDeleteModelMutation` /
    `useSetModelsCatalogModeMutation` with commit=true) carrying
    `impactToken` + `expectedBaseHash`.
  - Click "Cancel" → return state machine to `idle` without invoking the
    commit mutation.
- Inside `wizard/AddProviderWizard`:
  - Click a catalog card → seed `defaultBaseUrl` and `authType` from
    `DeckGoCatalogProvider` (validated against `AUTH_MODES`).
  - Click "Use custom" → start from blank fields.
  - Click "Continue" on `select`/`configure` steps → advance.
  - Click "Submit" on `review` → call
    `useUpsertModelProviderMutation` with `isCreate=true`.
- Inside `drawers/SecretInputField`:
  - Choose "Preserve" → field omitted from the upsert request (no write).
  - Choose "Set ref" → render an environment Secret ID input;
    apiKey arrives at the BFF as
    `{ action: "set-ref", ref: { source: "env", provider: "default", id } }`.
  - Choose "Clear" → apiKey arrives as `{ action: "clear" }`.

## Keyboard

| Key                                            | Action                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `Enter` / `Space` on focused row action button | Trigger the action (Edit / Delete... / Add model).              |
| `Esc` in any drawer                            | Close the topmost drawer (state machine returns to `idle`).     |
| `Esc` in any dialog                            | Close the topmost dialog (state machine returns to `idle`).     |
| `Tab` / `Shift+Tab`                            | Cycle focus through the focus trap of the active drawer/dialog. |

The panel intentionally does not bind `⌘N` / `⌘K` shortcuts; new provider
entry is via the catalog header button + wizard.

## Hover

- Buttons follow the design-system Button hover/focus rules.
- Provider/model rows are not row-clickable in the typed surface — the
  rows are containers; affordances live on explicit action buttons.
- Toggle hover follows the canonical Toggle component.

## Empty / error / loading

- Catalog detail loading → centered Spinner with i18n loading label.
- Catalog detail error → Banner `error` variant with retry call to
  `useModelsConfigDetailQuery().refetch()`.
- No providers configured → empty-state block with "Add Provider" CTA.
- Per-provider empty model list → inline empty state inside the provider
  section.
- Catalog providers query failure (during wizard) → Banner inside the
  wizard `select` step; user can fall back to "Use custom".
- Mutation conflict → Banner `warn` variant inside the active drawer
  with i18n copy referencing base-hash staleness; underlying detail
  query is refetched automatically by `invalidateConfigSurfaces`.
- Mutation error → Banner `error` variant inside the active drawer or
  dialog with the BFF error message.

## Accessibility

- Root has `data-testid="models-panel"` for E2E.
- Badges always carry textual labels; color is decoration.
- Toggle uses `onCheckedChange` + `aria-label`.
- Spinner has `aria-label`.
- Drawer focus trap closes via `Esc`; closing returns focus to the
  trigger button when present.
- TypeToConfirm input is labeled via `confirmDialog.inputLabel` and is
  the autofocus target on open.
- Banner regions use `role="alert"` for error variants per the canonical
  Banner atom.

## Pointer + keyboard parity

- Every action that fires a typed mutation has both a clickable button
  and keyboard activation (`Enter` / `Space`).
- The wizard step controls are `<Button>` instances with explicit
  enabled/disabled state per step, not raw `<a>` links.
- Toggle and confirm buttons are reachable via `Tab` from the
  drawer/dialog body.

## Long content

- Provider id / name / baseUrl render in monospace where appropriate.
- Long ids truncate via the design-system Input/Chip components and
  expose the full value through the underlying `<input title>` /
  `<span title>` attributes.
- Impact check reference list scrolls vertically inside
  `ImpactPreviewDialog` body.

## Dialogs

- `dialogs/ImpactPreviewDialog` — informational impact check. Surfaces severity,
  scope description, the BFF-rebuilt reference list, unavailable
  providers, relation/role metadata, Agents owner-boundary copy, and a
  defaults-affected Banner. The "Continue" button
  carries the impact token to the type-to-confirm step.
- `dialogs/TypeToConfirmDialog` — guarded confirmation. The confirm
  button is disabled until the typed input matches the expected text;
  `dismissOnScrimClick={false}` is enforced for destructive paths.
- The wizard shell does not use a separate ConfirmDialog — review-step
  submit goes straight to the create upsert mutation.

## Cross-module side effects

- Successful provider/model create or edit triggers
  `invalidateConfigSurfaces`, which invalidates `configDetail`,
  `config`, and `configured` keys.
- Mode commit additionally invalidates `catalogProviders`.
- Mode dry-run preview does **not** invalidate any keys (it is a
  read-only server-side projection).
- Raw config save is not exposed from the Models product surface. If a
  lower-level generic config tool changes model config, Models refetches typed
  detail through normal Data Fabric invalidation on the next refresh/navigation.

## Out-of-scope for this module

- Per-model probe runner.
- OAuth runner UX.
- Secret-store CRUD beyond field-level SecretRef.
- Bulk-import models.
- Real-time streaming usage tiles.
- Per-model rate-limit override editor.
- "Set default" / "Add fallback" / fallback-chain editing are read-only here.
  Models surfaces the reference index for impact review; editing
  `agents.defaults.model`, per-agent `model`, subagent model defaults, and
  `{ primary, fallbacks }` belongs to the Agents module.

# models — states

The Models panel is a single-route workbench (no list↔detail navigation).
All states live inside the orchestrator and are driven by:

- the data-fabric query state for `useModelsConfigDetailQuery` and
  `useModelCatalogProvidersQuery`;
- four orchestrator state machines for editor / delete / mode / wizard
  flows;
- mutation pending/error states from the typed mutation hooks.

## Detail query state

| State                  | Trigger                                                      | UI                                                                                                             |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `pending` (initial)    | First mount with no cache.                                   | Centered Spinner with i18n loading label; the rest of the panel is hidden.                                     |
| `pending` (refresh)    | Programmatic `refetch()` while data is present.              | Spinner adjacent to the Refresh button; the existing UI keeps rendering.                                       |
| `success`              | `models.config.detail` resolved.                             | Catalog header + provider list; empty state when `providers` is empty.                                         |
| `error`                | Query failed.                                                | Banner `error` with i18n message and Retry button; underlying empty-state visible if cache is empty.           |
| `conflict` (transient) | Mutation returned `DataFabricError` with `kind: "conflict"`. | Banner `warn` inside the active drawer/dialog; query is refetched automatically by `invalidateConfigSurfaces`. |

## ProviderEditorState (drawer flow)

```ts
type ProviderEditorState =
  | { kind: "idle" }
  | { kind: "new" }
  | { kind: "edit"; providerId: string };
```

Transitions:

- `idle → new` — "Add Provider" wizard submitted (the wizard owns the
  create path; `ProviderDrawer` is reserved for `edit` here).
- `idle → edit` — "Edit" button on a provider row.
- `new | edit → idle` — drawer close (`Esc` / cancel / submit success).
- Conflict during submit → `kind` retained; conflict Banner surfaces in
  the drawer; the user keeps editing until they retry against the fresh
  detail.

## ModelEditorState (drawer flow)

```ts
type ModelEditorState =
  | { kind: "idle" }
  | { kind: "new"; providerId: string }
  | { kind: "edit"; providerId: string; modelId: string };
```

Transitions parallel `ProviderEditorState`. The drawer is scoped to the
provider regardless of `new` / `edit` so cross-provider model moves are
not modeled here (out of scope).

## DeleteFlowState (preview → confirm)

```ts
type DeleteFlowState =
  | { kind: "idle" }
  | { kind: "preview-provider"; providerId: string }
  | { kind: "confirm-provider"; preview: DeckGoModelImpactPreview }
  | { kind: "preview-model"; providerId: string; modelId: string }
  | { kind: "confirm-model"; preview: DeckGoModelImpactPreview };
```

Transitions:

- `idle → preview-provider` (user clicks Preview delete on a provider).
- `preview-provider → confirm-provider` (preview mutation success).
- `preview-provider → idle` (preview error / cancel).
- `confirm-provider → idle` (commit success or cancel).
- Same loop applies for the model variant.

`expectedBaseHash` is sourced from the impact preview in the
`confirm-*` state (the BFF rebinds the preview to the latest hash). Stale
preview tokens are rejected by the BFF and surface as Banner errors
inside the type-to-confirm dialog.

## ModeFlowState (catalog mode)

```ts
type ModeFlowState =
  | { kind: "idle" }
  | { kind: "preview"; targetMode: "merge" | "replace" }
  | { kind: "confirm"; preview: DeckGoModelImpactPreview };
```

Transitions:

- `idle → preview` — user toggles the catalog mode.
- `preview → confirm` — dry-run mutation succeeded **and** the mode is
  `replace` or the impact severity is `warn | danger`.
- `preview → idle` — dry-run shows `safe | info` for `merge` (commit is
  applied directly) or the user cancels.
- `confirm → idle` — commit success or cancel.

Mode dry-run does NOT invalidate any query keys; only the commit step
does (and additionally invalidates `catalogProviders`).

## Wizard state (Add Provider)

The wizard owns its own three-step state inside `AddProviderWizard.tsx`:

```
"select" → "configure" → "review" → submit
```

- `select` — pick from `useModelCatalogProvidersQuery` data, or "Use
  custom" entry.
- `configure` — provider id/name/baseUrl/api/auth + SecretInput.
- `review` — surface the planned upsert payload (including SecretRef
  summary). Submit calls `useUpsertModelProviderMutation` with
  `isCreate=true` and `expectedBaseHash` from the active detail query.

If the catalog providers query is degraded, the `select` step Banner
suggests "Use custom" and the wizard proceeds without seeded defaults.

## Mutation lifecycle

For each typed mutation:

1. `idle` — drawer/dialog is in its working state; submit is enabled.
2. `pending` — submit is disabled; Spinner replaces the action label.
3. `success` — `invalidateConfigSurfaces` runs; drawer/dialog closes;
   relevant orchestrator state returns to `idle`.
4. `error` — Banner inside the surface; user can edit and retry.
5. `conflict` — special-case `error` with `DataFabricError`
   `kind: "conflict"`; the Banner copy points at base-hash staleness and
   the detail query is refetched automatically (the user re-submits
   against the fresh hash).

Advanced raw save (`useSaveModelsConfigMutation`) follows the same
lifecycle but invalidates `modelsKeys.all()` rather than the typed
surfaces. Typed surfaces are not updated optimistically by the raw
save — they are refetched.

## Responsive

Layout is content-first (no fixed multi-column grid).

- ≥1080px: catalog header inline, action buttons right-aligned; provider
  sections render as full-width cards.
- 720–1080px: catalog header wraps, action buttons stack into a row
  below the title.
- <720px: drawers transition to full-screen sheets (per the canonical
  Drawer atom); dialogs remain centered Modals.

## Density

The panel respects the global `data-density="compact"` attribute via
canonical atom rules. There is no module-specific density override.

## Out-of-scope states

- Probe (ok / cooldown / error / unknown) — not modeled here.
- OAuth runner — not modeled here.
- Per-provider quota windows — not modeled here.
- Audit history — not modeled here.

These are tracked under `openspec/follow-ups/` and will land with their
own contract chains and state diagrams when they ship.

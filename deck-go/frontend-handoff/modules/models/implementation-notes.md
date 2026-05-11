# Models implementation notes

Status: implemented — typed config-authority workbench
(`deck-go-models-config-control-plane`).

The current Models module aligns the deck-go panel with OpenClaw config
truth (`src/config/types.models.ts`) and the typed deck-go contract
chain (`contracts/source/deck-api.contract.ts`). It supersedes the
historical V2 list↔detail prototype and the V1 Codex single-file
prototype, both of which remain on disk as labeled references.

## Source truth

- OpenClaw config truth:
  `src/config/types.models.ts` (`ModelsConfig` shape with provider /
  model field optionality), `src/config/zod-schema.core.ts` (zod
  schema for the same), and `src/config/schema.help.ts` (descriptive
  help text).
- Deck-facing contract authority:
  `contracts/source/deck-api.contract.ts` and
  `contracts/source/deck-endpoints.contract.json` (typed mutations,
  delete-preview/commit, mode dry-run/commit, SecretInput status).
- UI metadata: `contracts/source/deck-ui.contract.json` (Models domain
  registers typed actions and their evidence).
- Production frontend tree:
  `frontend-new/src/components/panels/models/`.
- Browser boundary: the panel calls deck-go BFF routes only; it does
  not call the OpenClaw Gateway origin directly.

## Architecture

```
ModelsPanel (orchestrator)
├── lib/models-selectors.ts      — pure projections over DeckGoModelsConfigDetail
├── parts/CatalogHeader.tsx      — policy badge + counts + runtime status + actions
├── parts/ModelRow.tsx           — per-model row with chips/badges + actions
├── parts/ProviderListSection.tsx — configured provider sections on the main page
├── drawers/ProviderDrawer.tsx   — 5 tabs (overview/identity/networking/models/advanced)
├── drawers/ModelDrawer.tsx      — 6 tabs (overview/identity/capacity/cost/networking/advanced)
├── drawers/SecretInputField.tsx — preserve / set-ref / clear radio + env SecretRef id
├── wizard/AddProviderWizard.tsx — select / configure / review (with custom-provider path)
├── dialogs/ImpactPreviewDialog.tsx — severity / scope / references / relation-role metadata / owner boundary
└── dialogs/TypeToConfirmDialog.tsx — typed confirmation guard for delete + mode replace
```

State machines live inside `ModelsPanel.tsx`:

- `ProviderEditorState`, `ModelEditorState` — drawer flows.
- `DeleteFlowState` — preview → impact-token → type-to-confirm commit.
- `ModeFlowState` — dry-run → impact-token → type-to-confirm commit.

`AddProviderWizard.tsx` owns its own three-step state (select /
configure / review). The blank custom-provider option and every template-copy
entry point enter the configure step visibly; they must not rely on hidden draft
state with no UI transition. Template copies prefill editable API/baseUrl/auth
and expose selectable default model entries that are written through provider
upsert.

Confirm strings: `CONFIRM_TEXT_DELETE = "delete"`,
`CONFIRM_TEXT_REPLACE = "replace"` (passed into `TypeToConfirmDialog`
as `expectedText`).

## Contract chain

The typed mutations carry `expectedBaseHash` derived from the latest
`DeckGoModelsConfigDetailResponse`. Conflict (HTTP 409) projects into
`DataFabricError` with `kind: "conflict"`; `invalidateConfigSurfaces`
refreshes `configDetail` automatically.

| Workflow                     | Frontend wrapper                         | BFF route                                          | Authority                                                                |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| Read                         | `fetchModelsConfigDetail`                | `GET /models/config/detail`                        | Typed read authority for the panel.                                      |
| Provider Library read        | `fetchRuntimeModelCatalogProviders`      | Gateway `models.catalog.providers` through deck-go | Read-only template catalog. Does not imply writable installed providers. |
| Provider create              | `upsertModelProvider` (`isCreate=true`)  | `POST /models/providers/upsert`                    | Wizard → typed mutation.                                                 |
| Provider edit                | `upsertModelProvider` (`isCreate=false`) | same                                               | Provider drawer → typed mutation.                                        |
| Provider delete impact check | `previewProviderDelete`                  | `POST /models/providers/delete-preview`            | Required before commit.                                                  |
| Provider delete commit       | `deleteModelProvider`                    | `POST /models/providers/delete`                    | Carries `impactToken` + `confirmText: "delete"`.                         |
| Model create                 | `upsertModel` (`isCreate=true`)          | `POST /models/{providerId}/models/upsert`          | Model drawer (new).                                                      |
| Model edit                   | `upsertModel` (`isCreate=false`)         | same                                               | Model drawer (edit).                                                     |
| Model delete impact check    | `previewModelDelete`                     | `POST /models/{providerId}/models/delete-preview`  | Required before commit.                                                  |
| Model delete commit          | `deleteModel`                            | `POST /models/{providerId}/models/delete`          | Carries `impactToken` + `confirmText: "delete"`.                         |
| Mode dry-run                 | `setModelsCatalogMode` (`dryRun=true`)   | `POST /models/catalog/mode`                        | Advanced policy only. Returns impact check; does not invalidate.         |
| Mode commit                  | `setModelsCatalogMode` (`commit=true`)   | same                                               | Advanced policy only. Carries `impactToken` and required confirm text.   |

Provider Library semantics:

- `models.catalog.providers` entries are read-only templates.
- `detail.providers[]` entries are authored `openclaw.json` assets.
- A matching id in both surfaces is a configured built-in provider.
- Provider templates are used inside the Add Provider wizard only. Copy/configure
  on a template writes `models.providers.<id>` via provider upsert and may
  include selected template model entries; it never mutates the built-in catalog.
- Custom models are written only under an authored provider. A template-only
  provider must be configured first.

## SecretInput safety

The contract enforces that literal secrets never cross the browser
boundary:

- The detail response surfaces only `DeckGoModelSecretInputStatus`
  (`missing | empty | ref | literal-redacted`).
- Upsert requests carry one of `{ action: "preserve" }` /
  `{ action: "clear" }` / `{ action: "set-ref"; ref: SecretRef }`.
- Literal secrets are not writable from the Models product surface.

The default radio selection in `SecretInputField` is `preserve`, so
editing a provider does not unintentionally clear or rebind its
secret.

## Out-of-scope claims

The module deliberately does not claim:

- Audit history (`PATCH /models/config` audit projection).
- Rollback or transactional state.
- Secret-store CRUD (a centralized `SecretRef` registry).
- OAuth runner UI.
- Probe (`deck.auth.probe`) or force-probe-cache refresh.
- Quota / rate-limit editing.
- Pricing snapshot panel.
- Provider/model search and filter at list level.
- Per-model rate-limit overrides.

## Agents-owned model policy

Models displays `agents.defaults`, per-agent, and subagent model references
as read-only usage facts, including `primary`, `default`, `fallback`, and
generic reference relations when the BFF can derive them. Editing
`agents.defaults.model`, role-specific defaults, per-agent `model`,
subagent defaults, and `{ primary, fallbacks }` chains is intentionally
deferred to the Agents module. Models must not reintroduce a raw editor as the
policy-editing path.

These are tracked under `openspec/follow-ups/` and will land with their
own contract chains.

## Testing

Component-level evidence:

- `frontend-new/src/data/modules/models/mutations.test.ts` — 11/11
  covering typed mutation routing, dryRun/commit invalidation split,
  conflict propagation through
  `DataFabricError` `kind: "conflict"`, and SecretRef construction.
- `frontend-new/src/components/panels/models/ModelsPanel.test.tsx` —
  covering catalog header + configured provider list rendering, usage/default/
  fallback badges, empty-state CTA, AddProvider wizard typed mutation
  routing with SecretRef construction, provider id collision copy,
  raw-editor absence, usage-policy overview, delete impact check surfaces references
  with owner-boundary copy then commits with `confirmText: "delete"` +
  `impactToken`, and Chinese locale copy.

Mechanical verification (recorded in tasks 7.1–7.4 of the source
change):

- `openspec validate deck-go-models-config-control-plane --type change --strict`
  → `Change 'deck-go-models-config-control-plane' is valid`.
- `cd deck-go && make contract-gate` → green
  (stream / live-projection / list-query / mutation-evidence /
  dynamic-surfaces / route-governance / config-write-safety; gateway
  typecheck 0 violations; describe-completeness 173 methods / 24
  events; contract-chain-audit 26 rows).
- `cd deck-go/backend && go test ./internal/server/... -run "TestModels" -count=1`
  → `ok 0.420s`.
- `cd deck-go/frontend-new && pnpm vitest run src/data/modules/models/ src/components/panels/models/`
  → 17/17 passing.
- `cd deck-go && make frontend-build` → built in 1.64s.

Mock E2E and bounded real Gateway smoke (tasks 7.5 / 7.6) are tracked
separately in the source change closure.

## Why the prototype line of thinking shifted

The historical V2 prototype (kept on disk under `app.jsx`,
`list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `data.js`,
`icons.jsx`, `styles.css`, `tokens.css`, `tweaks-panel.jsx`) modeled
Models as a list↔detail product with Limits / Pricing / Usage / Auth /
Audit tabs, plus a usage cost dashboard and a per-model audit history.
After auditing OpenClaw config truth and Gateway capabilities the
typed product surface narrowed to config authority because:

- Pricing snapshots and a structured audit log are not guaranteed by
  current Deck-facing DTOs.
- OAuth flows, force-probe-cache refresh, and quota editing are not
  exposed through `config.get` / `config.patch`.
- The list↔detail product flow obscured the actual operator task —
  inspecting and editing a config slice — by interleaving usage,
  pricing, and audit signals that the typed Gateway path could not
  back.

The current production tree keeps those signals out of the panel and
surfaces them only when (and if) follow-up proposals add them with a
real contract chain.

## Historical evidence (kept for archive lineage)

The prior `deck-go-frontend-models-prototype-parity-remediation` and
`frontend-models-real-contract-verification` changes recorded
remediation evidence against the V2 prototype. Their evidence
artifacts (`.local/models-prototype-remediation-parity-report/`,
`.local/models-remediation-mock-visual/`,
`.local/models-remediation-real-e2e-strengthened/`) reflect the V2
list↔detail surface and are not parity references for the typed
config-authority surface. They remain valid as audit lineage for the
contract-chain hardening that they introduced (e.g. SecretRef-only
`apiKey` writes, Models real E2E run-scope cleanup, mutation evidence
contract rows).

## Residual risks

- Mock prototype parity for the typed config-authority surface is
  intentionally `unreviewed` until the next reverse sign-off pass
  (designer review of the new component tree against an updated active
  prototype).
- Bounded real Gateway smoke for reversible provider/model creates and
  cleanup is recorded against task 7.6 of the source change; the BFF
  enforces run-scope cleanup, but external accounts and skill
  installations remain `skipped-safe`.
- `models.configured` runtime degradation observed in earlier real-E2E
  runs is bounded — the typed UI does not hard-block on it because
  `runtime.catalog.status` projects through detail directly.
- `deck.auth.probe` is intentionally not invoked here; probe
  semantics (cache TTL, force refresh, rate-limit) remain out of scope
  until a dedicated probe runner change ships.

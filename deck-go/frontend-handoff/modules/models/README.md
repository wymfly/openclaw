# models — high-fidelity handoff

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**Reference prior art:**

- [`./prototype-v1-codex.html`](./prototype-v1-codex.html) — V1 Codex single-file (kept as labeled reference; do not implement against it).
- [`./prototype-v2-list-detail.html`](./prototype-v2-list-detail.html) — V2 list↔detail prototype shell that wires the historical multi-file Babel-standalone bundle. Kept as labeled reference for the earlier "Limits / Pricing / Usage / Auth / Audit" tab line of thinking; do not implement against it.
- `./app.jsx` / `./list-view.jsx` / `./detail-view.jsx` / `./dialogs.jsx` / `./data.js` / `./icons.jsx` / `./styles.css` / `./tokens.css` / `./tweaks-panel.jsx` — V2 multi-file prototype assets loaded by `prototype-v2-list-detail.html`; kept as labeled reference. The current Models module no longer implements that line; see "Why the prototype line of thinking shifted" below.

This handoff covers the Models config control plane that aligns deck-go with
OpenClaw config truth (`src/config/types.models.ts` /
`src/config/zod-schema.core.ts`). The production module is a typed
config-authority workbench, not a usage/audit dashboard.

## What this module does

`models/` is the deck-go workbench for the OpenClaw `models?: ModelsConfig`
slice of `openclaw.json`. Operators use it to:

- Inspect runtime-configured providers/models grouped under a single source
  of truth (`models.config.detail`).
- Add or edit a provider — provider id/name, baseUrl, api/auth enums,
  injectNumCtxForOpenAICompat, `apiKey` SecretInput (SecretRef-only writes),
  provider headers, and advanced (`request`, `compat`) summaries.
- Add or edit a model under a provider — model id/name, API inherit/override,
  reasoning, input modalities, capacity caps (contextWindow, maxOutputTokens,
  maxThinkingTokens, customMaxTokens), cost (`tokenCostPerKilo`,
  `tokenCostInputPerKilo`, `tokenCostOutputPerKilo`), per-model headers, and
  advanced compat summary.
- Preview the impact of deleting a provider/model or switching catalog mode
  before committing destructive intent (impact token + service-side rescan +
  type-to-confirm).
- Switch between catalog modes `merge | replace` with a dry-run preview before
  the commit step.
- Drop into the advanced raw editor as an explicit escape hatch when the
  typed UI cannot represent a desired config shape.

The design **does not** include a usage/audit dashboard, a probe runner, an
OAuth runner, a secret-store CRUD surface, a quota/rate-limit editor, or a
"force probe cache refresh" — those are tracked as out-of-scope follow-ups.
Pricing snapshots and PATCH audit projections that the V2 prototype had are
intentionally not part of the current module surface.

## Visual target

```sh
cd deck-go/frontend-handoff/modules/models
python3 -m http.server 8898
# → http://localhost:8898/
```

## Files

| File                                                                                                                                         | Role                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `prototype.html`                                                                                                                             | Active visual target — typed config-authority workbench (self-contained).                                       |
| `prototype-v1-codex.html`                                                                                                                    | Historical V1 reference; kept as labeled artifact.                                                              |
| `prototype-v2-list-detail.html`                                                                                                              | Historical V2 list↔detail shell that loads the V2 multi-file bundle; kept as labeled artifact.                  |
| `app.jsx` / `list-view.jsx` / `detail-view.jsx` / `dialogs.jsx` / `data.js` / `icons.jsx` / `styles.css` / `tokens.css` / `tweaks-panel.jsx` | Historical V2 multi-file prototype assets loaded by `prototype-v2-list-detail.html`; kept as labeled reference. |
| `README.md` / `components.md` / `states.md` / `interactions.md` / `api-usage.md` / `implementation-notes.md`                                 | Handoff docs (this set).                                                                                        |

## Contract truth

Production and mocks must use the typed Models contract chain rather than ad
hoc raw-config shapes:

- Config detail: `DeckGoModelsConfigDetailResponse`
  (`detail.providers[]`, `detail.models[]`, `detail.references[]`,
  `detail.runtime`).
- Provider record: `DeckGoModelProviderDetail`
  (id, name, baseUrl, api, authMode, secretStatus, providerHeaders,
  injectNumCtxForOpenAICompat, request, compat, advancedSummary).
- Model record: `DeckGoModelDetail`
  (id, name, providerId, api?, reasoning?, modalities?, capacity, cost,
  headers, compatSummary, references).
- Impact preview: `DeckGoModelImpactPreview`
  (`scope`, `severity`, `references[]`, `impactToken`, `generatedAt`,
  `baseHash`).
- Typed mutations: `DeckGoModelProviderUpsertRequest`,
  `DeckGoModelDeletePreviewRequest`, `DeckGoModelDeleteRequest`,
  `DeckGoModelUpsertRequest`, `DeckGoModelDeletePreviewRequest` (model),
  `DeckGoModelDeleteRequest` (model), `DeckGoSetModelsCatalogModeRequest`.
- Sensitive fields are surfaced through `DeckGoModelSecretInputStatus`
  (`missing | empty | ref | literal-redacted`); literal secret values are
  never returned to the browser.
- Raw config payload: `DeckGoModelsConfigResponse` /
  `DeckGoConfigApplyResponse` — kept available **only** for the advanced
  raw editor escape hatch.

Runtime read surfaces still in use:

- `models.configured` (rolled up under `runtime.catalog`).
- `models.catalog.providers` (drives Add Provider wizard).
- `deck.auth.overview` (rolled up under `runtime.auth`).
- `deck.auth.probe` is **not** invoked by this module — probe is out of scope
  in the typed UI.

## Depends on canonical atoms

`Badge`, `Banner`, `Button`, `Chip`, `Drawer`, `Input`, `Modal`, `Select`,
`Spinner`, `Tab`, `Toggle`. Toggle requires `onCheckedChange` + `aria-label`
per atom contract; Spinner requires `aria-label`. Local molecules:

- catalog header (mode badge + counts + runtime status).
- provider section header + collapse control.
- provider/model row badges.
- secret input field (radio: preserve / set-ref / clear, ref + refTemplate inputs).
- impact preview reference list.
- typed-confirm dialog body.

## Depends on canonical icons

Icons re-exported from `@/design-system/icons` (lucide-react). The current
module is light on bespoke icons; primary affordances are textual
buttons + Badges to keep the config-authority surface unambiguous.

## Depends on canonical patterns

The orchestrator composes existing atoms directly; no module-specific
pattern is required. Future Add Provider wizard reuse across other config
modules may motivate a `WizardShell` proposal but is not in scope here.

## Workflow constraints

- Code truth (`src/config/types.models.ts` + zod schema +
  `contracts/source/deck-api.contract.ts`) wins over this handoff when the
  two disagree.
- Typed BFF actions are the default save path. Raw `PATCH /models/config` is
  reserved for the advanced editor.
- SecretInput writes never carry a literal secret value; only `SecretRef`
  values cross the wire. Existing literals are surfaced as `literal-redacted`
  in `secretStatus` and clearable via the `clear` action.
- Delete and mode-replace flows MUST go through impact preview → impact
  token → type-to-confirm. Stale preview tokens are rejected by the BFF.
- Base-hash conflicts surface as `DataFabricError` `kind: "conflict"` and
  refresh the underlying detail before the user retries.
- This change does not claim audit, rollback, secret-store CRUD, OAuth
  flows, quota, or rate-limit semantics.

## How to implement

1. Open the active `prototype.html` (served via `http.server`) and walk
   through the catalog header, provider list, provider drawer, model drawer,
   Add Provider wizard, Impact preview dialog, and type-to-confirm dialog.
2. Read `components.md` (component tree + props shapes for the typed flow).
3. Read `states.md` (orchestrator state machines + edge cases).
4. Read `interactions.md` (keyboard / a11y / pointer / loading / errors).
5. Read `api-usage.md` (typed BFF actions, request/response shapes,
   conflict and stale-preview handling).
6. Translate into `frontend-new/src/components/panels/models/` preserving
   the typed mutation routing, `expectedBaseHash` flow, SecretRef-only
   writes, impact-preview gating, and advanced-raw escape boundary.
7. Extract literal text into `i18n/{en,zh}.json` per protocol.
8. Add focused component tests covering list rendering, drawers, wizard,
   typed mutation routing, conflict propagation, SecretRef construction,
   delete preview-then-commit, and advanced raw fallback isolation.

## Why the prototype line of thinking shifted

The historical V2 prototype (kept on disk under labeled file names) modeled
Models as a list↔detail product with Limits/Pricing/Usage/Auth/Audit tabs,
including a usage/cost dashboard and a per-model audit history. After
auditing OpenClaw config truth and Gateway capabilities, the typed product
surface narrowed to config authority because pricing snapshots, PATCH audit
history, OAuth flows, force probe cache refresh, and quota editing are not
guaranteed by the current Deck-facing DTOs. The current production tree
keeps those out of the panel and surfaces them only when (and if) follow-up
proposals add them with a real contract chain.

## Out-of-scope follow-ups

Tracked under `openspec/follow-ups/`:

- Model-default editing UI surface (config detail currently exposes default
  references read-only; a dedicated default editor is deferred).
- Rate-limit / per-model schema additions (`rateLimit`, advanced cost
  layouts).
- OAuth runner UX (browser-driven OAuth round trip).
- Secret-store CRUD UI (centralized `SecretRef` registry beyond SecretInput
  field-level writes).
- Provider/model search and filter at the list level (deferred — list
  grouping is the primary disambiguator until provider count grows).
- Bedrock / OpenAI-compat dynamic provider quirks beyond
  `injectNumCtxForOpenAICompat`.
- Force probe cache refresh / probe runner UX.

## Reverse sign-off

| Field                          | Value                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `needs-revision`                                                                                                              |
| Reviewer                       | Codex                                                                                                                         |
| Date                           | 2026-05-06                                                                                                                    |
| Prototype reference            | `frontend-handoff/modules/models/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/models/` (orchestrator + parts/ + drawers/ + wizard/ + dialogs/ + lib/)                   |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`models`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`models`, `mock-prototype-parity`, verdict: `unreviewed`)             |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`models`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/models/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. The
`mock-prototype-parity` verdict is intentionally retained as `unreviewed`
because the typed config-authority surface materially diverges from the
historical V2 list↔detail prototype; a fresh prototype-parity pass is part
of the next reverse sign-off cycle.

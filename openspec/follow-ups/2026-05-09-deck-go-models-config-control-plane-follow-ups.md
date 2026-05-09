# Follow-ups — deck-go-models-config-control-plane

Source change: `openspec/changes/deck-go-models-config-control-plane/`.

The typed config-authority workbench landed without claiming audit,
rollback, secret-store CRUD, OAuth runner, quota, or rate-limit
behavior. This file tracks the items that were intentionally deferred
and the implementation-discovered gaps that surfaced during the work.

## FU-001: Model default editing UI

- **Status**: candidate
- **Source**: `deck-go-models-config-control-plane` task 6.4; design.md
  scope notes.
- **Classification**: next-openspec
- **Fact baseline**: `DeckGoModelsConfigDetail.references` surfaces
  default-role assignments read-only (see
  `frontend-new/src/components/panels/models/lib/models-selectors.ts`
  `modelDefaultRoles`). The current panel does not expose an editor for
  `agents.<id>.defaultModel`, channel default, hook default, or runtime
  default. Operators must use the advanced raw editor to change a
  default reference today.
- **Why not now**: Default editing crosses module boundaries (agents,
  channels, hooks, runtime). Modeling the UX requires deciding where
  the edit surface lives — inside Models, inside the owning module, or
  in a global Settings surface. That decision was explicitly out of
  scope for this change to keep Models config-authority focused.
- **Suggested next step**: Brainstorm the cross-module default editing
  UX (likely a small OpenSpec change with a design document covering
  agents/channels/hooks/runtime default ownership).
- **Acceptance hints**: Each owning module must remain the primary
  editor of its own default; Models can surface a read-only mirror plus
  a "jump to owner" affordance.
- **Links**: `openspec/changes/deck-go-models-config-control-plane/design.md`,
  `frontend-new/src/components/panels/models/lib/models-selectors.ts`.

## FU-002: Rate-limit and richer cost schema

- **Status**: candidate
- **Source**: `deck-go-models-config-control-plane` task 6.4.
- **Classification**: next-openspec
- **Fact baseline**: OpenClaw `ModelConfig` currently exposes
  `tokenCostPerKilo`, `tokenCostInputPerKilo`, and
  `tokenCostOutputPerKilo`; there is no `rateLimit` field and no
  cached-vs-uncached input pricing. The drawer reflects only the
  current schema fields.
- **Why not now**: Adding fields requires an OpenClaw config schema
  change (`src/config/types.models.ts` + `src/config/zod-schema.core.ts`
  - `src/config/schema.help.ts`) plus contract chain regeneration. That
    is a coordinated upstream change, not a deck-go follow-up.
- **Suggested next step**: Open an OpenClaw schema discussion before
  the deck-go drawer can surface the new fields.
- **Acceptance hints**: New fields must round-trip through
  `config.get` / `config.patch` and the typed BFF upsert handler before
  the drawer adds inputs.
- **Links**: `src/config/types.models.ts`,
  `src/config/zod-schema.core.ts`.

## FU-003: OAuth runner UX

- **Status**: candidate
- **Source**: `deck-go-models-config-control-plane` task 6.4; design.md
  out-of-scope list.
- **Classification**: next-openspec
- **Fact baseline**: Provider auth modes already include `oauth` (see
  `MODEL_APIS` / `ModelProviderAuthMode`). The typed UI surfaces auth
  mode but does not run an OAuth round trip; operators configure OAuth
  credentials through the SecretInput field by setting a SecretRef.
- **Why not now**: OAuth runners require browser-side redirect
  handling, callback routing through the deck-go BFF, and a
  per-provider OAuth profile registry. None of these exist today.
- **Suggested next step**: Separate OpenSpec change for an OAuth
  runner experience, including BFF callback routes and
  provider-specific profile metadata.
- **Acceptance hints**: OAuth runner must not bypass the SecretRef
  rule — completed OAuth flows write a SecretRef into the relevant
  `apiKey` field, never a literal token.
- **Links**: `src/config/types.models.ts` (auth mode list),
  `frontend-new/src/components/panels/models/drawers/SecretInputField.tsx`.

## FU-004: Secret-store CRUD UI

- **Status**: candidate
- **Source**: `deck-go-models-config-control-plane` task 6.4.
- **Classification**: next-openspec
- **Fact baseline**: `SecretInputField` writes a `SecretRef` (e.g.
  `deck.secrets.anthropic.apiKey`) but does not currently expose CRUD
  for the underlying secret store. The deck-go BFF normalizes refs to
  the underlying store; central CRUD is operator-managed elsewhere.
- **Why not now**: A SecretRef registry is a separate platform
  capability. Mixing it into Models would conflate config authority
  with secret-store ownership.
- **Suggested next step**: Standalone OpenSpec change for a Secrets
  module (`/secrets/*` BFF + dedicated panel).
- **Acceptance hints**: Models must continue to consume opaque
  SecretRef strings; the secrets panel manages literal values once and
  exposes only the ref name to other modules.

## FU-005: Probe runner UX

- **Status**: candidate
- **Source**: implementation-discovered gap (the typed UI does not call
  `deck.auth.probe`).
- **Classification**: next-openspec
- **Fact baseline**: `deck.auth.probe` is wired through the deck-go
  contract chain but the typed Models surface does not invoke it. The
  V2 prototype bundle had a probe dialog; the typed panel intentionally
  omits probe to avoid implying cache TTL / force-refresh semantics
  that the wrapper does not guarantee.
- **Why not now**: Probe semantics (provider call cost, rate-limit
  exposure, cache TTL behavior, force-refresh contract) need an
  explicit decision before a runner UX ships.
- **Suggested next step**: Small OpenSpec change to define probe
  semantics + a probe runner UX (likely surfaced inside the provider
  drawer's identity tab).
- **Acceptance hints**: Probe must not call upstream providers
  silently in CI; tests must use bounded fixtures that fail closed when
  upstream is unreachable.
- **Links**: `frontend-handoff/modules/models/api-usage.md`
  (probe explicitly out of scope),
  `deck-go/frontend-new/src/api.ts`
  (`probeRuntimeModelAuth` wrapper exists for the runtime path but is
  not consumed by the typed Models panel).

## FU-006: Provider/model search and filter at list level

- **Status**: candidate
- **Source**: implementation-discovered gap (`tasks.md` 5.3 deferred
  search/filter).
- **Classification**: backlog
- **Fact baseline**: The typed list groups by provider with
  collapsible sections and badges. There is no module-level search
  input or filter chip set.
- **Why not now**: Provider count is small in current configurations;
  grouping is the primary disambiguator. Adding search prematurely
  would crowd the catalog header.
- **Suggested next step**: Revisit when at least one configuration
  exceeds ~10 providers or ~50 models, or when an operator complaint
  surfaces.
- **Acceptance hints**: Search must remain client-side over the
  already-loaded `DeckGoModelsConfigDetail`; do not introduce a server
  search parameter.

## FU-007: Bedrock / OpenAI-compat dynamic provider quirks

- **Status**: candidate
- **Source**: implementation-discovered gap.
- **Classification**: backlog
- **Fact baseline**: `injectNumCtxForOpenAICompat` is the only
  dynamic-quirk knob currently surfaced in the provider drawer. Bedrock
  endpoint selection (region, runtime profile) and OpenAI-compat dialect
  switches (e.g. base64 image transport) are surfaced only via
  `request` / `compat` summaries and are read-only.
- **Why not now**: Each quirk requires its own contract entry and
  schema discussion; lumping them under a generic "advanced" editor
  would re-create the V1 raw-config UX problem.
- **Suggested next step**: Itemize the most common operator-visible
  quirks (Bedrock region, AWS profile, num_ctx) and decide which
  deserve typed surfaces vs. remain raw-only.

## FU-008: Catalog `authType` permissive value handling

- **Status**: candidate
- **Source**: implementation-discovered gap (tasks.md 5.6).
- **Classification**: backlog
- **Fact baseline**: `DeckGoCatalogProvider.authType` is a permissive
  string from the Gateway. The wizard validates it against
  `AUTH_MODES = ["api-key", "aws-sdk", "oauth", "token"]` and resolves
  unknown values to `api-key` so the configure step can render. There
  is no telemetry on how often the catalog returns unknown values.
- **Why not now**: The current behavior is safe (operator can correct
  the auth mode in the configure step), but silent normalization is a
  visibility gap.
- **Suggested next step**: Either tighten the catalog projection at
  the Gateway boundary or add a small wizard banner that surfaces the
  unknown value to the operator.
- **Acceptance hints**: Tighten without breaking the existing
  `models.catalog.providers` consumers; the wizard should not crash
  when receiving an unknown value.

## FU-009: Pricing snapshots and PATCH audit history (V2 leftovers)

- **Status**: explicitly-deferred
- **Source**: V2 prototype line-of-thinking.
- **Classification**: backlog
- **Fact baseline**: The V2 list↔detail prototype modeled per-model
  pricing snapshots and PATCH audit history. Neither is guaranteed by
  current Deck-facing DTOs. The typed config-authority panel
  intentionally omits both.
- **Why not now**: Adding either requires real contract chains
  (pricing snapshot service, PATCH audit projection). Both are
  cross-module concerns and probably deserve their own modules
  (pricing in a usage/cost surface; audit in a global audit log
  surface).
- **Suggested next step**: Wait for the next operator request that
  cannot be satisfied by external invoices / external audit logs;
  then open a dedicated change.
- **Acceptance hints**: Pricing must clearly attribute the source
  (vendor invoice, snapshot date) and never claim authoritative
  invoice equivalence; audit must include actor, before, after, and
  base-hash chain.

## Promotion notes

When any of the items above are promoted to a real OpenSpec change,
update its `Status` to `promoted` and link the new change here.

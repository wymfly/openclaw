## Context

OpenClaw's source-of-truth model configuration is `openclaw.json`:
`src/config/types.models.ts` defines `models.mode` and
`models.providers`, while generated schema help describes `merge` as overlaying
custom providers onto built-ins and `replace` as using only configured
providers. Runtime model assets are assembled from authored config plus implicit
provider catalogs in `src/agents/models-config.plan.ts`,
`src/agents/models-config.ts`,
`src/agents/models-config.providers.implicit.ts`, and
`src/agents/model-catalog.ts`.

Deck-go already has typed Models BFF routes for config detail, provider/model
upsert, provider/model delete preview/commit, and mode set. The current
frontend, however, still exposes catalog mode as a primary product control and
uses copy such as "Use built-in catalog" / "Configured assets only". That is
truthful as a raw implementation concept but not the desired control-plane
product model.

The current Add Provider wizard also contains a concrete bug:
`AddProviderWizard.pickCustom()` only updates draft state to
`source: "custom"`. It does not advance to the configuration step and does not
render a visible selected state, so clicking the custom provider option appears
to do nothing.

## Goals / Non-Goals

**Goals:**

- Make Models feel like a provider/model asset control plane instead of a raw
  config primitive editor.
- Treat built-in providers as read-only templates that can be configured into
  authored `models.providers.<id>` entries.
- Treat custom providers and custom models as authored config assets written via
  typed deck-go BFF actions.
- Preserve OpenClaw truth for `models.mode` without making raw `merge` /
  `replace` the normal operator workflow.
- Fix and verify the custom-provider onboarding no-op.
- Keep mock visual/interaction evidence and real-safe Gateway evidence separate.

**Non-Goals:**

- Adding new upstream OpenClaw RPC methods or changing OpenClaw model schema.
- Editing built-in provider catalog files from the deck-go product UI.
- Moving agent default/fallback model-policy editing into Models.
- Adding unsupported quota, rate-limit, OAuth-runner, pricing-cache, or audit
  history fields.
- Removing advanced/raw config escape hatches where they are already supported.

## Decisions

### Decision: Normal page groups configured providers with their models

The main Models page SHALL show authored configured providers from
`openclaw.json` and the models nested under each provider. This matches the
actual write surface: providers own credentials/API/base URL, and models are
configured under a provider. Provider Library templates remain available, but
only as copyable starting points inside the Add Provider wizard.

Rejected: Move configured providers into a right-side provider-management panel.
That duplicates the main page's correct provider/model structure and adds an
unnecessary second management surface.

Rejected: Show provider templates as primary page content. That overweights
setup mechanics and can imply that built-in catalog entries are installed or
writable assets.

### Decision: Provider Library is a read-only copy-template surface

The UI SHALL distinguish provider templates discovered from OpenClaw's implicit
catalog from configured providers authored in `openclaw.json`. A template can be
copied as the starting point for a configured provider, including default model
selection, but it is not itself a writable asset until the operator saves a
provider entry through the typed provider upsert route.

Rejected: Let the product imply that built-in catalog providers are installed,
uninstalled, or edited in place. OpenClaw uses the built-in/implicit catalog as
runtime input; operator-owned changes belong in `openclaw.json`.

### Decision: Normal product UI hides raw mode switching

`models.mode` remains real contract truth, and advanced UI must not lie about an
existing `replace` configuration. For ordinary onboarding and asset management,
however, the product model is "configure providers from the library" plus
"author custom providers/models". Raw `merge` / `replace` labels MAY appear only
as secondary technical detail, advanced copy, or diagnostics.

Rejected: Keep `merge` / `replace` as the main Models header action. That makes
operators choose an OpenClaw resolution primitive before they understand the
asset they are trying to configure.

### Decision: Custom provider flow must be visibly stateful

Clicking the blank custom-provider option SHALL immediately open the
configuration step or render an unmistakable selected state with the provider
id/base URL/auth fields visible or one explicit next action away. Selecting any
provider template SHALL also enter the same configuration step with copied API,
base URL, auth, and default model choices that the operator may edit before
save. Tests SHALL fail if either action only mutates hidden draft state.

Rejected: Require the operator to click a hidden or non-obvious "Next" after a
custom choice with no visual feedback. That is the current bug.

### Decision: Custom model writes require an authored provider target

Custom models SHALL be written under a configured provider's `models` array. If
the operator starts from a built-in provider template that has not yet been
configured, the UI SHALL first create or update the authored provider entry, then
write the model. It SHALL NOT mutate the built-in catalog or suggest that a
template-only provider stores user-authored models.

Rejected: Add custom models to frontend-only state or implicit catalog data. That
would diverge from OpenClaw config truth and fail real Gateway validation.

### Decision: Product collision choices replace raw merge/replace language

When the operator configures a provider id that already exists, the UI SHALL
offer product choices such as edit existing, choose another id, or replace/update
the configured provider after impact awareness. It SHALL NOT expose a naked
"merge versus replace" decision as if those OpenClaw mode primitives were the
business action.

Rejected: Surface OpenClaw mode selection as the collision resolver. Provider id
collision is an authored-asset workflow; catalog mode is a broader resolution
policy.

## Risks / Trade-offs

- Existing `replace` configs still need truthful representation -> show a
  strict-configured-only/advanced state and require impact-aware advanced actions
  before changing it.
- Provider catalog data may not include enough display metadata for perfect
  cards -> use existing DTO truth first, degrade copy explicitly, and avoid
  inventing unsupported fields.
- Custom model flow can blur provider configuration and model editing -> keep
  the save path explicit: provider must be authored before model entries are
  written.
- Real Gateway E2E can be environment-sensitive -> use isolated run-scoped
  provider/model ids, clean up through typed routes, and record circuit-breaker
  evidence if startup or external environment blocks the smoke.
- Older handoff/prototype assets may show raw mode controls -> update or annotate
  them when touched so the implemented product IA is not contradicted by stale
  artifacts.

## Migration Plan

1. Re-read OpenClaw model config/catalog code and current deck-go Models BFF,
   contract, Data Fabric, and frontend code before implementation.
2. Audit whether existing DTOs already expose enough source/configured/template
   status; add contract fields only if current generated data cannot represent
   the product states truthfully.
3. Rework Models UI information architecture so the main page stays a configured
   provider/model workbench, while Provider Library templates are used only in
   the Add Provider wizard.
4. Fix the custom-provider wizard path, support template-copy provider creation
   with selectable default models, and add regression coverage.
5. Add custom-model and configured-provider tests that prove writes target
   authored `models.providers` entries.
6. Run strict OpenSpec validation, focused backend/frontend tests, mock E2E, and
   real-safe Gateway smoke.

Rollback strategy: because this change should preserve the existing typed BFF
routes, rollback can disable the new Provider Library UI affordances and fall
back to existing provider/model CRUD and raw advanced config editing. Do not
delete support for existing `replace` configs during rollback.

## Open Questions

No product decision is required before implementation. If implementation shows
that current DTOs cannot distinguish catalog templates from configured providers
without contract changes, update the deck-go contract source and generated files
inside this change. If OpenClaw itself cannot support a proposed write safely,
record that item as a follow-up rather than simulating it in frontend state.

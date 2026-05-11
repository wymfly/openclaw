## Why

The Models module is still too close to OpenClaw implementation primitives.
OpenClaw supports built-in or implicit provider catalogs, user-authored
`openclaw.json` provider configuration, custom providers, and provider-owned
model lists. Operators, however, should not need to reason about raw
`models.mode = merge | replace` as the main product decision.

The desired product model is simpler:

- built-in provider templates are available to configure;
- configured providers are the assets written to `openclaw.json`;
- custom providers and custom models are authored by the operator;
- destructive or conflicting operations are guarded by typed BFF impact checks.

There is also a current UI bug: clicking "Use custom provider" in the Add
Provider wizard changes internal draft state but does not visibly advance or
select the custom-provider configuration path, so the action appears to do
nothing. This change makes that bug part of the productization scope.

## What Changes

- Reframe the Models page around configured providers and their nested models as
  the primary surface. Provider Library templates are not a separate main-page
  or right-panel module; they are copyable starting points inside the Add
  Provider wizard.
- Treat OpenClaw `models.mode` as a low-level catalog/config resolution policy:
  normal product UI should not make raw `merge` / `replace` the primary
  operator choice, while existing `replace` configs must still be represented
  truthfully as an advanced or degraded state.
- Make built-in provider templates copyable starting points for custom or
  configured providers, including selectable template default models, while all
  writes still go to `openclaw.json` via typed deck-go BFF actions.
- Make custom provider onboarding directly actionable and test-covered: clicking
  the custom provider option must open or visibly select the configuration form.
- Make custom model management write configured provider model entries, including
  the case where a built-in template must first become an authored configured
  provider before custom models can be added.
- Align frontend copy, tests, mock E2E, and real-safe E2E with these product
  semantics and with OpenClaw config truth.
- Keep agent default/fallback model-policy editing out of scope for Models; that
  remains owned by the Agents redesign handoff already created by earlier
  Models work.

## Capabilities

### New Capabilities

- `deck-go-models-provider-library-productization`: Product-level provider
  library, configured provider, custom provider, and custom model workflows for
  the Models control plane.

### Modified Capabilities

- `deck-go-models-config-control-plane`: Refine catalog mode and provider/model
  lifecycle requirements so normal UI uses product semantics while preserving
  OpenClaw config truth and typed BFF writes.
- `deck-go-models-providers-contract-completion`: Extend completion evidence so
  visible Models product claims cover provider-library/configured-provider
  workflows, custom-provider onboarding, and custom-model writes rather than
  only raw config primitive parity.

## Impact

- OpenClaw truth sources: `src/config/types.models.ts`,
  `src/config/schema.base.generated.ts`, `src/agents/models-config.plan.ts`,
  `src/agents/models-config.ts`, `src/agents/models-config.providers.implicit.ts`,
  and `src/agents/model-catalog.ts`.
- deck-go backend/contracts: existing Models BFF typed routes in
  `deck-go/backend/internal/server/models_control.go`,
  `deck-go/backend/internal/server/models_control_helpers.go`, generated
  deck-go contracts if DTO source changes, and mutation evidence metadata where
  visible actions change.
- deck-go frontend: `deck-go/frontend-new/src/components/panels/models`,
  Models Data Fabric hooks/facades, i18n, focused component tests, and mock/real
  E2E module flows.
- Handoff/prototype: `deck-go/frontend-handoff/modules/models` if product IA or
  screenshots must be updated to match the implemented Provider Library model.
- This change should not add new upstream OpenClaw RPC methods. If implementation
  reveals missing upstream capability, record it as a follow-up instead of
  simulating unsupported behavior.

## Why

The Models control plane currently exposes some OpenClaw implementation primitives directly to operators (`merge` / `replace`, "preview delete") while hiding or only partially projecting the model-usage truth that operators actually need to reason about, especially default model and fallback-chain references. This change tightens the Models page into a product-safe model asset surface: it shows what model configuration means, repairs usage/default/fallback projection gaps, and records the model-strategy editing work that belongs in the upcoming Agents redesign instead of forcing it into Models.

## What Changes

- Reframe Models UI copy and interaction semantics from raw OpenClaw primitives to product language: "catalog mode" becomes an advanced sync policy, destructive "preview delete" becomes an impact-check step inside delete flows, and provider-id collisions become user choices such as edit existing, rename, or replace with impact awareness.
- Repair the Models BFF reference projection so it understands OpenClaw model references represented as either strings or `{ primary, fallbacks }`, including fallback references where OpenClaw config supports them.
- Make Models display default/fallback/usage truth across agents, agent defaults, subagents, channels, hooks, tools, and sessions as read-only impact/usage information with clear owner-module links.
- Keep normal provider/model config CRUD in Models, but keep primary editing authority for agent model strategy in the Agents module.
- Update frontend handoff notes, implementation notes, and follow-up records so the upcoming Agents redesign receives a concrete model-policy handoff for `agents.defaults.model`, per-agent primary/fallback, and subagent model defaults.
- Preserve the advanced raw editor as an escape hatch without treating raw config primitives as the primary product UX.

## Capabilities

### New Capabilities

- `deck-go-models-product-semantics-convergence`: Product semantics and usage-projection rules for the Models control plane, including product-safe copy, usage/default/fallback display, and Agents handoff boundaries.

### Modified Capabilities

- `deck-go-models-config-control-plane`: Extend Models config detail/reference projection requirements to cover OpenClaw `AgentModelConfig` object shapes and fallback references instead of only simple model strings.
- `deck-go-models-providers-contract-completion`: Extend Models completion requirements so visible Models workflows distinguish asset editing, usage inspection, and owner-module editing boundaries.

## Impact

- OpenClaw truth sources: `src/config/types.models.ts`, `src/config/types.agents-shared.ts`, `src/config/types.agent-defaults.ts`, `src/config/types.agents.ts`, Gateway config read/write behavior, and generated Gateway agent/model DTOs.
- deck-go contracts and backend: `deck-go/contracts/source/deck-api.contract.ts`, generated TS/Go artifacts if DTOs change, `deck-go/backend/internal/server/model_reference_index.go`, `deck-go/backend/internal/server/models_control_helpers.go`, Models control handlers/tests, and mutation evidence metadata where visible behavior changes.
- deck-go frontend: `deck-go/frontend-new/src/components/panels/models`, Models data hooks/mocks/tests, i18n, visual/mock E2E, and product copy.
- Handoff/follow-up: `deck-go/frontend-handoff/modules/models` and `openspec/follow-ups/`, especially a handoff for the future Agents module redesign.
- This change should not introduce new dependencies or new upstream Gateway RPC methods. If implementation reveals that true model-policy editing needs new upstream schema/RPC behavior, record it as a follow-up rather than simulating support.

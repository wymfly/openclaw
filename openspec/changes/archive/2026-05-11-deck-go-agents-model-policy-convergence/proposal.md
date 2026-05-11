## Why

Models has been converged into a typed provider/model asset editor and no longer exposes a raw JSON escape hatch for usage policy. Agents must now own the product editing surface for OpenClaw model policy, otherwise operators can see text/image/PDF/media/subagent defaults but cannot safely edit the `agents.defaults.*` and per-agent model configuration that actually drives runtime behavior.

## What Changes

- Add an Agents-owned model policy control surface that distinguishes model assets from model usage policy.
- Extend the Deck-facing Agents contract chain so model policies can represent OpenClaw `AgentModelConfig = string | { primary?: string; fallbacks?: string[] }`, not only `model?: string`.
- Add product DTOs and write paths for:
  - global role defaults from `agents.defaults.model`, `imageModel`, `imageGenerationModel`, `videoGenerationModel`, `musicGenerationModel`, `pdfModel`, summary/compaction/memory-search/subagent model fields where current OpenClaw config truth supports them;
  - per-agent model policy from `agents.list[].model`;
  - per-agent subagent model policy from `agents.list[].subagents.model`.
- Productize model policy editing in Agents:
  - inherit/default versus explicit override;
  - primary model picker from configured model assets;
  - ordered fallback chain editor;
  - unavailable/deleted model reference display;
  - guarded edits for `main` and other high-impact runtime changes;
  - links back to Models when provider/model assets must be added or repaired.
- Keep Models as the provider/model asset owner and remove any dependency on Models raw editing for policy fields.
- Add mock, focused, contract, backend, and bounded real Gateway verification for safe policy read/write behavior.

## Capabilities

### New Capabilities

- `deck-go-agents-model-policy-convergence`: Agents-owned product model-policy editing, including global role defaults, per-agent primary/fallback policy, subagent model policy, inheritance, unavailable references, guarded saves, and mock/real verification.

### Modified Capabilities

- `deck-go-models-product-contract-completion`: The Models handoff for Agents model-policy editing is promoted into this concrete Agents change; Models remains read-only for usage policy and must not reintroduce raw policy editing.

## Impact

- **OpenClaw source truth**: `src/config/types.agents.ts`, `src/config/types.agent-defaults.ts`, `src/config/types.agents-shared.ts`, `src/config/zod-schema.agent-model.ts`, `src/gateway/protocol/schema/agents-models-skills.ts`, `src/gateway/protocol/schema/deck.ts`, and deck agents server-methods.
- **Deck contracts**: `deck-go/contracts/source/deck-api.contract.ts`, endpoint/mutation metadata where new BFF actions are added, generated TS/Go DTOs, route governance, and mutation evidence docs.
- **Go BFF/runtime**: `deck-go/backend/internal/server/inventory.go`, `deck-go/backend/internal/runtime/openclaw/gateway_queries.go`, generated Gateway bindings, and backend tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, Data Fabric agents queries/mutations, Agents panel state and UI, model picker/fallback editor components, i18n, and focused tests.
- **Design handoff and docs**: `deck-go/frontend-handoff/modules/agents/` notes and `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md`.
- **Verification**: OpenSpec strict validation, contract generation/checks, Go tests, frontend tests/build, Agents mock E2E, and bounded real Gateway E2E against isolated config/workspace fixtures.
- **Dependencies**: no new runtime dependency is planned.

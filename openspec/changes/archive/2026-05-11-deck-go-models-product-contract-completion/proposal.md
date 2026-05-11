## Why

The Models module still exposes an "advanced raw editor" as the practical escape hatch for unsupported fields, while the product goal is to translate OpenClaw model configuration and model-usage policy into clear typed control-plane concepts. This causes operators to see raw implementation details instead of a stable product boundary before we move into the Agents redesign.

## What Changes

- Remove the Models-page raw editor entry point from normal product UI. Models must use typed BFF mutations for provider/model asset edits and must not tell operators to use raw JSON as the fallback for unproductized fields.
- Make model capability language explicit: `models.providers.*.models[].input` is only the model asset input capability set (`text` / `image`) supported by OpenClaw config today.
- Add a product-level model-usage policy overview in Models using the already projected `DeckGoModelsConfigDetail.defaults` and reference metadata. Role defaults such as PDF, summary, compaction, memory search, image generation, video generation, music generation, and subagents are displayed as usage-policy facts, not as model input modalities.
- Keep model-policy editing out of Models. Editing `agents.defaults.*`, per-agent primary/fallback chains, and subagent model policy is explicitly handed off to the upcoming Agents module convergence.
- Reword provider/model drawer advanced summaries so unsupported typed leaves are shown as read-only technical summaries or follow-up candidates, not as "open the raw editor" instructions.
- Update handoff/follow-up records, focused tests, mock E2E, real-safe E2E, and OpenSpec validation evidence for the new boundary.

## Capabilities

### New Capabilities

- `deck-go-models-product-contract-completion`: Final Models product-contract boundary covering typed-only product UI, model capability semantics, read-only model-usage policy visibility, and Agents policy-editing handoff.

### Modified Capabilities

- `deck-go-models-config-control-plane`: The Models control plane no longer accepts raw JSON editing as part of its normal product acceptance path; unsupported fields must be represented as typed/read-only summaries or explicit follow-ups.
- `deck-go-models-providers-contract-completion`: Provider/model asset workflows must explain configured assets, model input capabilities, and technical read-only leaves without implying built-in catalog mutation or raw config fallback.

## Impact

- OpenClaw truth sources: `src/config/types.models.ts`, `src/config/zod-schema.core.ts`, `src/config/types.agent-defaults.ts`, `src/config/types.agents-shared.ts`, and the model reference projection behavior under `deck-go/backend/internal/server/model_reference_index.go`.
- deck-go contracts/back end: existing `DeckGoModelsConfigDetail.defaults`, model reference roles, and typed Models BFF routes. New DTO fields are not expected unless implementation proves the existing projection cannot express the policy overview.
- deck-go frontend: `deck-go/frontend-new/src/components/panels/models`, Models i18n, component tests, mock visual/E2E, and read-only usage-policy rendering.
- Handoff/follow-up: `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` and `deck-go/frontend-handoff/modules/models` must reflect that Agents owns model strategy editing.
- This change must not add new upstream Gateway RPCs, new dependencies, or a generic raw config editor replacement inside Models.

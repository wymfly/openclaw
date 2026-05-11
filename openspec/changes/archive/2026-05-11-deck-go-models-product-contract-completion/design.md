## Context

OpenClaw separates model assets from model usage policy.

- Model assets live under `models.providers.<providerId>` and `models.providers.<providerId>.models[]`. Current OpenClaw config truth exposes model input capabilities as `text` and `image` only.
- Model usage policy lives under `agents.defaults.*`, `agents.list[].model`, `agents.defaults.subagents.model`, and related fields. Deck-go already projects many of those references into `DeckGoModelsConfigDetail.defaults`, model `defaultRoles`, `usageRelations`, and `usageRoles`.
- The current Models frontend still exposes a raw editor and copy such as "use Advanced raw" for unsupported leaves. That contradicts the desired product contract: Models should be a typed provider/model asset workbench, not a JSON editor.

The previous Models changes intentionally left raw editing in place to lower migration risk. This change updates that decision: unsupported typed leaves must be summarized, guarded, or handed off, not used to keep the product surface dependent on raw config editing.

## Goals / Non-Goals

**Goals:**

- Remove the Models raw editor entry point and any normal UI copy that points operators to raw JSON as the way to complete Models workflows.
- Keep provider/model asset editing typed through existing BFF mutations.
- Add a concise usage-policy overview that displays role defaults from `DeckGoModelsConfigDetail.defaults`, with primary/fallback/model state when present.
- Preserve the distinction between model input capabilities (`text`, `image`) and model role/default usage (`pdf`, `summary`, `compaction`, media generation, subagents).
- Keep Agents as the owner for editing model strategy and update the Agents handoff with exact acceptance criteria.
- Verify through focused component tests, frontend build, mock module E2E, real-safe Models E2E where available, and OpenSpec strict validation.

**Non-Goals:**

- Building the Agents model-policy editor in this change.
- Adding or changing upstream OpenClaw schema fields.
- Adding a new generic config editor inside Models.
- Productizing every advanced provider/model leaf such as provider `request`, model `compat`, or provider/model headers when existing contract support is read-only or security-sensitive.
- Removing backend/API raw config routes if they are still needed by the generic Config module or historical compatibility; this change removes the Models product entry point.

## Decisions

### Decision: Models uses typed UI only; raw edit belongs outside the Models product surface

The Models page SHALL remove the raw editor button, drawer, state, and product copy. Existing typed mutations remain the only normal way to create/edit/delete providers and models from Models.

Rejected: Keep raw editor as a "power user" fallback inside Models. That keeps the UI from converging because every unsupported field can avoid product design.

### Decision: Usage policy is visible in Models but edited in Agents

Models SHALL display defaults and references so users can understand deletion impact and current policy, but Models SHALL NOT edit `agents.defaults.*` or per-agent fallback chains. The upcoming Agents module owns these edits because they are agent runtime policy, not model asset definition.

Rejected: Add default/fallback editors to Models now. That would duplicate the Agents redesign and make Models write outside its owning config domain.

### Decision: Model input capability labels must not absorb role defaults

The model drawer continues to edit `input: ["text" | "image"]` only. PDF, summary, compaction, memory search, image generation, video generation, music generation, and subagent role defaults are shown in a separate usage-policy overview. PDF is a model role/default, not a model input modality in current OpenClaw model config.

Rejected: Add `pdf` as a third model input checkbox. That would conflict with OpenClaw schema and create invalid config.

### Decision: Unsupported advanced leaves become summaries or follow-ups

Provider `request`, provider/model headers, and model `compat` SHALL be represented by read-only summaries unless the typed contract safely supports editing. Copy must say what is currently summarized and where the future typed work belongs, not "use raw editor".

Rejected: Hide all advanced summaries. Operators still need to know that a provider/model contains additional technical config before making edits or deleting assets.

### Decision: Handoff is an implementation deliverable

This change is not complete unless the Agents handoff says exactly which model-policy fields Agents must edit later and how Models will link or display ownership.

Rejected: Leave policy editing as an implicit memory item. We are transitioning to Agents next, so the handoff must be durable.

## Risks / Trade-offs

- **Risk: Operators lose an immediate raw workaround inside Models.** Mitigation: keep generic Config tooling out of scope, summarize unsupported fields clearly, and record typed follow-ups instead of silently dropping capability.
- **Risk: Policy overview looks editable but is not.** Mitigation: use read-only copy, owner labels, and no inline edit controls for `agents.defaults` policy.
- **Risk: Existing tests expect the raw editor.** Mitigation: replace those tests with negative assertions and usage-policy coverage.
- **Risk: Real E2E can fail because of stack environment rather than Models behavior.** Mitigation: run the existing real Models module smoke when available; if blocked, record exact circuit-breaker evidence and still run contract/build/mock evidence.
- **Risk: Product completeness expands into provider headers/request/compat editing.** Mitigation: keep those as follow-up candidates unless current contracts safely support typed edits.

## Migration Plan

1. Remove raw editor wiring from the Models panel/header and delete unused imports/state/tests.
2. Add a usage-policy overview component backed by `DeckGoModelsConfigDetail.defaults` and existing reference metadata.
3. Update i18n and drawer copy to remove raw-editor fallback language.
4. Update Models handoff/follow-up docs so Agents receives the policy-editing scope.
5. Run focused frontend tests and build, mock Models E2E, real-safe Models E2E when available, and OpenSpec strict validation.

Rollback strategy: restore the raw editor entry point only if typed provider/model asset edits regress. Do not restore raw editor copy as the accepted product path for unsupported fields; unresolved typed gaps should remain follow-ups.

## Open Questions

No product decision is blocking implementation. If implementation finds an unsupported advanced leaf that materially affects existing configured providers, record a follow-up instead of inventing a partial editor.

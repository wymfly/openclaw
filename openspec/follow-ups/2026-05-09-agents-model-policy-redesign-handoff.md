# Follow-up — Agents model policy redesign handoff

- **Status**: resolved
- **Source**: `openspec/changes/deck-go-models-product-semantics-convergence/`; updated by `openspec/changes/deck-go-models-product-contract-completion/` to remove the Models raw-editor fallback and make this handoff the durable policy-editing path; promoted and resolved by `openspec/changes/deck-go-agents-model-policy-convergence/`.
- **Classification**: next-openspec
- **Owning module**: Agents
- **Related module**: Models

## Fact Baseline

OpenClaw model assets and model usage policy are separate configuration concerns:

- `models.providers` defines provider/model assets and call metadata.
- `agents.defaults.model` supports the default text model policy.
- Agent model selection supports `AgentModelConfig = string | { primary?: string; fallbacks?: string[] }`.
- `agents.list[].model` supports per-agent model policy.
- `agents.list[].subagents.model` and `agents.defaults.subagents.model` support subagent model policy.
- Role defaults such as image/pdf/summary/compaction/memory-search/media generation are stored under `agents.defaults.*` fields where OpenClaw config truth supports them.

Models should display usage/default/fallback references, show a read-only usage-policy overview, and protect deletes with impact checks. Agents should own the product editing surface for model policy. Models must not reintroduce a raw editor as the fallback way to edit these policy fields.

## Required Product Decisions For Agents

- Define how the default agent model is edited: inherit OpenClaw default, explicit primary only, or explicit primary plus fallback chain.
- Define how per-agent model policy is edited: inherit default, override primary, override primary plus fallback chain, or clear override.
- Define how main/protected agent model edits are guarded.
- Define how subagent model defaults are edited and explained.
- Define how role-specific defaults are surfaced: inside Agents, Settings, or linked owner panels.
- Define how model choices are sourced from Models config/runtime catalog and how unavailable/deleted models are shown.
- Define conflict behavior when an edited model policy references a provider/model that was concurrently changed.

## Suggested Next OpenSpec Scope

Create an Agents redesign change that includes a "Model policy" section or drawer:

- primary model picker from configured/runtime model choices;
- fallback chain editor with ordering, add/remove, and unavailable-model states;
- inheritance indicator for global default versus per-agent override;
- guarded editing for main/protected agents;
- subagent model policy controls;
- owner links back to Models for provider/model asset fixes;
- no dependency on a Models raw editor for policy fields.

## Acceptance Hints

- Backend and contracts must support `AgentModelConfig` object shape, not only `model?: string`.
- UI must distinguish authored default, inherited default, per-agent override, fallback, and unavailable reference.
- Models must remain the asset editor; Agents must remain the policy editor.
- Agents implementation must cover the role defaults that Models displays read-only: text, image, image generation, video generation, music generation, PDF, summary, compaction, memory search, and subagents where OpenClaw config truth supports them.
- Mock verification should cover inherit/override/fallback/unavailable/guarded main-agent states.
- Real verification should use an isolated config/workspace and reversible edits only.

## Resolution Notes

`deck-go-agents-model-policy-convergence` implemented the supported Agents-owned policy surface through typed Gateway methods, Deck-facing contracts, Go BFF forwarding, frontend Data Fabric hooks, and Agents runtime UI controls.

Implemented editable targets:

- text, image, image generation, video generation, music generation, PDF, compaction, memory search, and global subagent defaults under `agents.defaults.*`;
- per-agent runtime model policy under `agents.list[].model`;
- per-agent subagent model policy under `agents.list[].subagents.model`.

The only model-like field intentionally not promoted is `agents.defaults.summaryModel`: current OpenClaw schema truth does not define it, so the implementation reports it as unsupported/read-only metadata instead of exposing a save control.

## Context

The recent Models convergence made an important ownership split explicit:

```text
Models module                         Agents module
─────────────                         ─────────────
models.providers.*                    agents.defaults.*
provider/model metadata       ─────▶  agents.list[].model
auth/capability/cost/context          agents.list[].subagents.model
delete impact references              runtime usage policy
```

Current code does not complete the right side of that split:

- OpenClaw config truth supports `AgentModelConfig = string | { primary?: string; fallbacks?: string[] }` in `src/config/zod-schema.agent-model.ts`.
- `AgentDefaultsConfig` supports role defaults for text, image, image generation, video generation, music generation, PDF, compaction, memory search, and subagents through `src/config/types.agent-defaults.ts` and related zod schemas.
- `AgentConfig.model` and `AgentConfig.subagents.model` support `AgentModelConfig` in `src/config/types.agents.ts` and `src/config/zod-schema.agent-runtime.ts`.
- Gateway `agents.create` / `agents.update` currently accept only `model?: string` in `src/gateway/protocol/schema/agents-models-skills.ts`, so they cannot be the only policy write path.
- Existing Deck Agents DTOs expose mostly `model?: string` and `fallbackModels?: string[]`, and the React UI edits a single model string.
- Existing Gateway deck methods already use typed control-plane methods for per-agent skills and subagents. Model policy should follow that pattern instead of reopening raw config editing.

This change promotes `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` into an implementable Agents change.

## Goals / Non-Goals

**Goals:**

- Give Agents a contract-backed product surface for model policy that covers global role defaults, per-agent primary/fallback policy, and per-agent subagent model policy.
- Preserve Models as provider/model asset ownership and route users back to Models for missing provider/model assets.
- Support `AgentModelConfig` object shape in Deck-facing contracts where OpenClaw config supports it.
- Preserve existing unavailable references and show them clearly instead of dropping or fabricating them.
- Guard high-impact runtime policy edits, especially for `main`.
- Use base-hash conflict protection for config-backed writes.
- Verify with contract checks, Gateway method tests, Go BFF tests, frontend tests/build, mock E2E, and bounded real Gateway safe mutations.

**Non-Goals:**

- Do not add a raw `openclaw.json` editor to Agents or Models.
- Do not move provider/model asset creation into Agents.
- Do not edit `agents.defaults.models.<provider/model>.params` in this pass.
- Do not implement default-agent switching.
- Do not edit unrelated runtime fields such as sandbox, tools, heartbeat, memory index settings beyond the model field needed by this change.
- Do not claim `agents.defaults.summaryModel` support unless code truth proves it. Current OpenClaw schema truth does not define that field; summary-like model settings outside `agents.defaults` remain out of Agents model-policy editing unless separately productized.

## Decisions

### D1: Add typed `deck.agents.modelPolicy.*` Gateway methods

Add typed Gateway deck methods rather than using the Go BFF's generic `/deck/agents` `config.patch` action as the product API:

- `deck.agents.modelPolicy.get` returns global role defaults, selected per-agent policy, configured model choices, unavailable references, config hash, and ownership metadata.
- `deck.agents.modelPolicy.set` writes one bounded target at a time with `baseHash`.

Rationale: skills and subagents already use typed Gateway deck methods for config-backed per-agent operations. A typed method keeps product semantics, validation, base-hash handling, and generated contracts aligned across Gateway, Go, and frontend.

Alternative rejected: use the generic path/value patch action from the UI. It is too raw for a control product and currently does not express product-level ownership or conflict semantics clearly enough.

### D2: Model policy DTOs normalize strings and object policies

Deck-facing DTOs should represent model policy as normalized product data:

```ts
type DeckAgentModelSelection = {
  primary?: string;
  fallbacks?: string[];
};

type DeckAgentModelPolicyEntry = {
  key: string;
  label: string;
  configPath: string;
  source: "agent" | "default" | "missing";
  supportedShape: "agentModelConfig" | "string";
  selection?: DeckAgentModelSelection;
  effective?: DeckAgentModelSelection;
  unavailableRefs?: string[];
  editable: boolean;
  owner: "agents" | "models" | "other";
};
```

For `AgentModelConfig` fields, both string and object config are normalized to `{ primary, fallbacks }`. For string-only fields such as `agents.defaults.compaction.model` and `agents.defaults.memorySearch.model`, the UI only edits primary. Fallback editors must not appear for string-only fields.

Alternative rejected: keep separate `model?: string` and `fallbackModels?: string[]` fields. That shape cannot cleanly express inherit, clear override, string-only paths, unavailable references, and fallback ordering.

### D3: Supported policy targets are explicit

This change supports only policy targets backed by current OpenClaw config truth:

| Product target           | Config path                            | Shape              | Notes                                                          |
| ------------------------ | -------------------------------------- | ------------------ | -------------------------------------------------------------- |
| Text default             | `agents.defaults.model`                | `AgentModelConfig` | Primary + fallbacks.                                           |
| Image input default      | `agents.defaults.imageModel`           | `AgentModelConfig` | Primary + fallbacks.                                           |
| Image generation default | `agents.defaults.imageGenerationModel` | `AgentModelConfig` | Primary + fallbacks.                                           |
| Video generation default | `agents.defaults.videoGenerationModel` | `AgentModelConfig` | Primary + fallbacks.                                           |
| Music generation default | `agents.defaults.musicGenerationModel` | `AgentModelConfig` | Primary + fallbacks.                                           |
| PDF default              | `agents.defaults.pdfModel`             | `AgentModelConfig` | Primary + fallbacks.                                           |
| Compaction default       | `agents.defaults.compaction.model`     | `string`           | Primary only.                                                  |
| Memory search default    | `agents.defaults.memorySearch.model`   | `string`           | Primary only; embedding-provider settings remain out of scope. |
| Global subagent default  | `agents.defaults.subagents.model`      | `AgentModelConfig` | Primary + fallbacks.                                           |
| Agent text policy        | `agents.list[].model`                  | `AgentModelConfig` | Inherits text default when omitted.                            |
| Agent subagent policy    | `agents.list[].subagents.model`        | `AgentModelConfig` | Inherits global subagent default when omitted.                 |

If a read path sees an older or unsupported model-like field, it may show it as read-only metadata but must not expose a successful-looking editor.

### D4: Per-agent model policy is part of the Agents runtime section

The Agents detail runtime area becomes the product home for:

- current effective model policy;
- inherit default versus explicit override;
- ordered fallback chain;
- unavailable references;
- guarded edit and save;
- link to Models for asset repair.

Global role defaults can be reached from the Agents runtime section or a module-level policy drawer, but they remain in Agents because they configure how agents use models, not which models exist.

Alternative rejected: keep global role defaults in Models because Models can already display them. Display is useful for impact, but editing there would blur asset ownership with runtime policy ownership.

### D5: Writes are bounded, base-hash protected, and reference-aware

Every write target sends:

- target kind and key;
- `agentId` when the target is per-agent;
- `selection` or an explicit clear/inherit action;
- `baseHash`;
- optional confirmation context for guarded UI.

The Gateway handler writes a minimal config update through `readConfigFileSnapshotForWrite()` and `writeConfigFile()` after validating the base hash. Existing unavailable references are preserved on read. New writes should normally be selected from configured model choices. A manual advanced value may remain as a degraded fallback only when configured choices are unavailable or when the existing code already permits manual string entry; it must be labeled and tested.

### D6: `main` and high-impact edits use guarded UX

Changing model policy can alter cost, capabilities, latency, and tool compatibility. For `main`, the UI must say the change affects the protected system/fallback agent. For other agents, the UI must still show a runtime-impact confirmation before saving primary/fallback changes.

### D7: Verification separates product, contract, and real evidence

Mock/component verification proves UI states, theme, language, inheritance, fallbacks, and unavailable references. Real Gateway verification proves typed methods read/write isolated config correctly. Real E2E may use reversible fixture edits but must not mutate the user's global config/workspace.

## Risks / Trade-offs

- **Gateway `agents.update` only supports `model?: string`** -> Add separate typed deck policy methods rather than overloading upstream CRUD RPC.
- **Role defaults mix multiple shapes** -> DTOs carry `supportedShape` so fallback editors appear only for `AgentModelConfig` paths.
- **Unavailable references can block asset cleanup** -> Preserve and label them; link to Models for provider/model repair.
- **Global defaults may feel misplaced inside an agent detail page** -> Use a module-level or runtime-section policy surface with clear copy that Agents owns usage policy.
- **Config write conflicts can overwrite user edits** -> Require base hash and preserve local drafts on conflict in frontend.
- **Real E2E can be environment-sensitive** -> Allow bounded circuit breaker after evidence-producing attempts, but still require Gateway method tests and mock/frontend evidence.

## Migration Plan

1. Add contract/source DTOs and mutation metadata for model-policy get/set.
2. Add Gateway protocol schemas and server methods for `deck.agents.modelPolicy.get` / `deck.agents.modelPolicy.set`.
3. Regenerate Gateway and Deck-facing TS/Go artifacts.
4. Add Go BFF action wrappers under `/deck/agents`.
5. Add frontend API/Data Fabric query and mutation hooks.
6. Refactor Agents runtime/model UI to use model-policy DTOs, including inherit/override/fallback/unavailable states.
7. Update handoff docs and mark the Models follow-up promoted/resolved.
8. Verify in layers: OpenSpec strict, contracts/protocol, Gateway method tests, Go tests, frontend tests/build, mock E2E, bounded real E2E.

Rollback: revert the change commit as a unit. Generated artifacts and consumers must roll back together because the new policy DTOs span Gateway, Go, and frontend.

## Open Questions

- Whether to expose global role defaults as an always-visible Agents section or a drawer from the runtime section can be chosen during implementation based on current Agents layout, but the owning module must remain Agents.
- If configured model choices are empty in real Gateway, the UI may expose a labeled manual fallback for primary-only editing, but this state must be marked degraded and cannot be the primary happy path.

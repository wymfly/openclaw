# agents - api usage

All production calls go through `deck-go/frontend-new/src/api.ts`. Panel components should not assemble raw endpoint strings or Gateway method names.

## List

```ts
fetchAgentsList(): Promise<DeckGoAgentsListResponse>
```

Current implementation calls `gw.agents.list({})` through the generated Gateway client and normalizes to:

```ts
type DeckGoAgentsListResponse = {
  agents: DeckGoAgentSummary[];
  defaultId?: string;
};
```

List search, filter, and sort are client-side in this pass.

## Detail

```ts
fetchAgentDetail(agentId): Promise<DeckGoAgentDetailResponse>
```

Uses `GET /api/deck/agents?agentId=...`.

Fields used by the UI:

- `id`
- `name`
- `workspace`
- `model`
- `isDefault`
- `bindingCount`
- `sessionCount`
- `activeSubagentCount`
- `skillMode`
- `effectiveSkills`
- `totalAvailableSkills`
- `subagents.allowAgents`
- `subagents.model`
- `identityExists`
- `fallbackModels`

## Overview mutations

```ts
createAgent(params: DeckGoAgentCreateRequest): Promise<DeckGoAgentMutationResponse>
updateAgent(agentId, params: DeckGoAgentPatchRequest): Promise<DeckGoAgentMutationResponse>
deleteAgent(agentId): Promise<DeckGoAgentMutationResponse>
```

Create request is limited to current backend-supported fields:

```ts
type DeckGoAgentCreateRequest = {
  name: string;
  workspace?: string;
  emoji?: string;
  avatar?: string;
};
```

Patch request is limited to:

```ts
type DeckGoAgentPatchRequest = {
  name?: string;
  workspace?: string;
  model?: string;
  emoji?: string;
  avatar?: string;
};
```

## Skills

```ts
fetchAgentSkills(agentId): Promise<DeckGoAgentSkillsResponse>
updateAgentSkills(agentId, { mode, skills, baseHash }): Promise<DeckGoAgentSkillsSetResponse>
```

Current mode values are `"all"` and `"whitelist"`. Do not send `"inherit"`, `"explicit"`, or `"none"`.

## Subagents

```ts
fetchAgentSubagentConfig(agentId): Promise<DeckGoAgentSubagentConfigResponse>
normalizeAgentSubagentPermissionOptions(response): DeckGoAgentSubagentPermissionOption[]
updateAgentSubagentConfig(agentId, { allowAgents, model, baseHash })
```

Source DTO keeps `allowAgents`, optional `allowedAgents`, and optional `allAgents`. View code uses the named adapter to derive row-level `allowed` booleans.

## Event streams

```ts
fetchAgentEventStreams(agentId): Promise<DeckGoAgentEventStreamsResponse>
updateAgentEventStreams(agentId, eventStreams, baseHash)
```

The UI may offer declared stream ids such as:

- `agent.status.changed`
- `activity.event`
- `session.message`
- `session.tool`
- `sessions.changed`

It must not require a new event discriminator.

## Previews and files

```ts
fetchAgentToolPolicyPreview(agentId);
fetchAgentSystemPromptPreview(agentId);
fetchAgentFiles(agentId);
fetchAgentFile(agentId, name);
saveAgentFile(agentId, name, content);
```

Preview shapes are read-only and may be partially populated. File content is available only from `fetchAgentFile`.

## Stream events

```ts
streamEvents({ onEvent, onStatusChange, signal });
```

The shared agents store handles:

- `agent.status.changed`
- `activity.event` with known `type` values

Unknown activity payloads are ignored.

## Mock fixture rule

Mock data must be shaped as the DTOs above. Missing optional values should remain missing to verify unavailable UI treatment.

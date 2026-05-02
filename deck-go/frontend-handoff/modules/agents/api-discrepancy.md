# agents — API discrepancy notes

This file records differences between the forward-flow design package and the
current code/contract truth. Implementation must follow code truth first and
only synthesize temporary view shapes through named adapters.

## 1. `agents.list` query support

- **Design assumption:** `gw.agents.list(query)` supports `search`, `sortBy`,
  `filter`, `cursor`, and `limit`.
- **Current truth:** Gateway `AgentsListParamsSchema` is empty and generated
  Deck-Go clients expose `agents.list({})`.
- **Impact:** list search/sort/filter must be client-side in the first
  implementation. Pagination/cursor UI must not imply server support.
- **Resolution path:** Add server-side query support in a follow-up Gateway/BFF
  contract change if scale requires it.

## 2. `AgentSummary` v2 fields

- **Design assumption:** summary rows include closed fields such as `status`,
  `isDefault`, `sessionCount`, `bindingCount`, and `lastActiveAtMs`.
- **Current truth:** Deck-facing `DeckGoAgentSummary` currently exposes only
  identity/model/workspace fields plus an open extension.
- **Impact:** this change may add stable optional fields, but values must come
  from Gateway/BFF truth. Missing counters render as unavailable instead of `0`.
- **Resolution path:** extend `contracts/source/deck-api.contract.ts` and Go BFF
  normalization for fields that are truthfully available.

## 3. Realtime event discriminator

- **Design assumption:** `activity.event` has an `eventType` discriminated union
  with `agent.status`, `agent.session-count`, `agent.removed`, and
  `agent.health`.
- **Current truth:** the declared stream events are `activity.event` with
  `agentId`/`type` open payload and `agent.status.changed` with
  `agentId`/`status`.
- **Impact:** the agents panel must consume the declared stream contracts and
  ignore unknown payloads. It must not require `eventType`.
- **Resolution path:** a later stream contract change can introduce
  discriminated events after backend emission exists.

## 4. Skill mode semantics

- **Design assumption:** skill mode is `"inherit" | "explicit" | "none"`.
- **Current truth:** current Gateway/BFF sections use `"all" | "whitelist"`.
- **Impact:** the first UI must present current semantics or map labels without
  changing request values.
- **Resolution path:** semantic skill-mode migration belongs in a separate
  Gateway/config contract change.

## 5. `/deck/agents` per-kind endpoints

- **Design assumption:** skills/subagents/previews/event-streams can be read via
  kind-specific GET routes and written via kind-specific actions.
- **Current truth:** backend exposes `POST /deck/agents` as an action
  multiplexer and `GET /deck/agents?agentId=...` for detail.
- **Impact:** panel components must use typed `src/api.ts` wrappers. Raw
  endpoint/action strings are allowed only inside the API facade.
- **Resolution path:** split endpoints can be a later BFF cleanup.

## 6. Subagent allow-list shape

- **Design assumption:** subagent config returns `allAgents[].allowed`.
- **Current truth:** response contains `allowAgents`, optional `allowedAgents`,
  and optional `allAgents`.
- **Impact:** a named adapter may build `allAgents[].allowed` for view code, but
  source DTOs must keep Gateway truth.
- **Resolution path:** remove redundant fields only after backend contract
  changes and generated DTOs are updated.

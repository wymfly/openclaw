# agents - API discrepancy notes

This file records known differences between desirable product behavior and current contract/backend truth. The high-fidelity pass must follow current truth first.

## 1. `agents.list` query support

- **Design desire:** server-side `search`, `sortBy`, `filter`, `cursor`, and `limit`.
- **Current truth:** Gateway `agents.list` takes `{}`.
- **Implementation rule:** search/filter/sort are client-side; no pagination UI that implies server cursor support.

## 2. Optional summary counters

- **Design desire:** every row has session count, binding count, and last active time.
- **Current truth:** `DeckGoAgentSummary` has optional `sessionCount`, `bindingCount`, and `lastActiveAtMs`.
- **Implementation rule:** missing values render as unavailable (`-` or neutral copy), not `0`.

## 3. Realtime discriminator

- **Design desire:** typed `activity.event.eventType` union.
- **Current truth:** stream contracts expose `agent.status.changed` and open `activity.event` payloads.
- **Implementation rule:** consume declared fields only; ignore unknown payloads.

## 4. Skill mode semantics

- **Design desire:** `"inherit" | "explicit" | "none"`.
- **Current truth:** update wrapper accepts `"all" | "whitelist"`.
- **Implementation rule:** present current semantics or labels mapped to current values; never send unsupported literals.

## 5. `/deck/agents` per-kind routes

- **Design desire:** separate routes for skills, subagents, streams, and previews.
- **Current truth:** `POST /deck/agents` is an action multiplexer wrapped by `src/api.ts`.
- **Implementation rule:** panel code calls wrappers; raw action strings remain in API facade.

## 6. Subagent permission shape

- **Design desire:** `allAgents[].allowed`.
- **Current truth:** source DTO keeps `allowAgents`, optional `allowedAgents`, and optional `allAgents`.
- **Implementation rule:** use `normalizeAgentSubagentPermissionOptions()` for view rows.

## 7. Real Gateway E2E

- **Design desire:** visual tests also prove real Gateway behavior.
- **Current truth:** `frontend-agents-real-contract-verification` adds L2 agents API/UI smoke against a real OpenClaw Gateway, while L1 mock visual remains a separate visual gate.
- **Implementation rule:** closeout must report L1 mock visual and L2 real Gateway status separately. Mock visual E2E is never functional proof by itself.

## 8. Safe mutation isolation

- **Design desire:** create, update, delete, skills, subagents, streams, and file saves are all proven against real Gateway.
- **Current truth:** read-only L2 agents API/UI flows are verified. Real mutation flows can alter the user's OpenClaw config unless disposable or reversible agent state is available.
- **Implementation rule:** do not run automated real mutation checks against ambiguous user config. Mark them handoff-blocked with evidence, while keeping focused wrapper/component/Go tests mandatory.

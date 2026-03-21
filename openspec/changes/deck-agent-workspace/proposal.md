## Why

The Agents panel already has 5 tabs (Overview/Routing/Skills/Subagent/Sessions) for basic operational monitoring, but lacks deep configuration visibility. Ops cannot see the tool policy pipeline's final effect, cannot preview the assembled system prompt, and have no insight into what bootstrap files an agent loads. This gap undermines the "config as documentation" principle — the dashboard should be a comprehensive workbench for understanding and managing agent behavior, not just a read-only list.

## What Changes

- **New "Context" tab**: Show system prompt composition layers (bootstrap files + identity + skills prompt + extra instructions) and preview the final assembled system prompt.
- **Enhanced Overview tab**: Integrate Model Fallback chain visualization (reusing existing `FallbackChain` component from Models panel), add Sandbox mode selector with impact explanation, add Identity preview (avatar/emoji/theme live preview).
- **New Tool Policy visualization**: Display the 7-layer policy pipeline (`tools.profile` → `tools.byProvider.profile` → `tools.allow` → `tools.byProvider.allow` → `agents.<id>.tools.allow` → `agents.<id>.tools.byProvider.allow` → `group tools.allow`) with per-tool allow/deny resolution and stacking order.
- **Bootstrap file editor**: Inline editing for workspace files (`BOOTSTRAP.md`, `HEARTBEAT.md`, `IDENTITY.md`, `SOUL.md`, `TOOLS.md`, `USER.md`) with read/write via existing `deck.agents.files.*` RPCs.
- **Two new Gateway RPCs**:
  - `deck.agents.toolPolicy.preview` — returns resolved per-tool allow/deny list after all policy layers
  - `deck.agents.systemPrompt.preview` — returns the fully assembled system prompt for a given agent

## Capabilities

### New Capabilities

- `agent-context-tab`: System prompt composition viewer — shows individual prompt layers and renders the final assembled prompt for preview
- `agent-tool-policy-viz`: Tool policy pipeline visualization — displays the 7-layer stacking order with per-tool resolution and conflict highlighting
- `agent-workspace-rpc`: Two new gateway RPC methods for tool policy preview and system prompt preview
- `agent-overview-enhancements`: Enhanced Overview tab with model fallback chain, sandbox mode selector, and identity preview

### Modified Capabilities

<!-- No existing openspec specs to modify -->

## Impact

- **Frontend**: New tab component (`ContextTab.tsx`), new tool policy visualization component, enhanced `OverviewTab.tsx`. Reuses existing `FallbackChain` from Models panel.
- **Gateway**: Two new RPC handlers in `src/gateway/server-methods/agents.ts` (or new file). Tool policy preview requires importing from `tool-policy-pipeline.ts`; system prompt preview requires importing from the prompt assembly chain in `pi-embedded-runner/run/attempt.ts`.
- **Store**: Extend `deck-agents.ts` store with new fetch methods for tool policy and system prompt preview.
- **Dashboard API route**: Extend `dashboard/src/app/api/deck/agents/route.ts` action dispatcher with new actions.
- **i18n**: New translation keys for Context tab, tool policy labels, sandbox mode descriptions.
- **Dependencies**: No new external dependencies. Reuses `dnd-kit` (already installed for FallbackChain).

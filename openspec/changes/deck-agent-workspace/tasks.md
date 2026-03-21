## 1. Gateway RPC — Tool Policy Preview

- [ ] 1.1 Implement `deck.agents.toolPolicy.preview` handler in `src/gateway/server-methods/agents.ts` (or new file `agents-preview.ts`): call `buildDefaultToolPolicyPipelineSteps` + `applyToolPolicyPipeline` in dry-run mode, return per-layer summaries and per-tool resolution traces
- [ ] 1.2 Define TypeScript response types for tool policy preview (layers, tools, configHash)
- [ ] 1.3 Register method in `method-scopes.ts`, `server-methods-list.ts`
- [ ] 1.4 Add to `dashboard/server/gateway-allowlist.ts`
- [ ] 1.5 Add unit tests for tool policy preview handler (multi-layer resolution, channel context, unknown agent)

## 2. Gateway RPC — System Prompt Preview

- [ ] 2.1 Implement `deck.agents.systemPrompt.preview` handler: call `buildEmbeddedSystemPrompt` + `buildSystemPromptReport` in dry-run mode, return layer breakdowns, bootstrap file list, and assembled prompt text
- [ ] 2.2 Define TypeScript response types for system prompt preview (layers, assembledPrompt, totalChars, bootstrapFiles, configHash)
- [ ] 2.3 Register method in `method-scopes.ts`, `server-methods-list.ts`
- [ ] 2.4 Add to `dashboard/server/gateway-allowlist.ts`
- [ ] 2.5 Add unit tests for system prompt preview handler (all layers populated, minimal config, channel context, unknown agent)

## 3. Dashboard Store — Agent Workspace Extensions

- [ ] 3.1 Extend `deck-agents.ts` store with `fetchToolPolicyPreview(agentId, context?)` method
- [ ] 3.2 Extend `deck-agents.ts` store with `fetchSystemPromptPreview(agentId, context?)` method
- [ ] 3.3 Extend dashboard API route (`app/api/deck/agents/route.ts`) action dispatcher with `toolPolicy.preview` and `systemPrompt.preview` actions
- [ ] 3.4 Add i18n keys for all new UI strings in `zh.json` and `en.json` (context tab, tool policy, prompt layers, sandbox mode, identity preview)

## 4. Context Tab — Prompt Composition Viewer

- [ ] 4.1 Create `ContextTab.tsx` component with collapsible section layout (prompt layers, bootstrap files, tool policy)
- [ ] 4.2 Implement prompt layer stack: render each layer (bootstrap, identity, skills, extra, hooks) as collapsible section with label, char count badge, and content preview
- [ ] 4.3 Implement "Preview Full Prompt" toggle: fetch assembled prompt via store, render in read-only code block with char count header
- [ ] 4.4 Add optional channel context selector that re-fetches prompt preview for channel-specific variant
- [ ] 4.5 Register Context tab in `AgentDetail.tsx` tab navigation (position: after Skills, before Subagent)

## 5. Context Tab — Bootstrap File Editor

- [ ] 5.1 Implement bootstrap file list in Context tab: show each workspace file (BOOTSTRAP.md, HEARTBEAT.md, IDENTITY.md, SOUL.md, TOOLS.md, USER.md) with exists/not-exists indicator
- [ ] 5.2 Implement inline file editor: load content via `deck.agents.files.get`, render textarea with markdown awareness
- [ ] 5.3 Implement save flow: write via `deck.agents.files.set`, show success indicator, refresh prompt preview if visible
- [ ] 5.4 Implement "Create" flow for files that don't exist yet

## 6. Context Tab — Tool Policy Visualization

- [ ] 6.1 Implement tool policy pipeline diagram: render 7 layers as vertical stacked steps with labels, rule counts, and effect indicators
- [ ] 6.2 Implement per-tool resolution detail: clickable tool name expands to show layer-by-layer trace with allow/deny decisions
- [ ] 6.3 Implement tool list summary: all tools with final allow/deny status and decisive layer label
- [ ] 6.4 Implement tool search/filter input for the tool list

## 7. Overview Tab Enhancements

- [ ] 7.1 Integrate `FallbackChain` component into Overview tab: create adapter function mapping agent model config → FallbackChainProps
- [ ] 7.2 Handle edge cases: agent with no model (show "Using default" indicator), agent with only primary model
- [ ] 7.3 Add sandbox mode badge with impact explanation tooltip
- [ ] 7.4 Add identity preview card: render avatar emoji, theme color, and identity description snippet from IDENTITY.md
- [ ] 7.5 Add "Context" stat card to Overview tab that links to Context tab with prompt summary stats

## 8. Integration & Verification

- [ ] 8.1 Run `tsc --noEmit` — zero TypeScript errors
- [ ] 8.2 Run `pnpm check` — lint/format clean
- [ ] 8.3 Verify all new i18n keys present in both `zh.json` and `en.json`
- [ ] 8.4 Verify gateway allowlist includes both new RPC methods
- [ ] 8.5 Run `pnpm test` — all existing + new tests pass

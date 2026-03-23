## 1. Gateway RPC — Tool Policy Preview

- [x] 1.1 Implement `deck.agents.toolPolicy.preview` handler in new file `agents-preview.ts`: uses real `resolveEffectiveToolPolicy` + `isToolAllowedByPolicyName` + `pickSandboxToolPolicy` for per-tool traces
- [x] 1.2 Define TypeScript response types for tool policy preview (layers, tools, configHash)
- [x] 1.3 Register method in `method-scopes.ts`, `server-methods-list.ts`
- [x] 1.4 Add to `dashboard/server/gateway-allowlist.ts`
- [x] 1.5 Add unit tests for tool policy preview handler (valid agent, unknown agent, invalid params, restrictive allowlist)

## 2. Gateway RPC — System Prompt Preview

- [x] 2.1 Implement `deck.agents.systemPrompt.preview` handler: loads bootstrap files via `loadWorkspaceBootstrapFiles`, returns layer summaries + file stats (assembledPrompt deferred — requires live session)
- [x] 2.2 Define TypeScript response types for system prompt preview (layers, totalChars, bootstrapFiles, configHash)
- [x] 2.3 Register method in `method-scopes.ts`, `server-methods-list.ts`
- [x] 2.4 Add to `dashboard/server/gateway-allowlist.ts`
- [x] 2.5 Add unit tests for system prompt preview handler (valid agent, unknown agent, invalid params)

## 3. Dashboard Store — Agent Workspace Extensions

- [x] 3.1 Extend `deck-agents.ts` store with `fetchToolPolicyPreview(agentId)` method
- [x] 3.2 Extend `deck-agents.ts` store with `fetchSystemPromptPreview(agentId)` method
- [x] 3.3 Extend dashboard API route (`app/api/deck/agents/route.ts`) action dispatcher with `toolPolicy.preview` and `systemPrompt.preview` actions
- [x] 3.4 Add i18n keys for all new UI strings in `zh.json` and `en.json` (context tab, tool policy, prompt layers, sandbox mode, identity preview)
- [x] 3.5 Add `fetchBootstrapFile` and `saveBootstrapFile` store actions (using existing REST routes `/api/agents/[agentId]/files/*`)
- [x] 3.6 Add all missing `deck.*` methods to gateway allowlist (deck.agents._, deck.routing._, deck.auth._, deck.identity._, deck.threads.\*)
- [x] 3.7 Update `gateway-adapter.test.ts` allowlist assertions

## 4. Context Tab — Prompt Composition Viewer

- [x] 4.1 Create `ContextTab.tsx` component with collapsible section layout (prompt layers, bootstrap files, tool policy)
- [x] 4.2 Implement prompt layer stack: render each layer as collapsible section with label, char count badge, and content preview
- [x] ~~4.3 Implement "Preview Full Prompt" toggle~~ → Deferred: assembledPrompt requires live session with 20+ params
- [x] ~~4.4 Add optional channel context selector~~ → Schema-ready only, no frontend selector built
- [x] 4.5 Register Context tab in `AgentDetail.tsx` tab navigation (position: after Skills, before Subagent)

## 5. Context Tab — Bootstrap File Editor

- [x] 5.1 Implement bootstrap file list in Context tab: show each workspace file with exists/not-exists indicator
- [x] 5.2 Implement inline file editor: load content via existing `agents.files.get` REST route, render textarea
- [x] 5.3 Implement save flow: write via existing `agents.files.set` REST route, show success indicator, refresh prompt preview
- [x] 5.4 Implement "Create" flow for files that don't exist yet

## 6. Context Tab — Tool Policy Visualization

- [x] 6.1 Implement tool policy pipeline diagram: render 7 layers as vertical stacked steps with labels, rule counts, and effect indicators
- [x] 6.2 Implement per-tool resolution detail: clickable tool name expands to show layer-by-layer trace with allow/deny decisions
- [x] 6.3 Implement tool list summary: all tools with final allow/deny status and decisive layer label
- [x] 6.4 Implement tool search/filter input for the tool list

## 7. Overview Tab Enhancements

- [x] ~~7.1 Integrate `FallbackChain` component~~ → Changed to read-only text display (FallbackChain requires Model[]+AuthOverviewEntry[])
- [x] 7.2 Handle edge cases: agent with no model (show "Using default" indicator), model with fallbacks (text list)
- [x] 7.3 Add sandbox mode badge with impact explanation
- [x] 7.4 Add identity preview card: render agent name initial, IDENTITY.md badge if exists, configure link
- [x] 7.5 Add "Context" stat card to Overview tab that links to Context tab
- [x] 7.6 Extend `deck.agents.detail` RPC with sandbox, identityExists, fallbackModels fields

## 8. Integration & Verification

- [x] 8.1 Run `tsc --noEmit` — zero NEW TypeScript errors
- [x] 8.2 Run `pnpm check` — lint/format clean
- [x] 8.3 Verify all new i18n keys present in both `zh.json` and `en.json`
- [x] 8.4 Verify gateway allowlist includes ALL deck.\* methods
- [x] 8.5 Run `pnpm test` — all existing + new tests pass (2 pre-existing failures in unrelated memory tests)

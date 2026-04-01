## 1. Command Types & Registry (Phase 1 — 零功能变更)

- [ ] 1.1 Create `dashboard/src/lib/command-types.ts` — define `CommandSource`, `CommandExecMode`, `RegisteredCommand`, `CommandVisibilityContext`, `ArgSchema` types
- [ ] 1.2 Create `dashboard/src/lib/command-registry.ts` — implement `CommandRegistry` class with `register()`, `unregister()`, `get()`, `getAll()`, `filter()`, priority-based conflict resolution, qualified name fallback
- [ ] 1.3 Add `registerLocalCommands()` convenience method that converts existing `SlashCommandDef[]` to `RegisteredCommand[]` with `source: "local"`, `execMode: "local"`
- [ ] 1.4 Write unit tests for CommandRegistry — register, unregister, conflict resolution, filter, qualified name access

## 2. Executor Refactor (Phase 1)

- [ ] 2.1 Refactor `slash-command-executor.ts` — replace switch-case with registry-driven dispatch: lookup command in registry, call `execute()` for local, call `chat.send` for remote
- [ ] 2.2 Add remote execution path — implement `executeRemoteCommand()` that calls `gw.chatSend()` with the command text and shows a "Command sent" toast
- [ ] 2.3 Update `MessageInput.tsx` — replace `parseSlashCommand()` usage with registry-based `registry.get(name)` lookup, keep unknown command guard

## 3. Palette Migration (Phase 1)

- [ ] 3.1 Refactor `SlashCommandPalette.tsx` — read commands from `CommandRegistry.filter()` instead of `getSlashCommandCompletions()`, preserve existing category grouping and keyboard navigation
- [ ] 3.2 Update `slash-commands.ts` — change to export `LOCAL_COMMAND_DEFS` constant (renamed from `SLASH_COMMANDS`), add re-export of registry filter for backward compat
- [ ] 3.3 Initialize registry on app load — register 14 local commands via `registerLocalCommands()` in a top-level module or ChatPanel mount
- [ ] 3.4 Verify Phase 1 — all 14 commands work identically (toast feedback, config update, palette display), `tsc --noEmit` passes

## 4. Gateway RPC — deck.commands.discover (Phase 2)

- [ ] 4.1 Create `src/gateway/protocol/schema/deck-commands.ts` — define TypeBox schemas for `DeckCommandsDiscoverParams` and `DeckCommandsDiscoverResult`
- [ ] 4.2 Create `src/gateway/server-methods/deck/commands.ts` — implement `deck.commands.discover` handler that aggregates `getChatCommands()`, `listSkillCommandsForAgents()`, and plugin invocation keys; compute version hash
- [ ] 4.3 Register RPC in `src/gateway/server-methods-list.ts` and export from `src/gateway/server-methods/deck/index.ts`; add methodDefs with result schema
- [ ] 4.4 Run `pnpm protocol:gen:ts` to generate typed client; update `dashboard/server/gateway-allowlist.ts`
- [ ] 4.5 Verify Gateway RPC — start Gateway, call `deck.commands.discover` via curl/typed client, confirm built-in + skill commands returned with correct metadata

## 5. Discovery Hook & SSE (Phase 2)

- [ ] 5.1 Create `dashboard/src/hooks/use-command-discovery.ts` — hook that calls `gw.deckCommandsDiscover()` on mount, registers discovered commands into registry, caches version
- [ ] 5.2 Add SSE listener in hook — listen for `commands.changed` event, compare version, re-discover if different
- [ ] 5.3 Add cleanup logic — unregister all remote commands on unmount
- [ ] 5.4 Integrate hook — mount `useCommandDiscovery()` in `ChatPanel.tsx`; add i18n keys for new category labels (Skills, Plugins, More)
- [ ] 5.5 Wire SSE full pipeline for `commands.changed` — add to DeckEventType union in `event-bus.ts`, whitelist in `runtime.ts` VALID_DECK_EVENTS, emit via `context.broadcast()` in skills.install/update handlers, add EventSource listener in discovery hook

## 6. Remote Command Execution (Phase 2)

- [ ] 6.1 Implement `executeRemoteCommand()` in executor — call `gw.chatSend({ sessionKey, message: "/{name} {args}" })`, show toast, handle errors
- [ ] 6.2 Verify remote execution — start Gateway + Dashboard, execute a discovered builtin command (e.g., `/status`), confirm result appears as assistant message via SSE

## 7. Enhanced Palette UI (Phase 3 — Rich UX)

- [ ] 7.1 Add mixed-source grouping — render "Skills" header for skill commands, "More commands..." expandable section for remote built-in commands
- [ ] 7.2 Add dynamic icon resolution — Sparkles icon for skills, Plug icon for plugins, Terminal for remote builtins; extend ICON_MAP
- [ ] 7.3 Add ghost hint — when user types a command name + space, show dimmed argOptions or args placeholder in input
- [ ] 7.4 Add visibility filtering — implement `visibleIf` predicates for `/stop`, `/compact`, `/kill`; filter palette results through predicates using current session state
- [ ] 7.5 Add "More" section expand/collapse — collapsed by default, shows all remote built-in commands when expanded; remember expand state in session

## 8. Integration & Verification

- [ ] 8.1 Add i18n keys — `zh.json` and `en.json`: cmdCatSkills, cmdCatPlugins, cmdCatMore, toastCommandSent, toastCommandSentFailed, ghostHintModel, ghostHintThink, etc.
- [ ] 8.2 Run `tsc --noEmit` + `pnpm check` + `pnpm protocol:gen:check` — zero errors
- [ ] 8.3 End-to-end verification — start Gateway + Dashboard, test: palette shows local + discovered commands, local commands execute with toast, remote commands execute via chat.send, SSE refresh on skill install

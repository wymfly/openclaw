## 1. Routing — Condition Editor & Drag-to-Reorder

- [x] 1.1 Create `ConditionBuilder` component: tag-based pill UI for channel/accountId/peer/guildId/roles dimensions with add/remove
- [x] 1.2 Integrate `ConditionBuilder` into BindingTable's add/edit flow, replacing the current inline form
- [x] 1.3 Install `@dnd-kit/core` + `@dnd-kit/sortable`; create `SortableBindingRow` wrapper for BindingTable rows
- [x] 1.4 Implement drag-to-reorder within same tier: handle `onDragEnd`, persist new order via remove+add RPC
- [x] 1.5 Add keyboard accessibility for reorder (Space to grab, Arrow to move, Space to drop)
- [x] 1.6 Block cross-tier drag: validate drop target tier matches source tier

## 2. Routing — Conflict Detection

- [x] 2.1 Add `detectConflicts(bindings)` utility: O(n²) pairwise match overlap check, returns conflict pairs
- [x] 2.2 Create `ConflictBadge` component: warning icon + tooltip showing conflicting rule details
- [x] 2.3 Integrate conflict detection into `useDeckRoutingStore`: run on `fetchBindings` result, store `conflictPairs` in derived state
- [x] 2.4 Add debounce + Web Worker fallback for >100 rules to prevent UI blocking
- [x] 2.5 Add i18n keys for conflict messages (en.json + zh.json)

## 3. Routing — Hit Log (degraded to Activity Feed)

- [x] 3.1 Create `ActivityFeed` component: reverse-chronological list with agent badge, description, relative timestamp
- [x] 3.2 Add "Activity" toggle to RoutingPanel (desktop: replaces simulator; mobile: third tab)
- [x] 3.3 Implement 10s auto-refresh interval with activity store
- [x] 3.4 Add agent filter dropdown for activity entries
- [x] 3.5 Add empty state illustration for no activity

## 4. Sessions — DM Scope Visualizer

- [x] 4.1 Create `ScopeStrategyCard` component: title, description, mini-diagram (CSS), selected state
- [x] 4.2 Create `ScopeSelector` panel with 4 cards (main / per-peer / per-channel-peer / per-account-channel-peer)
- [x] 4.3 Add "Scope" tab to SessionsPanel
- [x] 4.4 Implement strategy selection with confirmation dialog; wire to config update API
- [x] 4.5 Integrate `parseSessionKey` into SessionDetail with inline badges

## 5. Sessions — Context Health & Transcript

- [x] 5.1 Create `ContextHealthBar` component: token usage % bar (green/yellow/red thresholds), compaction count badge, message count
- [x] 5.2 Integrate `ContextHealthBar` into SessionDetail header area
- [x] 5.3 Create `TranscriptSearch` component: search input with match count badge and prev/next navigation
- [x] 5.4 Implement search highlighting within `SessionDetail`'s message history bubbles
- [x] 5.5 Create `SessionExport` component: dropdown with JSON and Markdown options, Blob-based client-side download
- [x] 5.6 Implement JSON export (full metadata + messages) and Markdown export (formatted transcript)

## 6. Channels — Configuration Wizards

- [x] 6.1 Create reusable `ConfigWizard` component: multi-step stepper with progress bar, per-step validation, back/next navigation
- [x] 6.2 Create `WeComWizard` (4 steps): transport mode cards → enterprise info form → callback URL display + copy → connection test
- [x] 6.3 Create `FeishuWizard` (3 steps): transport mode cards (WebSocket recommended / Webhook) → app credentials form → connection test
- [x] 6.4 Add wizard launch buttons to ChannelDetail for WeCom and Feishu channel types
- [x] 6.5 Implement plugin-installed check at wizard step 1; show install guidance if plugin missing

## 7. Channels — Multi-Account Management

- [x] 7.1 Enhance `ChannelDetail` account list: add enable/disable toggle per account with API call
- [x] 7.2 Add "Add Account" button that launches the appropriate wizard for the channel type
- [x] 7.3 Add "Remove Account" with confirmation dialog and success toast
- [x] 7.4 Add account status badges (enabled/disabled, connected/disconnected) to account list items

## 8. Channels — Throughput Monitor

- [x] 8.1 Create `ThroughputChart` component: mini bar chart (messages in/out) with configurable time window (1h/6h/24h)
- [x] 8.2 Integrate `ThroughputChart` into ChannelDetail
- [x] 8.3 Implement 30s auto-refresh with pause-on-hover behavior
- [x] 8.4 Add aggregate throughput stats to Channels panel header (total in/out for last 1h)
- [x] 8.5 Extend `useChannelsStore` with throughput data fetching and time-window state

## 9. I18n & Design System

- [x] 9.1 Add all new i18n keys to en.json and zh.json for routing/sessions/channels enhancements
- [x] 9.2 Ensure all new components use CSS variable tokens from design system (no hardcoded colors)
- [x] 9.3 Verify dark mode rendering for all new components
- [x] 9.4 Add responsive breakpoints: condition builder and wizard collapse gracefully on mobile

## 10. Testing & Validation

- [x] 10.1 Unit tests for `detectConflicts` utility (conflict pairs, subset detection, same-agent no-conflict)
- [x] 10.2 Unit tests for `SessionKeyParser` (DM key, main-scope key, unknown format)
- [x] 10.3 Unit tests for session export (JSON structure, Markdown formatting)
- [ ] 10.4 Component tests for `ConditionBuilder`, `ScopeSelector`, `ConfigWizard` stepper flow
- [x] 10.5 Run `pnpm tsgo` + `pnpm check` + `pnpm test` to validate full build

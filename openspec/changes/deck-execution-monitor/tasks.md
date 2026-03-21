## 1. Database & Persistence Infrastructure

- [ ] 1.1 Create migration `dashboard/migrations/007_run_events.sql` — `run_events` table with indexes (run_id, agent_id+created_at, session_key+created_at)
- [ ] 1.2 Create `dashboard/server/run-event-store.ts` — RunEventStore class with lazy prepared statements, sharing `getDb()` connection
- [ ] 1.3 Implement `appendEvents(events[])` — batch INSERT OR IGNORE within transaction, with lazy prune check (1 hour interval, 7 day retention)
- [ ] 1.4 Implement `getRunEvents(runId)` — return all events for a run ordered by seq ascending
- [ ] 1.5 Implement `listRuns(filters)` — cursor-based paginated run list with agentId/sessionKey/since/until filters
- [ ] 1.6 Implement `getRunSummary(runId)` — aggregate tool count, model count, tokens, duration, file ops, subagent spawns, compaction flag
- [ ] 1.7 Implement `getStats()` — total runs, today's runs, average duration, top 5 agents by run count
- [ ] 1.8 Write tests for RunEventStore (CRUD, pagination, pruning, edge cases)

## 2. Event Write Pipeline

- [ ] 2.1 Create `dashboard/server/run-event-pipeline.ts` — EventBus subscriber that transforms SSE events (`chat`, `agent`) into `run_events` rows
- [ ] 2.2 Implement event stream classification — map SSE event types to 6 stream types (tool_call, model, file_op, subagent, compaction, system)
- [ ] 2.3 Implement batch buffer — accumulate events, flush on 50 count or 500ms timeout, within SQLite transaction
- [ ] 2.4 Wire pipeline startup in Deck Server initialization (subscribe to EventBus)
- [ ] 2.5 Add `run.event` to `DeckEventType` in `event-bus.ts` for internal pipeline events
- [ ] 2.6 Write tests for event classification and batch flush logic

## 3. API Routes

- [ ] 3.1 Create `dashboard/src/app/api/monitor/runs/route.ts` — GET handler with query params (agentId, sessionKey, since, until, status, cursor, limit)
- [ ] 3.2 Create `dashboard/src/app/api/monitor/runs/[runId]/route.ts` — GET handler returning events + computed summary
- [ ] 3.3 Create `dashboard/src/app/api/monitor/stats/route.ts` — GET handler returning overview statistics
- [ ] 3.4 Write tests for API routes (filtering, pagination, error handling)

## 4. UI Store & Panel Type Migration

- [ ] 4.1 Update `stores/ui.ts` — replace `activity` with `monitor` in Panel union type, remove `gateway`
- [ ] 4.2 Add localStorage migration function — convert `activity` → `monitor` and `gateway` → `monitor` on load
- [ ] 4.3 Create `stores/monitor.ts` — Zustand store with: activeTab, selectedRunId, runs[], runEvents[], runSummary, liveEvents (migrated from activity), filters, loading states
- [ ] 4.4 Update NavRail — replace Activity entry with Monitor (icon change), remove Gateway entry
- [ ] 4.5 Update HeaderBar — connection indicator click navigates to Monitor panel
- [ ] 4.6 Update all panel references (imports, switch cases, router) from `activity`/`gateway` to `monitor`

## 5. Monitor Panel: Overview Tab

- [ ] 5.1 Create `dashboard/src/components/panels/monitor/MonitorPanel.tsx` — container with 3 tabs (Overview, Timeline, History)
- [ ] 5.2 Create `dashboard/src/components/panels/monitor/overview/OverviewTab.tsx` — diagnostics card grid + live event feed
- [ ] 5.3 Migrate `ConnectionCard`, `HealthCard`, `HeartbeatCard` from `panels/gateway/` to `panels/monitor/overview/`
- [ ] 5.4 Adapt EventTimeline component for Monitor context (import from activity or create new LiveFeed component)
- [ ] 5.5 Delete `panels/gateway/` directory and `GatewayPanel.tsx`

## 6. Monitor Panel: Timeline Tab

- [ ] 6.1 Create `dashboard/src/components/panels/monitor/timeline/TimelineTab.tsx` — run selector + timeline + waterfall + details
- [ ] 6.2 Implement `RunTimeline` component — CSS Grid Gantt-style bars with stream color coding, time axis, compaction markers
- [ ] 6.3 Implement `ToolWaterfall` component — hierarchical tree of tool calls with expandable details (args, result, duration)
- [ ] 6.4 Implement `FileChangeSummary` component — grouped file operations (read/write/modify) with path listing
- [ ] 6.5 Implement `ModelStats` component — per-model call count, token breakdown (input/output/cache), fallback markers
- [ ] 6.6 Implement `SubagentTree` component — wrapper around shared LineageTree with data from run_events subagent stream
- [ ] 6.7 Implement compaction marker rendering — vertical lines at compaction event positions with label

## 7. Monitor Panel: History Tab

- [ ] 7.1 Create `dashboard/src/components/panels/monitor/history/HistoryTab.tsx` — run list with filters + pagination
- [ ] 7.2 Implement run list with inline summary metrics (tool count, model calls, tokens, duration)
- [ ] 7.3 Implement status badges (Completed/Error/Running with appropriate colors and animation)
- [ ] 7.4 Implement filter bar — agent dropdown, session input, time range picker, status filter, clear button
- [ ] 7.5 Implement infinite scroll pagination (cursor-based, load 20 per page)
- [ ] 7.6 Wire run click → navigate to Timeline tab with selected runId
- [ ] 7.7 Support deep link via URL query param `?runId=xxx`

## 8. i18n

- [ ] 8.1 Add `monitor` namespace to `zh.json` — all tab labels, headers, empty states, filter labels, status badges, metric labels
- [ ] 8.2 Add `monitor` namespace to `en.json` — matching keys
- [ ] 8.3 Remove `activity` namespace from both `zh.json` and `en.json` (or keep as deprecated alias)
- [ ] 8.4 Update `gateway` i18n references — remove standalone gateway keys, keep keys used by migrated cards under `monitor` or `gateway` namespace

## 9. Integration & Testing

- [ ] 9.1 Verify SSE event pipeline end-to-end: Gateway event → EventBus → RunEventStore → API → UI
- [ ] 9.2 Verify Gateway diagnostics work identically in Monitor Overview tab (ConnectionCard, HealthCard, HeartbeatCard)
- [ ] 9.3 Test History → Timeline navigation flow with real run data
- [ ] 9.4 Test localStorage migration (activity → monitor, gateway → monitor)
- [ ] 9.5 Verify responsive layouts (desktop/tablet/mobile) for all 3 tabs
- [ ] 9.6 Test 7-day pruning with date boundary
- [ ] 9.7 Run `tsc --noEmit` to verify zero type errors after Panel type changes
- [ ] 9.8 Run `pnpm check` to verify lint/format compliance

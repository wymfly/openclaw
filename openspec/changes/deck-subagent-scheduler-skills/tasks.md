## 1. Backend: deck.subagents.steer RPC

- [ ] 1.1 Implement `deck.subagents.steer({ runId, instruction })` — locate active run, inject instruction into message queue, return `{ success, dedupKey }`
- [ ] 1.2 Implement 60-second idempotency dedup using `(runId, sha256(instruction))` as key — in-memory Map with TTL sweep
- [ ] 1.3 Register `deck.subagents.steer` in `server-methods-list.ts` with ADMIN scope in `method-scopes.ts`
- [ ] 1.4 Add error handling: `RUN_NOT_FOUND` for invalid runId, `RUN_NOT_ACTIVE` for completed/failed runs
- [ ] 1.5 Write tests for steer RPC — success, dedup, non-existent run, non-active run

## 2. Frontend: TreeDAG Component

- [ ] 2.1 Create `TreeDAG` component (`dashboard/src/components/shared/TreeDAG.tsx`) — CSS flexbox layout + SVG connecting lines overlay
- [ ] 2.2 Implement node rendering: agent badge, task summary, elapsed time (live), status icon (running/completed/failed/timeout)
- [ ] 2.3 Implement SVG edge rendering: straight/curved lines between parent-child nodes with dynamic positioning via refs
- [ ] 2.4 Implement attachment badge on edges: file icon + tooltip (file name, type, size) when attachments exist
- [ ] 2.5 Implement node interaction: click → navigate to session detail (via panel-navigation); hover → highlight subtree
- [ ] 2.6 Implement truncation: maxNodes=50, "展开更多" link at truncated branches
- [ ] 2.7 Add dark mode support using CSS variables

## 3. Frontend: Subagents Panel Enhancement

- [ ] 3.1 Integrate TreeDAG into ActiveRunsTab — replace or augment flat run card list with topology view
- [ ] 3.2 Add view toggle: "List View" / "Topology View" (default: Topology when ≥2 runs with parent-child, else List)
- [ ] 3.3 Add Steer button to running nodes — opens SteerDialog with textarea + warning + confirm/cancel
- [ ] 3.4 Implement SteerDialog component — textarea for instruction, confirmation warning, loading state, success/error feedback
- [ ] 3.5 Extend `deck-subagents` store: add `steerRun(runId, instruction)` action calling `deck.subagents.steer` RPC
- [ ] 3.6 Add i18n keys for topology/steer features (zh-CN + en)

## 4. Frontend: Scheduler Panel (Cron + Heartbeat Merge)

- [ ] 4.1 Rename `CronPanel` → `SchedulerPanel` — update file name, component name, NavRail registration (AUTOMATE group)
- [ ] 4.2 Add top-level Tabs to SchedulerPanel: "Cron Jobs" (existing content) + "Heartbeat" (new)
- [ ] 4.3 Create `HeartbeatConfig` component — enabled toggle, interval input (minutes), active hours time range picker, delivery target agent selector, message template textarea
- [ ] 4.4 Create per-agent heartbeat override table below global config — add/edit/remove overrides with agent selector + custom interval
- [ ] 4.5 Implement heartbeat config save via `config.patch` to `agents.defaults.heartbeat` (global) and `agents.<id>.heartbeat` (per-agent)
- [ ] 4.6 Create `NextExecutionCountdown` component — shared between Cron and Heartbeat; live countdown (updates per second when < 1min, per minute otherwise)
- [ ] 4.7 Integrate countdown into CronJob cards (next run) and Heartbeat tab header (next heartbeat)
- [ ] 4.8 Handle edge cases: outside active hours → "Next: tomorrow HH:mm"; disabled → "已停用" muted
- [ ] 4.9 Extend `cron` store: add heartbeat config state + actions (`fetchHeartbeatConfig`, `updateHeartbeatConfig`)
- [ ] 4.10 Add i18n keys for scheduler/heartbeat features (zh-CN + en)

## 5. Frontend: Skills Operations

- [ ] 5.1 Create `InstallSkillDialog` component — searchable available skills list, version selector (optional), install button with progress indicator
- [ ] 5.2 Implement install action in skills store: call `skills.install({ name, version })`, handle progress/success/error
- [ ] 5.3 Add "Uninstall" action to installed skill items — confirmation dialog showing agent usage count + list
- [ ] 5.4 Add "Update" action to skills with available updates — version badge + update button with progress
- [ ] 5.5 Implement "Update All" button when multiple updates available — sequential update with per-skill status
- [ ] 5.6 Extend skills store: add `uninstallSkill(name)`, `updateSkill(name)`, `updateAllSkills()`, `fetchAvailableSkills()` actions

## 6. Frontend: Skill Detail View

- [ ] 6.1 Refactor SkillsPanel right side: selected skill → tabbed detail (Info | Config)
- [ ] 6.2 Implement `SkillInfoTab` — name, version, description, author, homepage, installed date, size
- [ ] 6.3 Implement dependencies section in SkillInfoTab — list with version constraints + installed status (✅ met / ❌ missing)
- [ ] 6.4 Implement environment variables section in SkillInfoTab — name, description, status (✅ set / ⚠️ not set)
- [ ] 6.5 SkillConfig becomes the "Config" tab in the detail view (existing behavior preserved)

## 7. Frontend: SkillMatrixTab Enhancement

- [ ] 7.1 Enhance SkillMatrixTab: Agent × Skill cross-table with ✅ (assigned) / ❌ (not assigned) / ⚪ (ineligible) cells
- [ ] 7.2 Implement click-to-toggle: clicking ✅/❌ cell → optimistic update via `deck.agents.skills.set` RPC
- [ ] 7.3 Implement ineligible tooltip: hover ⚪ cell → shows reason (missing dependency, incompatible agent type, etc.)
- [ ] 7.4 Add matrix search/filter: filter both agent rows and skill columns by search term
- [ ] 7.5 Add i18n keys for skill operations/detail/matrix features (zh-CN + en)

## 8. Integration & Testing

- [ ] 8.1 E2E test: Steer operation — steer running subagent → verify instruction injected → verify dedup on re-steer
- [ ] 8.2 E2E test: Topology view — verify DAG renders for multi-level subagent run → click node → navigate to session
- [ ] 8.3 E2E test: Scheduler — edit heartbeat config → verify saved → verify countdown updates
- [ ] 8.4 E2E test: Skills lifecycle — install skill → verify in list → update → verify version → uninstall → verify removed
- [ ] 8.5 E2E test: Skill matrix toggle — toggle assignment in matrix → verify agent skill config updated
- [ ] 8.6 Verify responsive layouts for all enhanced panels (desktop ≥1280px / tablet / mobile)
- [ ] 8.7 Verify dark mode rendering for TreeDAG, HeartbeatConfig, InstallSkillDialog
- [ ] 8.8 Test error states: steer on dead run, install failure, heartbeat config with invalid interval

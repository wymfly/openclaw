# Deck Subagent/Scheduler/Skills Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Subagents (DAG topology + steer), Cron→Scheduler (heartbeat merge + countdown), and Skills (install/update + detail + matrix) panels in openclaw-deck.

**Architecture:** Backend adds 1 new RPC (`deck.subagents.steer`) with 60s idempotency dedup. Frontend enhances 3 existing panels with new components (TreeDAG, HeartbeatConfig, SkillInfoTab) and store extensions. All config writes use existing `config.patch` mechanism.

**Tech Stack:** Next.js 16+ / React 19 / Zustand 5 / Tailwind v4 / next-intl / shadcn/ui / SVG for DAG edges

**Skill 依赖：**

| 域         | Skills                                                              | 加载方式         |
| ---------- | ------------------------------------------------------------------- | ---------------- |
| [backend]  | superpowers:test-driven-development                                 | session 首次加载 |
| [frontend] | frontend-design, ui-ux-pro-max, superpowers:test-driven-development | session 首次加载 |

**Dashboard 规范（`dashboard/CLAUDE.md`）：**

- 所有用户可见文字必须通过 `useTranslations()` — 禁止硬编码
- 颜色使用 CSS 变量 `var(--xxx)` — 禁止硬编码色值
- 无 `<button>` 嵌套 — 检查 Tooltip/Collapsible 内部
- 新 Gateway RPC 必须同步加入 `gateway-allowlist.ts`

---

## File Structure

### New Files

| File                                                                   | Responsibility                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/gateway/server-methods/deck/subagents-steer.ts`                   | `deck.subagents.steer` RPC handler + dedup                    |
| `src/gateway/server-methods/deck/subagents-steer.test.ts`              | Steer RPC unit tests                                          |
| `dashboard/src/components/shared/TreeDAG.tsx`                          | Reusable DAG topology visualization (CSS flexbox + SVG edges) |
| `dashboard/src/components/panels/subagents/SteerDialog.tsx`            | Steer instruction dialog                                      |
| `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx`         | Renamed/enhanced CronPanel with tabs                          |
| `dashboard/src/components/panels/scheduler/HeartbeatConfig.tsx`        | Heartbeat config form                                         |
| `dashboard/src/components/panels/scheduler/NextExecutionCountdown.tsx` | Shared countdown component                                    |
| `dashboard/src/components/panels/skills/SkillInfoTab.tsx`              | Skill metadata detail tab                                     |
| `dashboard/src/components/panels/skills/InstallSkillDialog.tsx`        | Skill install dialog                                          |

### Modified Files

| File                                                          | Changes                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/gateway/server-methods-list.ts`                          | Add `deck.subagents.steer`                                             |
| `src/gateway/method-scopes.ts`                                | Add `deck.subagents.steer` to ADMIN scope                              |
| `src/gateway/server-methods/deck/index.ts`                    | Re-export steer handler                                                |
| `dashboard/server/gateway-allowlist.ts`                       | Add `deck.subagents.steer`                                             |
| `dashboard/src/app/api/deck/subagents/route.ts`               | Add `steer` action to POST handler                                     |
| `dashboard/src/stores/deck-subagents.ts`                      | Add `steerRun` action                                                  |
| `dashboard/src/stores/cron.ts`                                | Add heartbeat config state + actions                                   |
| `dashboard/src/stores/skills.ts`                              | Minor: InstallSkillDialog uses existing `fetchSkills` + `installSkill` |
| `dashboard/src/components/panels/subagents/ActiveRunsTab.tsx` | Add topology view toggle + steer button                                |
| `dashboard/src/components/panels/skills/SkillsPanel.tsx`      | Refactor to tabbed detail view                                         |
| `dashboard/src/components/panels/skills/SkillMatrixTab.tsx`   | Add search/filter + ineligible tooltip                                 |
| `dashboard/src/components/layout/NavRail.tsx`                 | Rename cron → scheduler                                                |
| `dashboard/src/stores/ui.ts`                                  | Add `scheduler` to Panel union, replace `cron`                         |
| `dashboard/src/app/page.tsx`                                  | Replace CronPanel import with SchedulerPanel                           |
| `dashboard/src/i18n/zh.json`                                  | Add scheduler/subagents-steer/skills-ops keys                          |
| `dashboard/src/i18n/en.json`                                  | Add scheduler/subagents-steer/skills-ops keys                          |

### Deleted Files

| File                                                 | Reason                     |
| ---------------------------------------------------- | -------------------------- |
| `dashboard/src/components/panels/cron/CronPanel.tsx` | Replaced by SchedulerPanel |

---

## Cross-File Matrix

| File                                            | T1  | T2  | T3  | T4  | T5  | T6  | T7  | T8  | T9  |
| ----------------------------------------------- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `server-methods/deck/subagents-steer.ts`        | ✏️  |     |     |     |     |     |     |     |     |
| `server-methods-list.ts` + `method-scopes.ts`   | ✏️  |     |     |     |     |     |     |     |     |
| `protocol/schema/deck.ts` + `protocol/index.ts` | ✏️  |     |     |     |     |     |     |     |     |
| `gateway-allowlist.ts`                          | ✏️  |     |     |     |     |     |     |     |     |
| `api/deck/subagents/route.ts`                   | ✏️  |     |     |     |     |     |     |     |     |
| `components/shared/TreeDAG.tsx`                 |     | ✏️  |     |     |     |     |     |     |     |
| `stores/deck-subagents.ts`                      |     |     | ✏️  |     |     |     |     |     |     |
| `panels/subagents/ActiveRunsTab.tsx`            |     |     | ✏️  |     |     |     |     |     |     |
| `panels/subagents/SteerDialog.tsx`              |     |     | ✏️  |     |     |     |     |     |     |
| `stores/ui.ts`                                  |     |     |     | ✏️  |     |     |     |     |     |
| `layout/NavRail.tsx`                            |     |     |     | ✏️  |     |     |     |     |     |
| `app/page.tsx`                                  |     |     |     | ✏️  |     |     |     |     |     |
| `panels/scheduler/SchedulerPanel.tsx`           |     |     |     | ✏️  |     |     |     |     |     |
| `panels/scheduler/HeartbeatConfig.tsx`          |     |     |     |     | ✏️  |     |     |     |     |
| `panels/scheduler/NextExecutionCountdown.tsx`   |     |     |     |     | ✏️  |     |     |     |     |
| `stores/cron.ts`                                |     |     |     |     | ✏️  |     |     |     |     |
| `stores/skills.ts`                              |     |     |     |     |     | ✏️  |     |     |     |
| `panels/skills/InstallSkillDialog.tsx`          |     |     |     |     |     | ✏️  |     |     |     |
| `panels/skills/SkillsPanel.tsx`                 |     |     |     |     |     |     | ✏️  |     |     |
| `panels/skills/SkillInfoTab.tsx`                |     |     |     |     |     |     | ✏️  |     |     |
| `panels/skills/SkillMatrixTab.tsx`              |     |     |     |     |     |     |     | ✏️  |     |
| `i18n/zh.json`                                  |     |     |     |     |     |     |     |     | ✏️  |
| `i18n/en.json`                                  |     |     |     |     |     |     |     |     | ✏️  |

**Parallel groups (no file conflicts):**

- T2 (TreeDAG) + T4-T5 (Scheduler rename + Heartbeat) + T6 (Skills store) + T7 (Skills detail) + T8 (SkillMatrix) — all independent file sets
- T3 (Subagents panel) depends on T1 (steer RPC) + T2 (TreeDAG)
- T9 (i18n) touches shared i18n files — must run serial after T2-T8

---

## Task Dependency Graph

```
T1 (Backend: Steer RPC)
  ↓
T2 (TreeDAG component)  ─────────┐
  ↓                               │ (parallel with T4, T5, T6, T7, T8)
T3 (Subagents panel)              │
                                  │
T4 (Scheduler rename + migration) │
T5 (HeartbeatConfig + Countdown)  │ (T5 depends on T4)
                                  │
T6 (Skills store + InstallDialog) │
T7 (Skills detail view)           │ (T7 depends on T6)
T8 (SkillMatrix enhancement)     ─┘
  ↓
T9 (i18n — all keys)
  ↓
T10 (Integration & Verification)
```

---

### Task 1: Backend — `deck.subagents.steer` RPC [backend]

**covers:** subagent-topology > deck.subagents.steer RPC > "Successful steer", "Steer non-existent run", "Dedup within window"

**Files:**

- Create: `src/gateway/server-methods/deck/subagents-steer.ts`
- Create: `src/gateway/server-methods/deck/subagents-steer.test.ts`
- Modify: `src/gateway/server-methods/deck/index.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`
- Modify: `src/gateway/protocol/schema/deck.ts` — add `DeckSubagentsSteerParamsSchema`
- Modify: `src/gateway/protocol/index.ts` — compile steer validator
- Modify: `dashboard/server/gateway-allowlist.ts`
- Modify: `dashboard/src/app/api/deck/subagents/route.ts`

- [ ] **Step 1: Write steer RPC handler test**

Create `src/gateway/server-methods/deck/subagents-steer.test.ts` with tests for:

- Successful steer returns `{ success: true, dedupKey }`
- Dedup within 60s returns `{ success: true, deduped: true }`
- Non-existent run returns `RUN_NOT_FOUND` error
- Completed run returns `RUN_NOT_ACTIVE` error
- Different instructions within 60s are NOT deduped

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test src/gateway/server-methods/deck/subagents-steer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement steer handler**

Create `src/gateway/server-methods/deck/subagents-steer.ts`:

- Import `getSubagentRunsForDeck` from `../../../agents/subagent-registry.js`
- Import `markSubagentRunForSteerRestart`, `replaceSubagentRunAfterSteer` from `../../../agents/subagent-registry.js`
- Import `abortEmbeddedPiRun`, `clearSessionQueues` from `../../../agents/pi-embedded-runner/index.js` (or corresponding path)
- Import `createHash` from `node:crypto` for SHA-256
- Implement `deck.subagents.steer` handler:
  1. Validate params (runId: string, instruction: string)
  2. Look up run in registry — error `RUN_NOT_FOUND` if missing
  3. Check if run is active (no endedAt) — error `RUN_NOT_ACTIVE` if ended
  4. Compute dedup key: `sha256(runId + ":" + instruction)`
  5. Check in-memory `Map<string, { result, expiresAt }>` — if found and not expired, return `{ success: true, deduped: true }`
  6. Store dedup entry with 60s TTL
  7. Execute steer-restart flow (reuse existing mechanism from `src/agents/tools/subagents-tool.ts:600-681`):
     - `markSubagentRunForSteerRestart(runId)` — mark the current run for steer restart
     - `abortEmbeddedPiRun(childSessionKey)` — abort the current agent turn
     - `clearSessionQueues(childSessionKey)` — clear pending queues
     - Initiate a new run via Gateway internal `agent` method, passing `instruction` as the message
     - `replaceSubagentRunAfterSteer({ previousRunId, nextRunId })` — link the old and new runs
  8. Return `{ success: true, dedupKey }`
- Implement lazy sweep: every 60s, remove expired dedup entries

> **Important:** The steer mechanism wraps abort+restart — it aborts the current agent turn and restarts with the injected instruction as a new user message. Reference `src/agents/tools/subagents-tool.ts:600-681` for the canonical steer-restart flow. Do NOT use SessionManager.appendMessage or EventBus injection — use the steer-restart functions from `subagent-registry.js` and `pi-embedded-runner`.

- [ ] **Step 4: Register RPC method + protocol schema**

Add `DeckSubagentsSteerParamsSchema` to `src/gateway/protocol/schema/deck.ts` (TypeBox schema for `{ runId: string, instruction: string }`).

Compile the steer validator in `src/gateway/protocol/index.ts`.

Add `"deck.subagents.steer"` to:

- `src/gateway/server-methods-list.ts` — in the `deck.subagents` section
- `src/gateway/method-scopes.ts` — in the ADMIN scope array (same section as `deck.subagents.kill`)
- `src/gateway/server-methods/deck/index.ts` — import and spread `deckSubagentsSteerHandlers`

- [ ] **Step 5: Add to gateway allowlist and API route**

Add `"deck.subagents.steer"` to `dashboard/server/gateway-allowlist.ts` DEFAULT_METHOD_ALLOWLIST.

Add `"steer"` action to `dashboard/src/app/api/deck/subagents/route.ts` POST handler:

```typescript
case "steer":
  return gatewayRequest("deck.subagents.steer", params);
```

Update `SubagentAction` type to include `"steer"`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test src/gateway/server-methods/deck/subagents-steer.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `pnpm test`
Expected: All existing tests still pass

- [ ] **Step 8: Commit**

```bash
git add src/gateway/server-methods/deck/subagents-steer.ts src/gateway/server-methods/deck/subagents-steer.test.ts src/gateway/server-methods/deck/index.ts src/gateway/server-methods-list.ts src/gateway/method-scopes.ts src/gateway/protocol/schema/deck.ts src/gateway/protocol/index.ts dashboard/server/gateway-allowlist.ts dashboard/src/app/api/deck/subagents/route.ts
git commit -m "[enhanced] [impl] feat(deck): add deck.subagents.steer RPC with 60s idempotency dedup"
```

---

### Task 2: Frontend — TreeDAG Shared Component [frontend]

**covers:** subagent-topology > ActiveRunsTab displays DAG topology visualization > "Display topology with active runs", "Large topology truncation"; Attachment transfer visualization on DAG edges > T2 (UI ready, data source pending — SubagentRun has no attachments field)

**Files:**

- Create: `dashboard/src/components/shared/TreeDAG.tsx`

- [ ] **Step 1: Create TreeDAG component**

Build `dashboard/src/components/shared/TreeDAG.tsx`:

**Props interface:**

```typescript
interface TreeDAGNode {
  id: string;
  parentId: string | null;
  label: string; // agent name
  sublabel?: string; // task summary
  status: "active" | "completed" | "failed" | "timeout";
  startedAt?: number;
  durationMs?: number;
  attachments?: Array<{ name: string; type: string; size: number }>;
  sessionKey?: string;
}

interface TreeDAGProps {
  nodes: TreeDAGNode[];
  maxNodes?: number; // default 50
  onNodeClick?: (node: TreeDAGNode) => void;
  highlightNodeId?: string | null;
  renderActions?: (node: TreeDAGNode) => React.ReactNode;
}
```

**Layout:** CSS flexbox tree (similar to existing `LineageTree.tsx` pattern) with:

- Each node rendered as a card: status icon (use same `statusIcons` map), agent badge, task summary, elapsed time
- Elapsed time: if `status === "active"`, show live-updating time since `startedAt` using `useEffect` + `setInterval`
- SVG overlay connecting parent-child nodes using `useRef` + `useLayoutEffect` to compute positions
- Curved bezier paths (quadratic) from parent bottom-center to child top-center
- Attachment badge: on edges where `attachments.length > 0`, render a small file icon midway along the edge; wrap in `Tooltip` showing file details

**Interaction:**

- `onClick` → calls `onNodeClick(node)` if provided
- `onMouseEnter` → highlights subtree (add CSS class to descendants)
- Truncation: if `nodes.length > maxNodes`, render first `maxNodes` and show a "展开更多" link (i18n key `common.showMore`)

**Dark mode:** All colors via CSS variables (`var(--bg-secondary)`, `var(--border)`, `var(--accent)`, etc.)

**Status colors:** Use existing convention:

- active: `var(--accent)` (blue)
- completed: `var(--success)` (green)
- failed: `var(--danger)` (red)
- timeout: `var(--warning)` (yellow)

- [ ] **Step 2: Verify TreeDAG compiles**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors from TreeDAG.tsx

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/shared/TreeDAG.tsx
git commit -m "[enhanced] [impl] feat(deck): add TreeDAG shared component — SVG edges + CSS flexbox layout"
```

---

### Task 3: Frontend — Subagents Panel Enhancement [frontend]

**covers:** subagent-topology > ActiveRunsTab displays DAG topology visualization > "Display topology with active runs", "Empty topology"; Click-to-inspect > "Inspect running subagent", "Inspect completed subagent"; Steer operation > "Steer a running subagent", "Steer confirmation dialog", "Steer on non-running subagent"

**Depends on:** T1 (steer RPC), T2 (TreeDAG component)

**Files:**

- Create: `dashboard/src/components/panels/subagents/SteerDialog.tsx`
- Modify: `dashboard/src/components/panels/subagents/ActiveRunsTab.tsx`
- Modify: `dashboard/src/stores/deck-subagents.ts`

- [ ] **Step 1: Add `steerRun` action to store**

In `dashboard/src/stores/deck-subagents.ts`:

- Add `steerRun: (runId: string, instruction: string) => Promise<{ success: boolean; deduped?: boolean } | null>` to the interface
- Implement: POST to `/api/deck/subagents` with `action: "steer"`, `runId`, `instruction`
- Return response data or null on error

- [ ] **Step 2: Create SteerDialog component**

Create `dashboard/src/components/panels/subagents/SteerDialog.tsx`:

- Uses `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogFooter` from shadcn
- Props: `open: boolean`, `onOpenChange`, `runId: string`, `onSteer: (instruction: string) => Promise<void>`
- Contains:
  - `<textarea>` for instruction (controlled state, auto-focus)
  - Warning text using `t("steerWarning")` — styled with `var(--warning)` background
  - Cancel button (ghost variant)
  - Confirm button (default variant, disabled when textarea empty or loading)
  - Loading state: shows spinner during API call
  - Success: toast via `useNotificationsStore`, then close dialog
  - Error: show inline error message

- [ ] **Step 3: Enhance ActiveRunsTab with topology toggle + steer**

Modify `dashboard/src/components/panels/subagents/ActiveRunsTab.tsx`:

Add view toggle ("List" / "Topology"):

- State: `viewMode: "list" | "topology"` — default "topology" when `activeRuns.length >= 2` and any run has `requesterSessionKey`, else "list"
- In toolbar, add two icon buttons for switching view

Add topology view using TreeDAG:

- Build DAG directly from `activeRuns` data (already available via polling, no extra API call needed):
  ```typescript
  const dagNodes: TreeDAGNode[] = activeRuns.map((run) => ({
    id: run.runId,
    parentId: activeRuns.find((r) => r.childSessionKey === run.requesterSessionKey)?.runId ?? null,
    label: run.childAgentName ?? run.childAgentId,
    sublabel: run.task,
    status: run.status,
    startedAt: run.startedAt ?? run.createdAt,
    durationMs: run.durationMs,
    sessionKey: run.childSessionKey,
  }));
  ```
- `onNodeClick` → `navigateToSession(node.sessionKey)`
- `renderActions` → for active nodes, render a small "Steer" button that opens SteerDialog
- For non-active nodes, render Steer button disabled with tooltip from i18n

Steer button on running nodes:

- Only show on nodes with `status === "active"`
- Disabled tooltip for non-active: `t("steerDisabledTooltip")`

- [ ] **Step 4: Fix existing i18n and theme violations in ActiveRunsTab**

While editing `ActiveRunsTab.tsx`, fix these pre-existing issues:

- Replace hardcoded strings: "All Agents" → `t("allAgents")`, "All Status" → `t("allStatus")`, "Active:" → `t("activeCount")`, "No active runs" → `t("noActiveRuns")`, "Cancel" → `tc("cancel")`
- Replace hardcoded colors: `bg-blue-500/15 text-blue-400 border-blue-500/25` → use CSS variables `bg-[var(--accent-muted)] text-[var(--accent)] border-[var(--accent)]/25`

These i18n keys are already defined in T9.

- [ ] **Step 5: Verify compilation**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/deck-subagents.ts dashboard/src/components/panels/subagents/SteerDialog.tsx dashboard/src/components/panels/subagents/ActiveRunsTab.tsx
git commit -m "[enhanced] [impl] feat(deck): enhance Subagents panel — topology view toggle + steer dialog"
```

---

### Task 4: Frontend — Scheduler Panel Rename + Migration [frontend]

**covers:** scheduler-merge > CronPanel renamed to SchedulerPanel with Heartbeat Tab > "Panel displays with two sections", "Cron Jobs tab preserves existing behavior"

**Files:**

- Create: `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx`
- Move: `dashboard/src/components/panels/cron/JobList.tsx` → `dashboard/src/components/panels/scheduler/JobList.tsx`
- Move: `dashboard/src/components/panels/cron/JobForm.tsx` → `dashboard/src/components/panels/scheduler/JobForm.tsx`
- Move: `dashboard/src/components/panels/cron/RunHistory.tsx` → `dashboard/src/components/panels/scheduler/RunHistory.tsx`
- Move: `dashboard/src/components/panels/cron/RunNowButton.tsx` → `dashboard/src/components/panels/scheduler/RunNowButton.tsx`
- Delete: `dashboard/src/components/panels/cron/CronPanel.tsx`
- Modify: `dashboard/src/stores/ui.ts`
- Modify: `dashboard/src/components/layout/NavRail.tsx`
- Modify: `dashboard/src/app/page.tsx`

- [ ] **Step 1: Create scheduler directory and move cron components**

```bash
mkdir -p dashboard/src/components/panels/scheduler
mv dashboard/src/components/panels/cron/JobList.tsx dashboard/src/components/panels/scheduler/
mv dashboard/src/components/panels/cron/JobForm.tsx dashboard/src/components/panels/scheduler/
mv dashboard/src/components/panels/cron/RunHistory.tsx dashboard/src/components/panels/scheduler/
mv dashboard/src/components/panels/cron/RunNowButton.tsx dashboard/src/components/panels/scheduler/
```

- [ ] **Step 2: Create SchedulerPanel with top-level Tabs**

Create `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx`:

- Top-level tabs: "Cron Jobs" (`t("scheduler.cronJobs")`) + "Heartbeat" (`t("scheduler.heartbeat")`)
- Cron Jobs tab: contains the exact same layout as current CronPanel (sidebar JobList + detail area with JobForm/RunHistory) — port the logic from CronPanel.tsx
- Heartbeat tab: placeholder `<div>` for now (Step 3 of T5 will implement HeartbeatConfig)
- Uses `useTranslations("scheduler")` for new namespace, `useTranslations("cron")` for existing cron keys

- [ ] **Step 3: Atomic Panel type migration (ui.ts + NavRail + page.tsx — must be done together)**

All three files must be updated before running `tsc`, because removing `"cron"` from the Panel union type while other files still reference it will cause type errors. Additionally, the `nav.scheduler` i18n key must be added to both `zh.json` and `en.json` at this step (not deferred to T9) to avoid HeaderBar displaying an empty title.

In `dashboard/src/stores/ui.ts`:

- Replace `"cron"` with `"scheduler"` in the Panel union type
- Add localStorage migration: on load, if saved panel is `"cron"`, convert to `"scheduler"`

In `dashboard/src/components/layout/NavRail.tsx`:

- Change the `automate` group entry from `{ panel: "cron", labelKey: "cron", icon: Clock }` to `{ panel: "scheduler", labelKey: "scheduler", icon: Clock }`

In `dashboard/src/app/page.tsx` (done atomically with above):

- Replace `LazyCronPanel` with `LazySchedulerPanel` (Step 5 content done here)

- [ ] **Step 5: Update page.tsx**

In `dashboard/src/app/page.tsx`:

- Replace `LazyCronPanel` lazy import (uses `React.lazy()`, NOT `dynamic()`) with `LazySchedulerPanel`:
  ```typescript
  const LazySchedulerPanel = lazy(() =>
    import("@/components/panels/scheduler/SchedulerPanel").then((m) => ({
      default: m.SchedulerPanel,
    })),
  );
  ```
- In the switch/rendering logic, replace `case "cron"` with `case "scheduler"` → render `LazySchedulerPanel`

> **Note:** `useKeyboardShortcuts.ts` does NOT contain "cron" in its `NAV_PANELS` array — no changes needed there.

- [ ] **Step 5: Delete old CronPanel**

```bash
rm dashboard/src/components/panels/cron/CronPanel.tsx
rmdir dashboard/src/components/panels/cron 2>/dev/null || true
```

- [ ] **Step 6: Verify compilation**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add -A dashboard/src/components/panels/scheduler/ dashboard/src/components/panels/cron/ dashboard/src/stores/ui.ts dashboard/src/components/layout/NavRail.tsx dashboard/src/app/page.tsx
git commit -m "[enhanced] [impl] feat(deck): rename CronPanel → SchedulerPanel with top-level Cron/Heartbeat tabs"
```

---

### Task 5: Frontend — HeartbeatConfig + NextExecutionCountdown [frontend]

**covers:** scheduler-merge > Heartbeat configuration UI > "Display global heartbeat config", "Edit heartbeat interval", "Set active hours", "Select delivery target", "Disable heartbeat"; Per-agent heartbeat override > "Add per-agent override", "Remove per-agent override"; Next-execution countdown > "Cron job countdown", "Heartbeat countdown", "Outside active hours", "Disabled schedule"

**Depends on:** T4 (SchedulerPanel exists)

**Files:**

- Create: `dashboard/src/components/panels/scheduler/HeartbeatConfig.tsx`
- Create: `dashboard/src/components/panels/scheduler/NextExecutionCountdown.tsx`
- Modify: `dashboard/src/stores/cron.ts`
- Modify: `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx` (wire Heartbeat tab)

- [ ] **Step 1: Extend cron store with heartbeat state**

In `dashboard/src/stores/cron.ts`, add:

```typescript
interface HeartbeatConfig {
  enabled: boolean; // UI-derived field (true when `every` is set), not a schema field
  every?: string; // e.g. "30m", "1h"
  activeHours?: { start?: string; end?: string; timezone?: string };
  target?: string; // agent ID
  prompt?: string; // message template
  model?: string;
  session?: string;
}

interface HeartbeatOverride {
  agentId: string;
  agentName?: string;
  every?: string;
}
```

Add to CronState:

- `heartbeatConfig: HeartbeatConfig | null`
- `heartbeatOverrides: HeartbeatOverride[]`
- `heartbeatLoading: boolean`
- `fetchHeartbeatConfig: () => Promise<void>` — calls `/api/config` (GET, which calls `config.get`), extracts `agents.defaults.heartbeat` from the returned config object
- `updateHeartbeatConfig: (patch: Partial<HeartbeatConfig>) => Promise<boolean>` — calls `/api/config/patch` (POST with `{ patch: { agents: { defaults: { heartbeat: { ...patch } } } } }`). The existing `/api/config/patch/route.ts` forwards to the Gateway's `config.patch` RPC.
- `addHeartbeatOverride: (agentId: string, every: string) => Promise<boolean>` — config structure uses `agents.list[]` array, not `agents.<id>`. Implementation must: read full config via `config.get` → find the matching agent entry in `agents.list[]` → modify its `heartbeat` field → patch the entire `agents.list` array back via `config.patch`.
- `removeHeartbeatOverride: (agentId: string) => Promise<boolean>` — same read-modify-write pattern: read full config → find agent in `agents.list[]` → set its `heartbeat` to null → patch back

- [ ] **Step 2: Create NextExecutionCountdown component**

Create `dashboard/src/components/panels/scheduler/NextExecutionCountdown.tsx`:

- Props: `nextRunAtMs: number | undefined`, `disabled?: boolean`, `activeHours?: { start: string; end: string }`
- Uses `useEffect` + `setInterval`:
  - When remaining time < 1 minute → update every second
  - When remaining time >= 1 minute → update every minute
- Display formats:
  - Normal: "2h 15m" / "45s"
  - Outside active hours: "明天 09:00" (`t("scheduler.nextTomorrow", { time: "09:00" })`)
  - Disabled: `t("scheduler.disabled")` with muted style
- All text via i18n

- [ ] **Step 3: Create HeartbeatConfig component**

Create `dashboard/src/components/panels/scheduler/HeartbeatConfig.tsx`:

- Uses `useTranslations("scheduler")`
- Layout:
  1. **Global config card:**
     - Enabled toggle (`Switch` component) — derives from presence of `every` field
     - `every` input (string input, e.g. "30m", "1h")
     - Active hours time range picker (two `<input type="time">` for start/end, plus timezone)
     - Delivery target agent selector (`Select` with agents list from `useAgentsStore`) — maps to `target` field
     - Prompt textarea — maps to `prompt` field
     - Model selector (optional) — maps to `model` field
     - Save button → calls `updateHeartbeatConfig`
  2. **Per-agent overrides table:**
     - Table rows: agent name, custom `every` value, Remove button
     - "Add Override" button → opens inline form with agent selector + `every` input
     - Remove → confirmation dialog → calls `removeHeartbeatOverride`
  3. **NextExecutionCountdown** at top of card

- [ ] **Step 4: Wire HeartbeatConfig into SchedulerPanel**

In `dashboard/src/components/panels/scheduler/SchedulerPanel.tsx`:

- Import HeartbeatConfig
- Replace Heartbeat tab placeholder with `<HeartbeatConfig />`

- [ ] **Step 5: Integrate countdown into cron job cards**

In the cron job detail area (within SchedulerPanel), add `<NextExecutionCountdown nextRunAtMs={selectedJob.nextRunAtMs} disabled={!selectedJob.enabled} />` near the job header.

- [ ] **Step 6: Verify compilation**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/stores/cron.ts dashboard/src/components/panels/scheduler/HeartbeatConfig.tsx dashboard/src/components/panels/scheduler/NextExecutionCountdown.tsx dashboard/src/components/panels/scheduler/SchedulerPanel.tsx
git commit -m "[enhanced] [impl] feat(deck): add HeartbeatConfig + NextExecutionCountdown to Scheduler panel"
```

---

### Task 6: Frontend — InstallSkillDialog [frontend]

**covers:** skills-operations > Install skill via UI > "Install a skill", "Install with specific version", "Install failure"

**Files:**

- Create: `dashboard/src/components/panels/skills/InstallSkillDialog.tsx`

No new API routes needed — `skills.status` (via existing `fetchSkills()`) already returns all known skills including `installOptions`. No new store actions needed — existing `installSkill(name, installId)` handles installation. `updateSkillVersion`, `updateAllSkills`, and `fetchAvailableSkills` are removed (Gateway's `skills.update` is config editing, not version upgrade; no version upgrade RPC exists).

Note: `uninstallSkill` is NOT implemented — `skills.uninstall` RPC does not exist in upstream Gateway. The UI will show "uninstall requires CLI" message instead.

Note: The existing `installSkill(name, installId)` action uses `installId` (not `version`). The `installId` comes from `skill.installOptions[].id`. The InstallSkillDialog must provide the `installId` from the selected install option, not a version string.

- [ ] **Step 1: Create InstallSkillDialog component**

Create `dashboard/src/components/panels/skills/InstallSkillDialog.tsx`:

- Props: `open: boolean`, `onOpenChange: (open: boolean) => void`
- Uses `useTranslations("skills")`
- On open, calls `fetchSkills()` to refresh the list — filter skills that have `installOptions` from the existing data
- Layout:
  - Search input to filter skills by name/description
  - List of skills that have `installOptions`: each row shows name, description, install option labels
  - Click install option → calls `installSkill(skill.name, option.id)` (uses existing store action with `installId`)
  - Loading state: spinner on the installing row
  - Success: toast + refresh skills list + close dialog
  - Error: show error message inline, dialog stays open for retry

- [ ] **Step 2: Verify compilation**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/skills/InstallSkillDialog.tsx
git commit -m "[enhanced] [impl] feat(deck): add InstallSkillDialog component"
```

---

### Task 7: Frontend — Skill Detail View [frontend]

**covers:** skills-operations > Skill detail view with metadata > "View skill info", "View skill dependencies", "View required environment variables", "Config tab preserves existing behavior"; Uninstall skill via UI > "Uninstall a skill" (degraded: CLI message)

**Depends on:** T6 (skills store extensions)

**Files:**

- Create: `dashboard/src/components/panels/skills/SkillInfoTab.tsx`
- Modify: `dashboard/src/components/panels/skills/SkillsPanel.tsx`

- [ ] **Step 1: Create SkillInfoTab component**

Create `dashboard/src/components/panels/skills/SkillInfoTab.tsx`:

- Props: `skill: SkillEntry`
- Uses `useTranslations("skills")`
- Sections:
  1. **Metadata header:** name, emoji, version (from config), description, author, homepage link, source badge, status dot
  2. **Dependencies section:** if `skill.missingRequirements` or `skill.installOptions` exist, list with ✅/❌ status icons
  3. **Environment variables:** if `skill.primaryEnv` exists, show name + set/not-set status
  4. **Actions:**
     - "Uninstall" note: since `skills.uninstall` RPC doesn't exist, show a muted info line: `t("uninstallViaCLI")` — "卸载请使用命令行: `openclaw skills uninstall <name>`"
     - No "Update" button — Gateway's `skills.update` is config editing, not version upgrade. No version upgrade RPC exists.

- [ ] **Step 2: Refactor SkillsPanel to tabbed detail view**

Modify `dashboard/src/components/panels/skills/SkillsPanel.tsx`:

- When a skill is selected, the right-side detail area now shows sub-tabs:
  - "Info" tab → `<SkillInfoTab skill={selectedSkill} />`
  - "Config" tab → `<SkillConfig skill={selectedSkill} />` (existing component, behavior preserved)
- Default to "Info" tab when selecting a new skill
- Add "Install Skill" button at top of skill list sidebar → opens `<InstallSkillDialog />`

- [ ] **Step 3: Verify compilation**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/skills/SkillInfoTab.tsx dashboard/src/components/panels/skills/SkillsPanel.tsx
git commit -m "[enhanced] [impl] feat(deck): add SkillInfoTab + refactor SkillsPanel to tabbed detail view"
```

---

### Task 8: Frontend — SkillMatrixTab Enhancement [frontend]

**covers:** skills-operations > Enhanced SkillMatrixTab with visual assignment > "Display skill matrix", "Toggle skill assignment", "Ineligible skill", "Matrix filter"

**Files:**

- Modify: `dashboard/src/components/panels/skills/SkillMatrixTab.tsx`

- [ ] **Step 1: Add search/filter to SkillMatrixTab**

In `dashboard/src/components/panels/skills/SkillMatrixTab.tsx`:

Add a search input above the matrix table:

- State: `searchTerm: string`
- Filter both agent columns and skill rows by search term (case-insensitive match on name)
- Use `Input` component with search icon, placeholder `t("skills.matrixSearch")`

- [ ] **Step 2: Add ineligible state (⚪) with tooltip + fix hardcoded Chinese**

Enhance `MatrixCell`:

- Currently handles: `mode === "all"` (blue circle), whitelist assigned (green check), whitelist not-assigned (red X)
- Add ineligible detection: if `skill.status === "disabled"` or `skill.missingRequirements?.length > 0`, render gray circle (`⚪`) instead of toggle
- Ineligible cell: not clickable, hover shows `Tooltip` with reason (`t("ineligibleReason")` + missing requirements list)

Fix existing i18n violation:

- Line 266: replace hardcoded `此 Agent 使用全部 Skill，需先到 Agent 详情切换为白名单模式` with `t("allModeTooltip")`
- Add `allModeTooltip` key to T9 i18n additions

- [ ] **Step 3: Verify compilation and i18n key usage**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/skills/SkillMatrixTab.tsx
git commit -m "[enhanced] [impl] feat(deck): enhance SkillMatrixTab — search filter + ineligible tooltips"
```

---

### Task 9: i18n — All New Keys [frontend]

**covers:** All tasks — i18n compliance per `dashboard/CLAUDE.md`

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add all new i18n keys**

Add the following namespaces/keys to both `zh.json` and `en.json`:

**`scheduler` namespace (new):**

- `title`: "调度" / "Scheduler"
- `cronJobs`: "定时任务" / "Cron Jobs"
- `heartbeat`: "心跳检测" / "Heartbeat"
- `heartbeatEnabled`: "启用心跳" / "Enable Heartbeat"
- `every`: "执行频率" / "Frequency"
- `activeHours`: "活跃时段" / "Active Hours"
- `activeHoursStart`: "开始时间" / "Start Time"
- `activeHoursEnd`: "结束时间" / "End Time"
- `deliveryTarget`: "投递目标" / "Delivery Target"
- `prompt`: "消息模板" / "Prompt Template"
- `overrides`: "Agent 覆盖" / "Agent Overrides"
- `addOverride`: "添加覆盖" / "Add Override"
- `removeOverride`: "移除覆盖" / "Remove Override"
- `confirmRemoveOverride`: "确定移除此 Agent 的心跳覆盖配置？" / "Remove this agent's heartbeat override?"
- `nextRun`: "下次执行" / "Next Run"
- `nextTomorrow`: "明天 {time}" / "Tomorrow {time}"
- `disabled`: "已停用" / "Disabled"
- `countdown.hours`: "{h}h {m}m" / "{h}h {m}m"
- `countdown.minutes`: "{m}m {s}s" / "{m}m {s}s"
- `countdown.seconds`: "{s}s" / "{s}s"

**`subagents` namespace additions:**

- `topologyView`: "拓扑视图" / "Topology View"
- `listView`: "列表视图" / "List View"
- `steer`: "注入指令" / "Steer"
- `steerTitle`: "注入指令到运行中的子智能体" / "Steer Running Subagent"
- `steerWarning`: "此操作会注入指令到运行中的子智能体，可能改变其行为。" / "This will inject an instruction into the running subagent, which may change its behavior."
- `steerPlaceholder`: "输入要注入的指令..." / "Enter instruction to inject..."
- `steerSuccess`: "指令已发送" / "Instruction sent"
- `steerDeduped`: "指令已发送（去重）" / "Instruction sent (deduped)"
- `steerDisabledTooltip`: "仅可对运行中的子智能体发送指令" / "Can only steer running subagents"
- `noActiveRuns`: "当前无活跃的子智能体运行" / "No active subagent runs"

**`skills` namespace additions:**

- `installSkill`: "安装技能" / "Install Skill"
- `uninstallViaCLI`: "卸载请使用命令行" / "Uninstall via CLI"
- `version`: "版本" / "Version"
- `author`: "作者" / "Author"
- `size`: "大小" / "Size"
- `installedDate`: "安装日期" / "Installed Date"
- `dependencies`: "依赖" / "Dependencies"
- `depMet`: "已满足" / "Met"
- `depMissing`: "缺失" / "Missing"
- `envVarsStatus`: "环境变量" / "Environment Variables"
- `envSet`: "已设置" / "Set"
- `envNotSet`: "未设置" / "Not Set"
- `infoTab`: "信息" / "Info"
- `configTab`: "配置" / "Config"
- `matrixSearch`: "搜索 Agent 或技能..." / "Search agents or skills..."
- `ineligibleReason`: "此技能不可分配" / "This skill cannot be assigned"
- `agentAssignment`: "Agent 分配" / "Agent Assignment"

**`common` namespace additions:**

- `showMore`: "展开更多" / "Show More"

**`nav` namespace updates:**

- `scheduler`: "调度" / "Scheduler" (add alongside existing `cron` key for backward compat)

**`subagents` namespace additions (existing violations fix):**

- `allAgents`: "全部 Agent" / "All Agents"
- `allStatus`: "全部状态" / "All Status"
- `activeCount`: "活跃" / "Active"

**`skills` namespace additions (existing violation fix):**

- `allModeTooltip`: "此 Agent 使用全部 Skill，需先到 Agent 详情切换为白名单模式" / "This agent uses all skills. Switch to allowlist mode in agent settings."

- [ ] **Step 2: Verify both files are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('dashboard/src/i18n/zh.json'))" && node -e "JSON.parse(require('fs').readFileSync('dashboard/src/i18n/en.json'))" && echo "OK"`
Expected: OK

- [ ] **Step 3: Grep for hardcoded strings in new components**

Run: `grep -rn '"All\|"No \|"Add\|"Remove\|"Save\|"Cancel\|"Update\|"Install' dashboard/src/components/panels/scheduler/ dashboard/src/components/panels/skills/InstallSkillDialog.tsx dashboard/src/components/panels/skills/SkillInfoTab.tsx dashboard/src/components/panels/subagents/SteerDialog.tsx dashboard/src/components/shared/TreeDAG.tsx 2>/dev/null | grep -v 'useTranslations\|t(' || echo "No hardcoded strings found"`
Expected: No hardcoded strings found (or only in non-user-visible code)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add i18n keys for scheduler, steer, and skills operations"
```

---

### Task 10: Integration & Verification [test]

**covers:** All specs — integration verification

**Depends on:** All previous tasks

**Files:** None (verification only)

- [ ] **Step 1: TypeScript compilation check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero new errors

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: All tests pass (including new steer RPC tests)

- [ ] **Step 3: Lint and format check**

Run: `pnpm check`
Expected: No lint/format errors

- [ ] **Step 4: Verify no stale panel references**

Run: `grep -rn '"cron"' dashboard/src/ --include="*.ts" --include="*.tsx" | grep -v 'i18n\|cron\.\|cronJobs\|CronJob\|CronSchedule\|CronRunEntry\|CronStatus\|/cron\|fetchJobs\|useCron' || echo "No stale cron panel references"`
Expected: No stale references to old "cron" panel type

- [ ] **Step 5: Verify gateway allowlist includes new method**

Run: `grep "deck.subagents.steer" dashboard/server/gateway-allowlist.ts`
Expected: Found

- [ ] **Step 6: Verify NavRail has scheduler instead of cron**

Run: `grep "scheduler" dashboard/src/components/layout/NavRail.tsx`
Expected: Found

- [ ] **Step 7: Commit (if any fixes needed)**

Only if integration fixes were required.

---

## Requirement Coverage Matrix

| Spec              | Requirement                | Scenario                            | Task                               |
| ----------------- | -------------------------- | ----------------------------------- | ---------------------------------- |
| subagent-topology | DAG topology visualization | Display topology with active runs   | T2, T3                             |
| subagent-topology | DAG topology visualization | Empty topology                      | T3                                 |
| subagent-topology | DAG topology visualization | Large topology truncation           | T2                                 |
| subagent-topology | Click-to-inspect           | Inspect running subagent            | T3                                 |
| subagent-topology | Click-to-inspect           | Inspect completed subagent          | T3                                 |
| subagent-topology | Steer operation            | Steer a running subagent            | T1, T3                             |
| subagent-topology | Steer operation            | Steer confirmation dialog           | T3                                 |
| subagent-topology | Steer operation            | Steer idempotency dedup             | T1                                 |
| subagent-topology | Steer operation            | Steer on non-running subagent       | T3                                 |
| subagent-topology | Attachment visualization   | Display attachment on edge          | T2 (UI ready, data source pending) |
| subagent-topology | Attachment visualization   | No attachments                      | T2 (UI ready, data source pending) |
| subagent-topology | deck.subagents.steer RPC   | Successful steer                    | T1                                 |
| subagent-topology | deck.subagents.steer RPC   | Steer non-existent run              | T1                                 |
| subagent-topology | deck.subagents.steer RPC   | Dedup within window                 | T1                                 |
| scheduler-merge   | SchedulerPanel rename      | Panel displays with two sections    | T4                                 |
| scheduler-merge   | SchedulerPanel rename      | Cron Jobs tab preserves behavior    | T4                                 |
| scheduler-merge   | Heartbeat config UI        | Display global heartbeat config     | T5                                 |
| scheduler-merge   | Heartbeat config UI        | Edit heartbeat interval             | T5                                 |
| scheduler-merge   | Heartbeat config UI        | Set active hours                    | T5                                 |
| scheduler-merge   | Heartbeat config UI        | Select delivery target              | T5                                 |
| scheduler-merge   | Heartbeat config UI        | Disable heartbeat                   | T5                                 |
| scheduler-merge   | Per-agent override         | Add per-agent override              | T5                                 |
| scheduler-merge   | Per-agent override         | Remove per-agent override           | T5                                 |
| scheduler-merge   | Next-execution countdown   | Cron job countdown                  | T5                                 |
| scheduler-merge   | Next-execution countdown   | Heartbeat countdown                 | T5                                 |
| scheduler-merge   | Next-execution countdown   | Outside active hours                | T5                                 |
| scheduler-merge   | Next-execution countdown   | Disabled schedule                   | T5                                 |
| skills-operations | Install skill              | Install a skill                     | T6                                 |
| skills-operations | Install skill              | Install with specific version       | T6                                 |
| skills-operations | Install skill              | Install failure                     | T6                                 |
| skills-operations | Uninstall skill            | Uninstall a skill                   | T7 (degraded: CLI guidance text)   |
| skills-operations | Uninstall skill            | Uninstall confirmation shows usage  | T7 (degraded: CLI guidance text)   |
| skills-operations | Update skill               | Update available indicator          | removed: no backend RPC            |
| skills-operations | Update skill               | Update a skill                      | removed: no backend RPC            |
| skills-operations | Update skill               | Bulk update                         | removed: no backend RPC            |
| skills-operations | Skill detail view          | View skill info                     | T7                                 |
| skills-operations | Skill detail view          | View skill dependencies             | T7                                 |
| skills-operations | Skill detail view          | View required environment variables | T7                                 |
| skills-operations | Skill detail view          | Config tab preserves behavior       | T7                                 |
| skills-operations | Enhanced SkillMatrixTab    | Display skill matrix                | T8                                 |
| skills-operations | Enhanced SkillMatrixTab    | Toggle skill assignment             | T8                                 |
| skills-operations | Enhanced SkillMatrixTab    | Ineligible skill                    | T8                                 |
| skills-operations | Enhanced SkillMatrixTab    | Matrix filter                       | T8                                 |

**Orphan check:** All spec ADDED/MODIFIED WHEN/THEN scenarios are covered. `skills.uninstall` scenarios are degraded (CLI guidance text) per code alignment note. `skills.update` (version upgrade) scenarios are removed — no backend RPC exists. Attachment visualization is UI-ready but data source pending (SubagentRun has no attachments field).

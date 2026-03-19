# OpenClaw Deck Browser Functional Test Plan

## Agent Routing & Observability Features

**Document**: Comprehensive browser-based functional test specification
**Scope**: All interactive UI elements in the deck web dashboard
**Test Environment**: Browser-based (Chrome/Firefox/Safari), responsive (desktop/tablet/mobile)
**Date**: 2026-03-20

---

## 1. NAVIGATION & PANEL STRUCTURE

### 1.1 NavRail (Sidebar Navigation)

**Location**: `dashboard/src/components/layout/NavRail.tsx`

#### Interactive Elements:

- **Toggle Sidebar Button**: Collapse/expand sidebar on desktop
  - Test: Click, verify sidebar width changes
  - Responsive: Auto-collapse on tablet (≤1023px)
  - Mobile: Always visible, not collapsible

- **Grouped Navigation Menu** (4 groups):
  1. **Core**: Chat, Agents, Routing, Gateway, Models
  2. **Observe**: Subagents, Usage, Sessions, Memory, Logs, Activity
  3. **Automate**: Cron, Webhooks, Approvals, Skills
  4. **Control**: Budget, Alerts, Channels, Config, Docs
  5. **Settings** (separate, bottom of sidebar)

#### Test Cases:

- [ ] Click each nav item → active panel switches + group auto-expands
- [ ] Active panel is highlighted with accent color
- [ ] Group collapsible toggle works (click group title to expand/collapse)
- [ ] Collapsed sidebar shows icon-only tooltips
- [ ] Mobile nav: sheet overlay appears when triggered
- [ ] Mobile nav: closes after selecting a nav item
- [ ] Responsive: Sidebar collapses automatically at 1024px breakpoint

---

## 2. AGENTS PANEL

**Location**: `dashboard/src/components/panels/agents/`

### 2.1 Agent List (Master Sidebar)

#### Interactive Elements:

- **Create Agent Button** (top)
  - Shows inline form when clicked: Input field + Create/Cancel buttons
  - Test: Enter agent name, press Enter or click Create
  - Test: Click Cancel to dismiss form without creating
  - Test: Empty name validation (Create button disabled)
  - Test: Form clears after successful creation

- **Agent List Items** (scrollable)
  - Status dot (idle/busy/error/offline) with color coding
  - Agent name + model badge
  - Delete icon appears on hover
  - Selected state: accent background + left bar indicator
  - Click to select agent

#### Test Cases:

- [ ] Create agent with valid name → appears in list
- [ ] Delete agent → confirmation not shown in list (direct delete)
- [ ] Select different agents → detail pane updates
- [ ] Scroll agent list → no layout shift
- [ ] Status dots update in real-time (if backend supports)

### 2.2 Agent Detail (Master-Detail View)

#### Structure:

- **Header**: Agent name, ID, badges (Default/Status)
- **Tabbed Interface**:
  1. Overview Tab
  2. Routing Tab
  3. Skills Tab
  4. Subagent Tab
  5. Sessions Tab

#### 2.2.1 Overview Tab

**Interactive Elements**:

- Basic agent metadata display (read-only)
- Agent icon + status badge

**Test Cases**:

- [ ] Load agent detail → overview tab shows agent name & ID
- [ ] Status badge displays correctly (idle/busy/error/offline)

#### 2.2.2 Routing Tab

**Location**: `dashboard/src/components/panels/agents/tabs/RoutingTab.tsx`

**Interactive Elements**:

- **Add Binding Button**: Opens `BindingDialog` in "add" mode
  - Prefills agent ID
  - Test: Click, dialog opens with agent preselected

- **View All Routing Link**: Navigates to Routing panel (full view)
  - Test: Click → active panel becomes "routing"

- **Bindings List** (vertical stack):
  - Each binding shows:
    - Tier badge
    - Channel badge (e.g., "discord", "slack")
    - Account ID (if present)
    - Peer kind:id (if present, e.g., "direct:user123")
  - Delete icon appears on hover

**Test Cases**:

- [ ] Click "Add Binding" → BindingDialog opens with agentId prefilled
- [ ] Delete binding on hover → triggers removeBinding API + refetch
- [ ] Click "View All Routing" → navigates to Routing panel
- [ ] Bindings list loads & displays on tab mount
- [ ] Empty state: "No bindings" message shown if list is empty

#### 2.2.3 Skills Tab

**Location**: `dashboard/src/components/panels/agents/tabs/SkillsTab.tsx`

**Interactive Elements**:

- **Mode Switcher Card**:
  - Title: "All Skills" or "Whitelist"
  - Description text
  - Toggle switch (left = "all", right = "whitelist")
  - Test: Click switch → mode changes

- **Skill Checklist** (whitelist mode only):
  - Checkbox for each available skill
  - Skill name + eligibility badge
  - Eligibility states: ready (green checkmark) / missing_dep (warning)
  - Click skill row → toggles checkbox
  - Checked skills have accent ring

- **Save Button**:
  - Disabled if mode="all" (no changes needed)
  - Shows success feedback: "Save ✓" after save
  - Feedback auto-hides after 2s

**Test Cases**:

- [ ] Toggle mode switch: all → whitelist → all
- [ ] In whitelist mode: click skill → checkbox toggles
- [ ] Click skill → ring appears around row
- [ ] Save button enabled only after toggling something
- [ ] Click Save → updateSkills API called with mode + skills
- [ ] Success feedback shows "Save ✓" for 2s
- [ ] Switching agents → skill list reloads

#### 2.2.4 Subagent Tab

**Location**: `dashboard/src/components/panels/agents/tabs/SubagentTab.tsx`

**Interactive Elements**:

- **Global Defaults Form**:
  - maxSpawnDepth (number input)
  - maxChildrenPerAgent (number input)
  - maxConcurrent (number input)
  - archiveAfterMinutes (number input)
  - defaultModel (text input)
  - defaultThinking (select: none/low/medium/high)
  - Save button

- **Per-Agent Permissions Matrix**:
  - Rows: agent name
  - Columns: canSpawn (checkbox), maxDepth (number), maxChildren (number)
  - Each cell toggles or updates a permission
  - Save changes button

**Test Cases**:

- [ ] Load subagent config → form populates with defaults
- [ ] Edit global defaults → Save button becomes enabled
- [ ] Click Save → config.patch API called
- [ ] Per-agent permissions matrix loads for each agent
- [ ] Click checkbox in matrix → toggles permission
- [ ] Edit number field in matrix → updates maxDepth/maxChildren
- [ ] Save per-agent config → API call succeeds

#### 2.2.5 Sessions Tab

**Location**: `dashboard/src/components/panels/agents/tabs/SessionsTab.tsx`

**Interactive Elements**:

- **Session Filter Dropdown**:
  - Options: All / Direct (DM) / Group / Global (Channel) / Subagent
  - Test: Change filter → list updates

- **Sessions List** (vertical stack):
  - Each session card shows:
    - Kind badge (direct/group/global/unknown) with color coding
    - Session key (monospace, truncated)
    - Updated timestamp
    - Model name (monospace, if available)
    - tokensIn & tokensOut count
    - If subagent: Depth + Parent Agent badge
  - Click card → navigates to Sessions panel with this session selected

- **Session Count**: "X / Y" showing filtered / total

**Test Cases**:

- [ ] Filter by session type → list updates
- [ ] Click session card → navigates to Sessions panel
- [ ] Subagent session shows depth & parent agent
- [ ] Empty state: "No sessions" message if list is empty
- [ ] Token counts display with thousands separators

---

## 3. ROUTING PANEL

**Location**: `dashboard/src/components/panels/routing/RoutingPanel.tsx` (implied structure)

### 3.1 Bindings Tab (Channel → Agent)

**Location**: `dashboard/src/components/panels/channels/BindingsTab.tsx`

**Interactive Elements**:

- **Filter Bar**:
  - Channel dropdown (All channels / discord / slack / etc.)
  - Account dropdown (appears only when channel selected & has accounts)
  - "Add Binding" button
  - "View all routing rules" link (navigates to Routing panel)

- **Bindings Table**:
  - Columns: Channel/Peer | Target Agent | Tier | Actions
  - Each row:
    - Peer label (channel:peer:id or channel)
    - Account ID (if applicable)
    - Guild ID (if Discord)
    - Agent badge (with agent name/ID)
    - Tier badge
    - Delete button (trash icon)

- **Delete Confirmation Dialog**:
  - Title: "确认解绑?" (Confirm unbind?)
  - Message: "此操作将移除该路由绑定，确认继续？"
  - Cancel / Confirm buttons
  - Spinner shown during deletion

- **DM Policy Summary** (bottom):
  - Shield icon
  - Merge mode display
  - Paired users count

**Test Cases**:

- [ ] Select channel → accounts dropdown appears if available
- [ ] Select account → table filters to that account's bindings
- [ ] Click "Add Binding" → BindingDialog opens (mode="add")
- [ ] Dialog prefills channel/account from filter selection
- [ ] Delete binding → confirmation dialog appears
- [ ] Confirm delete → spinner shows + binding removed from table
- [ ] Empty state: "No bindings found" message
- [ ] DM Policy Summary displays merge mode & paired user count

---

## 4. SUBAGENTS PANEL

**Location**: `dashboard/src/components/panels/subagents/`

### 4.1 Active Runs Tab

**Location**: `dashboard/src/components/panels/subagents/ActiveRunsTab.tsx`

**Interactive Elements**:

- **Toolbar** (top):
  - Agent filter dropdown (All Agents / agent names)
  - Status filter dropdown (All Status / Active / Completed / Failed / Timeout)
  - Active count badge (dynamic color: blue if active count > 0)

- **Run Cards** (tree layout):
  - Nested indentation by depth
  - Each card shows:
    - Agent badge (childAgentId, childAgentName)
    - Status badge (Running/Done/Failed/Timeout) with icon & color
    - Elapsed time (live update every 1s for active runs)
    - Task description (if available)
    - Depth & model metadata
    - Buttons: "View Session" (always), "Terminate" (only if active)

- **Tree Structure**:
  - Roots (runs with no requesterSessionKey)
  - Children grouped under requesterSessionKey
  - Nested indentation (margin-left increases by 24px per level)

- **Lineage Visualization** (when run selected):
  - Shows below run cards
  - LineageTree component with parent-child relationships
  - Status icons: ✓ (completed), ✗ (failed), 🔄 (active), ⏱ (timeout)
  - Orphan nodes marked with dashed border + "(orphan)" label

- **Kill Confirmation Dialog**:
  - Title: "Kill"
  - Message: "Terminate run <runId>?"
  - Cancel / Kill buttons

**Test Cases**:

- [ ] Filter by agent → list updates to show only that agent's runs
- [ ] Filter by status → list updates
- [ ] Active count badge shows correct count (blue highlight if > 0)
- [ ] Click run card → lineage visualization appears below
- [ ] Run card shows live elapsed time (updates every 1s)
- [ ] Click "View Session" → navigates to Sessions panel
- [ ] Click "Terminate" on active run → kill dialog appears
- [ ] Confirm kill → runId passed to API + run removed from list
- [ ] Tree nesting: children indented, root level at 0 margin
- [ ] Lineage tree builds correctly from flat lineage nodes
- [ ] Orphan nodes (parentRunId points to non-existent parent) marked as orphan
- [ ] Polling starts on mount, stops on unmount
- [ ] Polling pauses when tab hidden, resumes when visible

### 4.2 History Tab

**Location**: `dashboard/src/components/panels/subagents/HistoryTab.tsx`

**Interactive Elements**:

- **Filter Bar**:
  - Time Range dropdown (1h / 6h / 24h / all)
  - Agent filter dropdown
  - Status filter dropdown
  - Visible count indicator

- **History Table**:
  - Each row shows: Agent | Status | Duration | Created | Outcome
  - Expandable rows (click to show task details)
  - Pagination: "Load more" button at bottom

**Test Cases**:

- [ ] Time range filter → table updates
- [ ] Agent filter → table updates
- [ ] Status filter → table updates
- [ ] Click row to expand → details shown
- [ ] Click "Load more" → next batch of 20 rows loaded
- [ ] Duration calculated correctly from startedAt/endedAt or durationMs

### 4.3 Config Tab

**Location**: `dashboard/src/components/panels/subagents/ConfigTab.tsx`

**Interactive Elements**:

- **Global Defaults Section**:
  - Form fields: maxSpawnDepth, maxChildrenPerAgent, maxConcurrent, archiveAfterMinutes, defaultModel, defaultThinking
  - Save button
  - Success feedback: "Saved ✓"

- **Per-Agent Permissions Matrix**:
  - Columns: Agent | Can Spawn | Max Depth | Max Children
  - Click cells to toggle/edit
  - Save all changes button

**Test Cases**:

- [ ] Load config on mount → form populates
- [ ] Edit global defaults → Save button enabled
- [ ] Click Save → config.patch API call succeeds
- [ ] Success feedback shows for 2s
- [ ] Per-agent permissions matrix loads for all agents
- [ ] Click checkbox → toggles permission
- [ ] Edit number field → updates value
- [ ] Save matrix changes → API call succeeds

---

## 5. SESSIONS PANEL

**Location**: `dashboard/src/components/panels/sessions/`

### 5.1 Session List (Sidebar)

**Location**: `dashboard/src/components/panels/sessions/SessionList.tsx`

**Interactive Elements**:

- Searchable list of sessions
- Each session shows type icon (DM/Group/Channel/Subagent), key, model

**Test Cases**:

- [ ] Click session → loads in detail pane
- [ ] Search filters sessions by key
- [ ] Session type icon displays correctly

### 5.2 Session Detail (Main Pane)

**Location**: `dashboard/src/components/panels/sessions/SessionDetail.tsx`

**Interactive Elements**:

- **Header**:
  - Session key (monospace, full title on hover)
  - Model name & updated timestamp
  - Delete button (with confirmation on second click)

- **Lineage Block** (subagent sessions only):
  - Section labeled "Subagent Lineage"
  - "View in Subagents panel" link (navigates to subagents panel)
  - LineageTree showing call hierarchy

- **Stats Section**:
  - Tokens In (formatted as K/M)
  - Tokens Out (formatted as K/M)
  - Context usage bar (color: green <60%, yellow 60-80%, red ≥80%)
  - Context percentage display

- **Conversation History**:
  - Scrollable message list
  - Each message: avatar (user/bot icon), content bubble, timestamp
  - User messages: right-aligned, accent color background
  - Bot messages: left-aligned, neutral background

- **Delete Confirmation**:
  - First click: button becomes destructive (red)
  - Second click: session deleted

**Test Cases**:

- [ ] Load session → detail pane populates
- [ ] Context bar shows correct percentage & color
- [ ] Tokens formatted with K/M notation
- [ ] Subagent session shows lineage block
- [ ] Click "View in Subagents panel" → navigates to subagents
- [ ] Conversation history displays correctly (user/bot distinction)
- [ ] Delete button first click → button becomes destructive
- [ ] Delete button second click → session deleted + panel clears
- [ ] Click elsewhere to cancel deletion → button resets

---

## 6. SHARED COMPONENTS

### 6.1 BindingDialog

**Location**: `dashboard/src/components/shared/BindingDialog.tsx`

**Interactive Elements**:

- **Form Fields**:
  - Target Agent (select dropdown)
  - Channel (select dropdown)
  - Account ID (optional text input)
  - Peer Kind & ID (2-column grid: select + text input)
  - Discord-specific: Guild ID + Roles (comma-separated)
  - Slack-specific: Team ID

- **Validation Display**:
  - Real-time validation (500ms debounce)
  - Success state: "Predicted tier: <tier>"
  - Error state: "Conflicts: [list of conflicts]"
  - Loading: "Validating..." badge

- **Action Buttons**:
  - Cancel (closes dialog)
  - Save/Add Rule (enabled only if channel + agentId selected)

**Test Cases**:

- [ ] Open dialog → agent prefilled (if from agent detail)
- [ ] Change channel → agent-specific fields appear/disappear
- [ ] Discord selected → Guild + Roles fields appear
- [ ] Slack selected → Team ID field appears
- [ ] Fill required fields → validation triggers after 500ms
- [ ] Validation success → tier shown
- [ ] Validation error → conflicts listed
- [ ] Fill all fields → Save button enabled
- [ ] Click Save → onSave callback fires with match & agentId
- [ ] Click Cancel → dialog closes

### 6.2 LineageTree

**Location**: `dashboard/src/components/shared/LineageTree.tsx`

**Interactive Elements**:

- Tree rendering with CSS borders (no interactive elements, display-only)
- Status icons: ✓ (completed), ✗ (failed), 🔄 (active), ⏱ (timeout)
- Agent name & depth display
- Orphan node detection (dashed border, "(orphan)" label)

**Test Cases**:

- [ ] Render flat lineage nodes → builds tree structure correctly
- [ ] Parent-child relationships respected (indentation)
- [ ] Orphan nodes identified (parentRunId points to non-existent node)
- [ ] Status icons display correctly
- [ ] Depth label shown (d0, d1, etc.)

### 6.3 SubagentRunCard

**Location**: `dashboard/src/components/shared/SubagentRunCard.tsx`

**Interactive Elements**:

- **Card Content**:
  - Agent badge (childAgentId, childAgentName)
  - Status badge (Running/Done/Failed/Timeout)
  - Elapsed time (live update for active)
  - Task description (if available)
  - Depth & model metadata

- **Action Buttons**:
  - "View Session" button (always visible)
  - "Terminate" button (only if status="active")

**Test Cases**:

- [ ] Card renders with all metadata
- [ ] Elapsed time updates live (every 1s) if status="active"
- [ ] Click "View Session" → onViewSession callback fires
- [ ] Click "Terminate" → onKill callback fires
- [ ] "Terminate" button appears only for active runs

### 6.4 AgentBadge

**Location**: `dashboard/src/components/shared/AgentBadge.tsx`

**Interactive Elements**:

- Compact badge showing agent name/ID
- Optional click handler to navigate to agent detail

**Test Cases**:

- [ ] Badge renders with agent name or ID
- [ ] Click navigates to agent panel (if handler provided)

### 6.5 TierBadge

**Location**: `dashboard/src/components/shared/TierBadge.tsx`

**Interactive Elements**:

- Displays binding tier (color-coded, if styles defined)

**Test Cases**:

- [ ] Badge renders with tier name
- [ ] Styling matches tier priority

---

## 7. DATA FLOW & API INTEGRATION

### 7.1 Stores

#### deck-routing Store

- `fetchBindings(agentId?)` → GET `/api/deck/routing`
- `addBinding(match, agentId, baseHash)` → POST `/api/deck/routing`
- `removeBinding(bindingId, baseHash)` → DELETE `/api/deck/routing`
- `validateBinding(match, agentId)` → POST `/api/deck/routing/validate`
- State: bindings[], configHash, dmScope, loading, validationResult

#### deck-subagents Store

- `fetchRuns(status?, requesterAgentId?)` → GET `/api/deck/subagents`
- `fetchLineage(params)` → POST `/api/deck/subagents` with action="lineage"
- `killRun(runId)` → POST `/api/deck/subagents` with action="kill"
- `startPolling()` / `stopPolling()` → visibility-gated 5s interval
- State: activeRuns[], historyRuns[], lineage[], polling

#### deck-agents Store

- `fetchDetail(agentId)` → GET `/api/deck/agents?agentId=...`
- `fetchSkills(agentId)` → POST `/api/deck/agents` with action="skills.get"
- `updateSkills(agentId, mode, skills, baseHash)` → POST `/api/deck/agents` with action="skills.patch"
- `fetchSubagentConfig(agentId)` → POST `/api/deck/agents` with action="subagents.get"
- State: currentDetail, currentSkills, loading

#### sessions Store

- `fetchSessions()` → GET `/api/sessions`
- `selectSession(key)` → Updates selectedKey
- `deleteSession(key)` → DELETE `/api/sessions`
- `fetchHistory(key)` → GET `/api/sessions?key=...`
- State: sessions[], selectedKey, history[], loading

### 7.2 Cross-Panel Navigation

**navigation-panel.ts** functions:

- `navigateToAgent(agentId, tab?)` → Sets activePanel="agents" + selects agent + sets pending tab
- `navigateToRouting(agentId?)` → Sets activePanel="routing"
- `navigateToSession(sessionKey)` → Sets activePanel="sessions" + selects session
- `navigateToSubagents()` → Sets activePanel="subagents"
- `navigateToChannel(channelId)` → Sets activePanel="channels" + selects channel

**Test Cases**:

- [ ] Clicking cross-panel links navigates correctly
- [ ] Destination panel opens with correct entity selected
- [ ] Pending tab set via navigateToAgent loads on agent detail mount

---

## 8. RESPONSIVE DESIGN

### 8.1 Breakpoints

- **Desktop** (≥1024px): Full sidebar visible + detail pane
- **Tablet** (768px-1023px): Sidebar auto-collapses
- **Mobile** (<768px): Sidebar as sheet overlay

### 8.2 Test Cases

- [ ] Desktop: Agents sidebar always visible (240px width)
- [ ] Tablet: Sidebar toggles with button in header
- [ ] Mobile: Sidebar opens as sheet, closes after selection
- [ ] NavRail collapses on ≤1023px (auto)
- [ ] Table content scrolls horizontally on narrow screens
- [ ] Text truncation with `line-clamp-2` where needed
- [ ] Font sizes scale appropriately (text-xs, text-sm)

---

## 9. LOCALIZATION (i18n)

### 9.1 Translation Keys

- `agentDetail.*` — agent tabs & labels
- `agents.*` — agent list & panel
- `subagents.*` — subagent tabs & messages
- `sessions.*` — session detail & labels
- `common.*` — common buttons (Create, Cancel, Save, Delete)
- `nav.*` — sidebar navigation

### 9.2 Test Cases

- [ ] Switch locale (Chinese/English) → all text updates
- [ ] Number formatting respects locale (tokens, timestamps)
- [ ] Inherited translations appear correctly

---

## 10. ERROR HANDLING & EDGE CASES

### 10.1 API Failures

- [ ] Network error on fetchBindings → error message shown
- [ ] Validation fails → conflicts displayed in BindingDialog
- [ ] Delete fails → confirm dialog remains open + error feedback
- [ ] Agent not found → "Not found" placeholder shown

### 10.2 Empty States

- [ ] No agents → "Select an agent" message
- [ ] No bindings → "No bindings found"
- [ ] No active runs → "No active runs"
- [ ] No sessions → "No sessions"

### 10.3 Edge Cases

- [ ] Very long agent names → truncated with ellipsis
- [ ] Very long session keys → truncated, full text on hover
- [ ] Very large token counts → formatted as K/M (1.5K, 2.3M)
- [ ] Subagent trees with orphan nodes → orphans marked, still rendered
- [ ] Circular lineage (if possible) → tree renders without infinite loop
- [ ] Rapid clicking on buttons → debounce/disable to prevent double-click

---

## 11. PERFORMANCE & STATE MANAGEMENT

### 11.1 Polling Optimization

- [ ] Visibility-gated polling (pauses when tab hidden)
- [ ] Poll interval: 5s for subagent runs
- [ ] Debounced validation (500ms in BindingDialog)

### 11.2 Memoization

- [ ] Filtered lists use useMemo
- [ ] Tree building in LineageTree uses useMemo
- [ ] pendingTab navigation doesn't cause extra renders

### 11.3 Test Cases

- [ ] Open Subagents tab → polling starts
- [ ] Close Subagents tab → polling stops
- [ ] Hide browser tab → polling pauses
- [ ] Show browser tab → polling resumes
- [ ] Change filter → list updates without flicker

---

## 12. ACCESSIBILITY

### 12.1 ARIA Labels

- [ ] Delete buttons have `aria-label="Remove binding"` / `aria-label="Delete agent"`
- [ ] Danger buttons have appropriate role/label
- [ ] Tree nodes have status labels (`aria-label={data.node.status}`)

### 12.2 Keyboard Navigation

- [ ] Tab through all interactive elements
- [ ] Enter/Space triggers buttons
- [ ] Esc closes dialogs
- [ ] Select dropdowns work with arrow keys

### 12.3 Color Contrast

- [ ] Status badges meet WCAG contrast ratios
- [ ] Text on colored backgrounds readable

---

## 13. BROWSER TESTING MATRIX

| Feature       | Chrome | Firefox | Safari | Edge |
| ------------- | ------ | ------- | ------ | ---- |
| Routing Tab   | ✓      | ✓       | ✓      | ✓    |
| Sessions Tab  | ✓      | ✓       | ✓      | ✓    |
| Subagents Tab | ✓      | ✓       | ✓      | ✓    |
| BindingDialog | ✓      | ✓       | ✓      | ✓    |
| LineageTree   | ✓      | ✓       | ✓      | ✓    |
| Polling       | ✓      | ✓       | ✓      | ✓    |
| Responsive    | ✓      | ✓       | ✓      | ✓    |

---

## 14. TEST EXECUTION CHECKLIST

- [ ] **Unit Tests**: All components render without errors
- [ ] **Integration Tests**: Cross-panel navigation works
- [ ] **E2E Tests**: Full user workflows (create agent → add binding → view sessions)
- [ ] **Visual Regression**: No unintended layout/color changes
- [ ] **Performance**: Page load < 2s, interactions respond < 100ms
- [ ] **Accessibility**: WCAG 2.1 AA compliance
- [ ] **Localization**: All keys translated + formatted correctly
- [ ] **Mobile**: All features work on iOS/Android

---

## 15. KNOWN ISSUES & LIMITATIONS

- Confirm deletion dialog text in Chinese (line 249-251 in BindingsTab.tsx) — should be i18n key
- DM Policy Summary section title English only (line 226) — should be i18n
- Lineage orphan detection: depends on backend accuracy of parentRunId

---

## Test Deliverables

1. **Test Report**: Pass/fail matrix for all 150+ test cases
2. **Bug Log**: Discovered issues with screenshots + reproduction steps
3. **Coverage Report**: Feature coverage %, test distribution by component
4. **Regression Suite**: Automated Playwright/Cypress E2E tests for critical paths

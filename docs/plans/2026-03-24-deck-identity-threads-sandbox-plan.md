# Deck: Identity Panel, Thread Browser & Sandbox Controls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three missing UI features to the Deck Dashboard — Identity management panel, Thread browser panel, and Sandbox/Thinking controls on agent detail.

**Architecture:** All three features consume existing Gateway RPC APIs (`deck.identity.*`, `deck.threads.list`, `deck.agents.detail`) via existing Dashboard API routes. Two minor API route modifications needed: (1) threads route must forward `status` param, (2) agents route must add `config.patch` action. Each feature follows the established Dashboard pattern: Zustand store → Panel component → NavRail registration → i18n keys. Note: `page.tsx` uses `lazy()` imports + `if/else if` pattern (not switch/case).

**Tech Stack:** React 19, Next.js 15, Zustand, TypeScript, shadcn/ui CSS variables, next-intl

**Skill Dependencies:**
| Domain | Skills |
|--------|--------|
| [frontend] | frontend-design, superpowers:test-driven-development |

---

## File Structure

### Task 1: Identity Management Panel

- Create: `dashboard/src/stores/deck-identity.ts`
- Create: `dashboard/src/components/panels/identity/IdentityPanel.tsx`
- Create: `dashboard/src/components/panels/identity/IdentityList.tsx`
- Create: `dashboard/src/components/panels/identity/LinkDialog.tsx`
- Modify: `dashboard/src/stores/ui.ts` (add `"identity"` to Panel union)
- Modify: `dashboard/src/components/layout/NavRail.tsx` (add nav item)
- Modify: `dashboard/src/app/page.tsx` (add panel rendering case)
- Modify: `dashboard/src/i18n/en.json` (add identity keys)
- Modify: `dashboard/src/i18n/zh.json` (add identity keys)

### Task 2: Thread Browser Panel

- Create: `dashboard/src/stores/deck-threads.ts`
- Create: `dashboard/src/components/panels/threads/ThreadsPanel.tsx`
- Create: `dashboard/src/components/panels/threads/ThreadList.tsx`
- Modify: `dashboard/src/stores/ui.ts` (add `"threads"` to Panel union)
- Modify: `dashboard/src/components/layout/NavRail.tsx` (add nav item)
- Modify: `dashboard/src/app/page.tsx` (add panel rendering case)
- Modify: `dashboard/src/i18n/en.json` (add threads keys)
- Modify: `dashboard/src/i18n/zh.json` (add threads keys)

### Task 3: Sandbox & Thinking Controls

- Modify: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx` (add sandbox card)
- Modify: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx` (add thinking controls)
- Modify: `dashboard/src/stores/deck-agents.ts` (add patchThinking/patchSandbox)
- Modify: `dashboard/src/i18n/en.json` (add agents.sandbox/thinking keys)
- Modify: `dashboard/src/i18n/zh.json` (add agents.sandbox/thinking keys)

---

## API Reference (all routes already exist)

### Identity API

```
GET  /api/deck/identity
→ { links: Array<{ canonical: string, peers: Array<{ channel: string, peerId: string }> }>, configHash: string }

POST /api/deck/identity { action: "link", canonical, channel, peerId, baseHash }
→ { ok: true, configHash: string }

POST /api/deck/identity { action: "unlink", canonical, channel, peerId, baseHash }
→ { ok: true, configHash: string }
```

### Threads API

```
GET /api/deck/threads?agentId=<>&channel=<>&status=<active|all>
→ { threads: Array<{ threadId, channelId, agentId, targetSessionKey, targetKind, boundAt, lastActivityAt, accountId, boundBy, label? }> }
```

### Agent Detail API (sandbox already in response)

```
GET /api/deck/agents?agentId=<>
→ { ..., sandbox?: { elevation?, filesystem? }, ... }

POST /api/deck/agents { action: "config.patch", agentId, path, value }
→ { ok: true }
```

---

## Task 1: Identity Management Panel

### Task 1.1: Create identity store

**Files:**

- Create: `dashboard/src/stores/deck-identity.ts`

- [ ] **Step 1: Create the store file with types and state**

```typescript
// dashboard/src/stores/deck-identity.ts
import { create } from "zustand";

export interface IdentityPeer {
  channel: string;
  peerId: string;
}

export interface IdentityLink {
  canonical: string;
  peers: IdentityPeer[];
}

interface IdentityState {
  links: IdentityLink[];
  configHash: string;
  loading: boolean;
  error: string | null;
  selectedCanonical: string | null;

  fetchLinks: () => Promise<void>;
  linkPeer: (canonical: string, channel: string, peerId: string) => Promise<boolean>;
  unlinkPeer: (canonical: string, channel: string, peerId: string) => Promise<boolean>;
  selectCanonical: (canonical: string | null) => void;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  links: [],
  configHash: "",
  loading: false,
  error: null,
  selectedCanonical: null,

  fetchLinks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/deck/identity");
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        set({ error: d.error ?? "Failed to fetch identities" });
        return;
      }
      const d = (await res.json()) as { links: IdentityLink[]; configHash: string };
      set({ links: d.links, configHash: d.configHash });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      set({ loading: false });
    }
  },

  linkPeer: async (canonical, channel, peerId) => {
    set({ error: null });
    try {
      const res = await fetch("/api/deck/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link",
          canonical,
          channel,
          peerId,
          baseHash: get().configHash,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        set({ error: d.error ?? "Failed to link" });
        return false;
      }
      const d = (await res.json()) as { ok: boolean; configHash: string };
      set({ configHash: d.configHash });
      await get().fetchLinks();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Network error" });
      return false;
    }
  },

  unlinkPeer: async (canonical, channel, peerId) => {
    set({ error: null });
    try {
      const res = await fetch("/api/deck/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink",
          canonical,
          channel,
          peerId,
          baseHash: get().configHash,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        set({ error: d.error ?? "Failed to unlink" });
        return false;
      }
      const d = (await res.json()) as { ok: boolean; configHash: string };
      set({ configHash: d.configHash });
      await get().fetchLinks();
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Network error" });
      return false;
    }
  },

  selectCanonical: (canonical) => set({ selectedCanonical: canonical }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `deck-identity.ts`

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add identity management store" dashboard/src/stores/deck-identity.ts
```

### Task 1.2: Create IdentityList component

**Files:**

- Create: `dashboard/src/components/panels/identity/IdentityList.tsx`

- [ ] **Step 1: Create IdentityList component**

Renders a list of canonical identities, each expandable to show linked peers (channel + peerId). Each peer has an "unlink" button. Uses `useTranslations("identity")` for all text.

Structure:

- Scrollable list of identity cards
- Each card: canonical name as heading, peer badges (channel icon + peerId) underneath
- Click a peer badge → unlink confirmation
- Empty state when no links

Follow the established card pattern from `ChannelList.tsx` — each identity is a clickable card with peer badges inside.

- [ ] **Step 2: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i identity`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add IdentityList component" dashboard/src/components/panels/identity/IdentityList.tsx
```

### Task 1.3: Create LinkDialog component

**Files:**

- Create: `dashboard/src/components/panels/identity/LinkDialog.tsx`

- [ ] **Step 1: Create LinkDialog component**

Modal dialog with three fields:

- `canonical`: text input (the unified identity label)
- `channel`: select dropdown (populated from available channels)
- `peerId`: text input (the platform-specific user ID)

Submit calls `useIdentityStore().linkPeer()`. On success, closes dialog. On error, shows inline error.

Use the same dialog pattern as `InstallSkillDialog.tsx` — overlay with form fields, cancel/submit buttons.

- [ ] **Step 2: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i identity`

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add LinkDialog for identity linking" dashboard/src/components/panels/identity/LinkDialog.tsx
```

### Task 1.4: Create IdentityPanel and register

**Files:**

- Create: `dashboard/src/components/panels/identity/IdentityPanel.tsx`
- Modify: `dashboard/src/stores/ui.ts` (add `"identity"` to Panel type)
- Modify: `dashboard/src/components/layout/NavRail.tsx` (add nav item)
- Modify: `dashboard/src/app/page.tsx` (add panel rendering)
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 1: Create IdentityPanel**

Orchestrator component: header (title + "Link Identity" button) → error banner → IdentityList. On mount, calls `fetchLinks()`. Shows LinkDialog when "Link Identity" button clicked.

Follow WebhooksPanel pattern:

- `useEffect(() => { fetchLinks() }, [])`
- Loading state → `t("common.loading")`
- Error banner above list
- "Link Identity" button in header opens LinkDialog

- [ ] **Step 2: Add `"identity"` to Panel type in ui.ts**

In the `Panel` type union, add `| "identity"`.

- [ ] **Step 3: Add identity to NavRail**

In `navGroups`, add to the "control" group (alongside approvals, alerts, budget):

```typescript
{ panel: "identity", labelKey: "identity", icon: Fingerprint }
```

Add `Fingerprint` to the lucide-react import statement at the top of NavRail.tsx.

- [ ] **Step 4: Add panel rendering in page.tsx**

Add a `lazy()` import declaration at the top: `const LazyIdentityPanel = lazy(() => import("./components/panels/identity/IdentityPanel"));` and an `else if (panel === "identity")` branch that renders `<LazyIdentityPanel />`. (Note: page.tsx uses `if/else if` + `lazy()`, not switch/case.)

- [ ] **Step 5: Add i18n keys**

en.json:

```json
"identity": {
  "title": "Identities",
  "canonical": "Canonical ID",
  "channel": "Channel",
  "peerId": "Peer ID",
  "linkIdentity": "Link Identity",
  "unlinkConfirm": "Unlink this peer from the identity?",
  "noLinks": "No identity links configured",
  "linkSuccess": "Identity linked",
  "unlinkSuccess": "Identity unlinked"
}
```

Add matching `nav.identity: "Identities"`.

zh.json: Add corresponding Chinese translations.

- [ ] **Step 6: Verify TypeScript + dev server**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Clean compile

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add Identity Management panel with nav registration" \
  dashboard/src/components/panels/identity/IdentityPanel.tsx \
  dashboard/src/stores/ui.ts \
  dashboard/src/components/layout/NavRail.tsx \
  dashboard/src/app/page.tsx \
  dashboard/src/i18n/en.json \
  dashboard/src/i18n/zh.json
```

---

## Task 2: Thread Browser Panel

### Task 2.0: Fix threads API route to forward `status` param

**Files:**

- Modify: `dashboard/src/app/api/deck/threads/route.ts`

- [ ] **Step 1: Add `status` param forwarding**

The existing route only forwards `agentId`, `channel`, `limit` but not `status`. The Gateway `deck.threads.list` accepts `status` ("active" | "all"). Add:

```typescript
const status = searchParams.get("status");
```

And in the `gatewayRequest` call, add:

```typescript
...(status ? { status } : {}),
```

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] fix(deck): forward status param in threads API route" dashboard/src/app/api/deck/threads/route.ts
```

### Task 2.1: Create threads store

**Files:**

- Create: `dashboard/src/stores/deck-threads.ts`

- [ ] **Step 1: Create the store file**

```typescript
// dashboard/src/stores/deck-threads.ts
import { create } from "zustand";

export interface ThreadEntry {
  threadId: string;
  channelId: string;
  agentId: string;
  targetSessionKey: string;
  targetKind: string;
  boundAt: number;
  lastActivityAt: number;
  accountId: string;
  boundBy: string;
  label?: string;
}

interface ThreadsState {
  threads: ThreadEntry[];
  loading: boolean;
  error: string | null;
  filterAgent: string;
  filterChannel: string;
  filterStatus: "active" | "all";

  fetchThreads: () => Promise<void>;
  setFilterAgent: (agentId: string) => void;
  setFilterChannel: (channel: string) => void;
  setFilterStatus: (status: "active" | "all") => void;
}

export const useThreadsStore = create<ThreadsState>((set, get) => ({
  threads: [],
  loading: false,
  error: null,
  filterAgent: "",
  filterChannel: "",
  filterStatus: "active",

  fetchThreads: async () => {
    set({ loading: true, error: null });
    const { filterAgent, filterChannel, filterStatus } = get();
    const params = new URLSearchParams();
    if (filterAgent) params.set("agentId", filterAgent);
    if (filterChannel) params.set("channel", filterChannel);
    params.set("status", filterStatus);
    try {
      const res = await fetch(`/api/deck/threads?${params}`);
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        set({ error: d.error ?? "Failed to fetch threads" });
        return;
      }
      const d = (await res.json()) as { threads: ThreadEntry[] };
      set({ threads: d.threads });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Network error" });
    } finally {
      set({ loading: false });
    }
  },

  setFilterAgent: (filterAgent) => {
    set({ filterAgent });
    get().fetchThreads();
  },
  setFilterChannel: (filterChannel) => {
    set({ filterChannel });
    get().fetchThreads();
  },
  setFilterStatus: (filterStatus) => {
    set({ filterStatus });
    get().fetchThreads();
  },
}));
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i thread`

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add thread browser store" dashboard/src/stores/deck-threads.ts
```

### Task 2.2: Create ThreadList component

**Files:**

- Create: `dashboard/src/components/panels/threads/ThreadList.tsx`

- [ ] **Step 1: Create ThreadList**

Renders a table/list of threads with columns:

- Channel icon + channelId
- Agent badge (agentId)
- Thread label (or threadId if no label)
- Target kind (e.g., "subagent", "dm", "group")
- Bound at (relative time)
- Last activity (relative time)

Each row is clickable — future: navigate to session. For now, just display.

Sort by `lastActivityAt` descending (most recent first).

Use `useTranslations("threads")` for all column headers and empty state text.

- [ ] **Step 2: Verify TypeScript**

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add ThreadList component" dashboard/src/components/panels/threads/ThreadList.tsx
```

### Task 2.3: Create ThreadsPanel and register

**Files:**

- Create: `dashboard/src/components/panels/threads/ThreadsPanel.tsx`
- Modify: `dashboard/src/stores/ui.ts` (add `"threads"` to Panel type)
- Modify: `dashboard/src/components/layout/NavRail.tsx` (add nav item)
- Modify: `dashboard/src/app/page.tsx` (add panel rendering)
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 1: Create ThreadsPanel**

Header with title + filter controls (agent select, channel select, active/all toggle).
On mount: `fetchThreads()`. Re-fetches when filters change (handled by store setters).

Filter bar pattern: similar to `LogFilters.tsx` — horizontal row of filter controls above the list.

- [ ] **Step 2: Add `"threads"` to Panel type in ui.ts**

- [ ] **Step 3: Add threads to NavRail**

In `navGroups`, add to the "observe" group (alongside sessions, activity, logs):

```typescript
{ panel: "threads", labelKey: "threads", icon: MessagesSquare }
```

Import `MessagesSquare` from `lucide-react`. (Note: `GitBranch` is already used by the routing panel.)

- [ ] **Step 4: Add panel rendering in page.tsx**

Add a `lazy()` import: `const LazyThreadsPanel = lazy(() => import("./components/panels/threads/ThreadsPanel"));` and an `else if (panel === "threads")` branch rendering `<LazyThreadsPanel />`.

- [ ] **Step 5: Add i18n keys**

en.json:

```json
"threads": {
  "title": "Threads",
  "threadId": "Thread ID",
  "channel": "Channel",
  "agent": "Agent",
  "kind": "Kind",
  "boundAt": "Bound",
  "lastActivity": "Last Activity",
  "boundBy": "Bound By",
  "noThreads": "No active threads",
  "filterAgent": "Filter by agent",
  "filterChannel": "Filter by channel",
  "statusActive": "Active",
  "statusAll": "All"
}
```

Add matching `nav.threads: "Threads"`.

zh.json: Add corresponding Chinese translations.

- [ ] **Step 6: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add Thread Browser panel with nav registration" \
  dashboard/src/components/panels/threads/ThreadsPanel.tsx \
  dashboard/src/stores/ui.ts \
  dashboard/src/components/layout/NavRail.tsx \
  dashboard/src/app/page.tsx \
  dashboard/src/i18n/en.json \
  dashboard/src/i18n/zh.json
```

---

## Task 3: Sandbox & Thinking Controls

### Task 3.1: Enhance existing sandbox card in OverviewTab

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**Note:** OverviewTab already has a basic sandbox card showing `sandboxMode` with a `Shield` icon and `sandboxEnabled`/`sandboxDefault` labels (lines ~128-148). This task enhances it with detail fields.

- [ ] **Step 1: Enhance the existing sandbox card**

Read existing `OverviewTab.tsx`. Find the existing sandbox card section. Enhance it by adding sub-fields below the enabled/disabled status:

- If sandbox is an object: show `elevation` level (e.g., "standard", "elevated") and `filesystem` access mode (e.g., "restricted", "full")
- Display these as small label-value pairs inside the existing card
- Keep the existing Shield icon and enabled/disabled styling

- [ ] **Step 2: Add i18n keys**

en.json under `"agents"`:

```json
"sandboxElevation": "Elevation",
"sandboxFilesystem": "Filesystem",
"sandboxStandard": "Standard",
"sandboxElevated": "Elevated",
"sandboxRestricted": "Restricted"
```

zh.json: Add corresponding Chinese translations.

- [ ] **Step 3: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i overview`

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): enhance sandbox detail in agent OverviewTab" \
  dashboard/src/components/panels/agents/tabs/OverviewTab.tsx \
  dashboard/src/i18n/en.json \
  dashboard/src/i18n/zh.json
```

### Task 3.2: Add thinking level controls to ContextTab

**Files:**

- Modify: `dashboard/src/app/api/deck/agents/route.ts` (add `config.patch` action)
- Modify: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`
- Modify: `dashboard/src/stores/deck-agents.ts` (add patchAgentConfig)
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 0: Add `config.patch` action to agents API route**

The existing agents API route (`dashboard/src/app/api/deck/agents/route.ts`) does NOT have a `config.patch` case. Add it to the `AgentAction` type union and the POST handler switch:

```typescript
// In the action type:
type AgentAction = ... | "config.patch";

// In the switch:
case "config.patch":
  return gatewayRequest("config.patch", params);
```

- [ ] **Step 1: Add patchAgentConfig to agent store**

Read existing `deck-agents.ts`. Add a function to patch agent config:

```typescript
patchAgentConfig: async (agentId: string, path: string, value: unknown) => {
  set({ error: null });
  try {
    const res = await fetch("/api/deck/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "config.patch", agentId, path, value }),
    });
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      set({ error: d.error ?? "Failed to update config" });
      return false;
    }
    // Refresh agent detail
    const { fetchAgentDetail, selectedAgentId } = get();
    if (selectedAgentId) await fetchAgentDetail(selectedAgentId);
    return true;
  } catch (err) {
    set({ error: err instanceof Error ? err.message : "Network error" });
    return false;
  }
},
```

- [ ] **Step 2: Add thinking level selector to ContextTab**

Read existing `ContextTab.tsx`. Add a new section "Thinking Level" with:

- A row of selectable badges/buttons for each thinking level: `off`, `minimal`, `low`, `medium`, `high`, `adaptive`
- Current level highlighted (from `detail.effectiveThinking` or defaults)
- Clicking a badge calls `patchAgentConfig(agentId, "agents.defaults.thinkingDefault", level)`
- Show a brief description of the selected level

Pattern: Use a horizontal button group similar to the filter toggles in `SessionsPanel.tsx`.

- [ ] **Step 3: Add i18n keys**

en.json under `"agents"`:

```json
"thinking": {
  "title": "Thinking Level",
  "description": "Controls the depth of reasoning the agent uses",
  "off": "Off",
  "minimal": "Minimal",
  "low": "Low",
  "medium": "Medium",
  "high": "High",
  "adaptive": "Adaptive",
  "current": "Current level"
}
```

zh.json: Add corresponding Chinese translations.

- [ ] **Step 4: Verify TypeScript**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add thinking level controls to agent ContextTab" \
  dashboard/src/app/api/deck/agents/route.ts \
  dashboard/src/components/panels/agents/tabs/ContextTab.tsx \
  dashboard/src/stores/deck-agents.ts \
  dashboard/src/i18n/en.json \
  dashboard/src/i18n/zh.json
```

---

## Final Verification

- [ ] **Full TypeScript check**: `cd dashboard && npx tsc --noEmit`
- [ ] **Dev server smoke test**: `cd dashboard && pnpm dev` → verify all 3 features render
- [ ] **Final commit** (if any remaining changes)

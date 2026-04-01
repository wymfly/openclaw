# Deck Sessions & Logs Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Sessions panel (search, filter, patch) and Logs panel (cursor-based incremental fetch, ring buffer, level filter) to match Gateway API capabilities.

**Architecture:** Enhance existing stores and components rather than rewrite. Sessions store gains parameterized fetch (search/limit/activeMinutes). Logs store moves filtering from poll-time to render-time (store all entries, useMemo filter). Ring buffer cap raised from 500→5000. Session patch uses existing `/api/chat/sessions/patch` route.

**Tech Stack:** React, Zustand, next-intl, shared list infra (ListSearchBar, InlineEdit)

---

### Task 1: Sessions store — parameterized fetch [frontend]

covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports server-side search > Search by session key
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports server-side search > Clear search
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports active time filter > Filter recently active

**Files:**

- Modify: `dashboard/src/stores/sessions.ts`
- Modify: `dashboard/src/app/api/sessions/route.ts`

- [ ] **Step 1: Add search/filter state to sessions store**

Add search parameters to the store interface and state:

```typescript
// In SessionsState interface, add:
searchQuery: string;
activeMinutesFilter: number | null;  // null = all
setSearchQuery: (query: string) => void;
setActiveMinutesFilter: (minutes: number | null) => void;
```

Initialize in the store:

```typescript
searchQuery: "",
activeMinutesFilter: null,
setSearchQuery: (query) => set({ searchQuery: query }),
setActiveMinutesFilter: (minutes) => set({ activeMinutesFilter: minutes }),
```

- [ ] **Step 2: Modify fetchSessions to pass parameters**

Update `fetchSessions` to pass search/limit/activeMinutes:

```typescript
fetchSessions: async () => {
  const { searchQuery, activeMinutesFilter } = get();
  set({ loading: true, error: null });
  try {
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("search", searchQuery.trim());
    }
    if (activeMinutesFilter !== null) {
      params.set("activeMinutes", String(activeMinutesFilter));
    }
    params.set("limit", "100");
    const res = await fetch(`/api/sessions?${params.toString()}`);
    // ... rest unchanged
```

- [ ] **Step 3: Update API route to forward parameters**

Modify `dashboard/src/app/api/sessions/route.ts`:

```typescript
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const search = request.nextUrl.searchParams.get("search");
  const limit = request.nextUrl.searchParams.get("limit");
  const activeMinutes = request.nextUrl.searchParams.get("activeMinutes");

  return gatewayRequest("sessions.list", {
    ...(search ? { search } : {}),
    ...(limit ? { limit: parseInt(limit, 10) } : {}),
    ...(activeMinutes ? { activeMinutes: parseInt(activeMinutes, 10) } : {}),
  });
});
```

- [ ] **Step 4: Verify**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(sessions): parameterized fetch with search, limit, activeMinutes" \
  dashboard/src/stores/sessions.ts \
  dashboard/src/app/api/sessions/route.ts
```

---

### Task 2: SessionsPanel — search bar + advanced filters [frontend]

covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports server-side search > Search by session key
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports server-side search > Clear search
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports type filter > Filter by type
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports type filter > Multiple type selection
covers: sessions-advanced-search/spec.md > ADDED > Sessions panel supports active time filter > Filter recently active
covers: sessions-advanced-search/spec.md > ADDED > Sessions list uses PaginatedList > Paginate sessions

**Files:**

- Modify: `dashboard/src/components/panels/sessions/SessionsPanel.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionList.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Replace type filter with ListSearchBar + advanced filters**

Rewrite SessionsPanel to use ListSearchBar with advanced filter fields:

```tsx
import { ListSearchBar } from "@/components/lists";
import type { FilterFieldDef } from "@/components/lists/types";

// Filter definitions
const sessionFilters = (t: ReturnType<typeof useTranslations>): FilterFieldDef[] => [
  {
    key: "types",
    label: t("filterType"),
    type: "multiselect",
    options: [
      { value: "dm", label: t("filterDirect") },
      { value: "group", label: t("filterGroup") },
      { value: "channel", label: t("filterChannel") },
      { value: "subagent", label: t("filterSubagent") },
    ],
  },
  {
    key: "activeMinutes",
    label: t("filterActiveTime"),
    type: "select",
    options: [
      { value: "5", label: t("filterActive5m") },
      { value: "60", label: t("filterActive1h") },
      { value: "1440", label: t("filterActive24h") },
    ],
  },
];
```

Replace the `<select>` type filter in the header with `<ListSearchBar>` that:

- `onSearch` calls `setSearchQuery` + re-fetches
- `filters` uses the filter definitions above
- `filterValues` tracks `{ types?: string[], activeMinutes?: string }`
- `onFilterChange` updates store's activeMinutesFilter for server-side + keeps types for client-side

- [ ] **Step 2: Add client-side type filtering to SessionList**

SessionList already has `typeFilter` prop. Change it to accept `string[]` (multiple types):

```tsx
interface SessionListProps {
  typeFilter?: string[];  // undefined or empty = show all
}

export function SessionList({ typeFilter }: SessionListProps) {
  // ...
  const filtered = !typeFilter || typeFilter.length === 0
    ? sessions
    : sessions.filter((s) => typeFilter.includes(inferSessionType(s.key)));
  // ...
```

- [ ] **Step 3: Add client-side pagination**

Since `sessions.list` doesn't support offset/page, implement client-side pagination in SessionList:

```tsx
const PAGE_SIZE = 20;
const [page, setPage] = useState(0);

const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);
const hasMore = filtered.length > paged.length;

// After the session list items:
{
  hasMore && (
    <button onClick={() => setPage((p) => p + 1)} className="...">
      {t("loadMore")} ({filtered.length - paged.length})
    </button>
  );
}
```

Reset page to 0 when sessions array or typeFilter changes.

- [ ] **Step 4: Add i18n keys**

Add to `zh.json` sessions namespace:

```json
"filterType": "类型",
"filterActiveTime": "活跃时间",
"filterActive5m": "最近 5 分钟",
"filterActive1h": "最近 1 小时",
"filterActive24h": "最近 24 小时",
"loadMore": "加载更多",
"sessionCount": "{count} 个会话"
```

Add corresponding English keys to `en.json`.

- [ ] **Step 5: Trigger re-fetch on search/filter change**

In SessionsPanel, use `useEffect` to re-fetch when searchQuery or activeMinutesFilter changes:

```tsx
useEffect(() => {
  void fetchSessions();
}, [fetchSessions, searchQuery, activeMinutesFilter]);
```

Remove the initial `useEffect(() => { void fetchSessions(); }, [fetchSessions])` to avoid duplicate fetches.

- [ ] **Step 6: Verify**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(sessions): search bar, type/time filters, client-side pagination" \
  dashboard/src/components/panels/sessions/SessionsPanel.tsx \
  dashboard/src/components/panels/sessions/SessionList.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 3: SessionDetail — property editing via InlineEdit [frontend]

covers: sessions-patch/spec.md > ADDED > SessionDetail supports label editing > Edit session label
covers: sessions-patch/spec.md > ADDED > SessionDetail supports label editing > Cancel label edit
covers: sessions-patch/spec.md > ADDED > SessionDetail supports thinkingLevel editing > Change thinking level
covers: sessions-patch/spec.md > ADDED > SessionDetail supports fastMode toggle > Toggle fast mode
covers: sessions-patch/spec.md > ADDED > Patch failure shows error > Patch API error

**Files:**

- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx`
- Modify: `dashboard/src/stores/sessions.ts`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add patchSession to sessions store**

Add `patchSession` method that calls the existing `/api/chat/sessions/patch` route:

```typescript
// In SessionsState interface:
patchSession: (sessionKey: string, patch: Record<string, unknown>) => Promise<boolean>;

// Implementation:
patchSession: async (sessionKey, patch) => {
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, ...patch }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Patch failed" }));
      const msg = (data as { error?: string }).error ?? "Patch failed";
      // Return false to signal failure — caller shows toast
      console.error("[sessions] patch failed:", msg);
      return false;
    }
    // Update local session entry with patched fields
    set((state) => {
      const sessions = state.sessions.map((s) =>
        s.key === sessionKey ? { ...s, ...patch } : s,
      );
      return { sessions };
    });
    return true;
  } catch (err) {
    console.error("[sessions] patch error:", err);
    return false;
  }
},
```

- [ ] **Step 2: Add SessionEntry fields for patchable properties**

Extend SessionEntry to include label, thinkingLevel, fastMode:

```typescript
export interface SessionEntry {
  // ... existing fields ...
  label?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
}
```

Update `normalizeSession` to extract these fields:

```typescript
label: typeof raw.label === "string" ? raw.label : undefined,
thinkingLevel: typeof raw.thinkingLevel === "string" ? raw.thinkingLevel : undefined,
fastMode: typeof raw.fastMode === "boolean" ? raw.fastMode : undefined,
```

- [ ] **Step 3: Add InlineEdit for label in SessionDetail header**

Replace the static `<h3>` session key with InlineEdit for label:

```tsx
import { InlineEdit } from "@/components/lists";

// In the header section, add label editing:
<InlineEdit
  type="text"
  value={session.label ?? ""}
  placeholder={session.key}
  onConfirm={async (newLabel) => {
    const ok = await patchSession(session.key, { label: newLabel || null });
    if (!ok) {
      // toast notification handled below
    }
  }}
  className="text-sm font-semibold"
/>;
```

Keep the session key visible as secondary text below the label.

- [ ] **Step 4: Add thinkingLevel InlineEdit + fastMode Switch**

In the stats section of SessionDetail, add:

```tsx
// thinkingLevel selector
<div>
  <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
    {t("thinkingLevel")}
  </span>
  <InlineEdit
    type="select"
    value={session.thinkingLevel ?? "off"}
    options={[
      { value: "off", label: t("thinkingOff") },
      { value: "low", label: t("thinkingLow") },
      { value: "medium", label: t("thinkingMedium") },
      { value: "high", label: t("thinkingHigh") },
    ]}
    onConfirm={async (val) => {
      const ok = await patchSession(session.key, { thinkingLevel: val });
      if (!ok) { /* toast */ }
    }}
  />
</div>

// fastMode switch
<div className="flex items-center gap-2">
  <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
    {t("fastMode")}
  </span>
  <button
    onClick={async () => {
      const ok = await patchSession(session.key, { fastMode: !session.fastMode });
      if (!ok) { /* toast */ }
    }}
    className={cn("w-8 h-4 rounded-full transition-colors relative", ...)}
    style={{ backgroundColor: session.fastMode ? "var(--primary)" : "var(--muted)" }}
  >
    <span className="..." style={{ transform: session.fastMode ? "translateX(16px)" : "translateX(2px)" }} />
  </button>
</div>
```

- [ ] **Step 5: Add toast notification on patch failure**

Import useNotifications (or simple toast) and show error:

```tsx
const handlePatchFail = useCallback(() => {
  // Use existing notification mechanism or simple alert
  console.error("[SessionDetail] patch failed");
}, []);
```

- [ ] **Step 6: Add i18n keys**

Add to `zh.json` sessions namespace:

```json
"thinkingLevel": "思考级别",
"thinkingOff": "关闭",
"thinkingLow": "低",
"thinkingMedium": "中",
"thinkingHigh": "高",
"patchFailed": "修改失败",
"label": "标签"
```

Add corresponding English keys.

- [ ] **Step 7: Verify**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] feat(sessions): InlineEdit for label, thinkingLevel; fastMode toggle" \
  dashboard/src/stores/sessions.ts \
  dashboard/src/components/panels/sessions/SessionDetail.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 4: Logs store — ring buffer upgrade + render-time filtering [frontend]

covers: logs-incremental-fetch/spec.md > ADDED > Logs store uses cursor-based incremental fetching > Initial fetch without cursor
covers: logs-incremental-fetch/spec.md > ADDED > Logs store uses cursor-based incremental fetching > Incremental fetch with cursor
covers: logs-incremental-fetch/spec.md > ADDED > Logs store uses cursor-based incremental fetching > Cursor expiration recovery
covers: logs-incremental-fetch/spec.md > ADDED > Logs store passes maxBytes parameter > Large log volume
covers: logs-memory-management/spec.md > ADDED > Logs store maintains ring buffer with 5000 entry limit > Buffer overflow
covers: logs-memory-management/spec.md > ADDED > Logs panel supports level filter > Level filter does not affect buffer

**Files:**

- Modify: `dashboard/src/stores/logs.ts`
- Modify: `dashboard/src/components/panels/logs/useLogPolling.ts`

- [ ] **Step 1: Raise maxEntries to 5000 and rename for clarity**

In `dashboard/src/stores/logs.ts`:

```typescript
// Change maxEntries default from 500 to 5000
maxEntries: 5000,
```

The existing `addEntries` already implements ring buffer (slice from end). The only change is the default value.

- [ ] **Step 2: Move level filtering from poll-time to render-time**

Currently `useLogPolling` filters entries before calling `addEntries()`. This means filtered-out entries are permanently lost. Change to: store ALL entries, filter at render time.

In `useLogPolling.ts`, remove the level filter from the poll callback:

```typescript
// Remove this from the poll callback:
// if (f.levels.length > 0 && !f.levels.includes(entry.level)) { return false; }

// Keep source and session filters in poll (these reduce data volume):
const filtered = parsed.filter((entry) => {
  if (f.source !== "all" && entry.source !== f.source) {
    return false;
  }
  if (f.sessionKey && entry.sessionKey !== f.sessionKey && !entry.message.includes(f.sessionKey)) {
    return false;
  }
  return true;
});
```

- [ ] **Step 3: Add maxBytes parameter to log poll**

In `useLogPolling.ts`, add maxBytes to the request:

```typescript
params.set("maxBytes", "65536"); // 64KB
```

Update the API route to forward it. In `dashboard/src/app/api/logs/route.ts`:

```typescript
const maxBytes = request.nextUrl.searchParams.get("maxBytes");
return gatewayRequest("logs.tail", {
  ...(cursor ? { cursor: parseInt(cursor, 10) } : {}),
  limit: parseInt(limit, 10),
  ...(maxBytes ? { maxBytes: parseInt(maxBytes, 10) } : {}),
});
```

- [ ] **Step 4: Improve cursor expiration recovery**

In `useLogPolling.ts`, check for error responses and reset cursor:

```typescript
const res = await fetch(`/api/logs?${params.toString()}`);
if (!res.ok) {
  // On error, reset cursor to recover from expiration
  if (cursorRef.current !== null) {
    console.warn("[logs] cursor may be expired, resetting");
    cursorRef.current = null;
  }
  return;
}
```

The existing `data.reset` check already handles server-signaled resets.

- [ ] **Step 5: Verify**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(logs): 5000-entry ring buffer, render-time level filter, maxBytes, cursor recovery" \
  dashboard/src/stores/logs.ts \
  dashboard/src/components/panels/logs/useLogPolling.ts \
  dashboard/src/app/api/logs/route.ts
```

---

### Task 5: LogsPanel — level filter UI + buffer count display [frontend]

covers: logs-memory-management/spec.md > ADDED > Logs store maintains ring buffer with 5000 entry limit > Buffer count display
covers: logs-memory-management/spec.md > ADDED > Logs panel supports level filter > Filter by error level
covers: logs-memory-management/spec.md > ADDED > Logs panel supports level filter > Multiple level selection
covers: logs-memory-management/spec.md > ADDED > Logs level badges use semantic colors > Level color mapping

**Files:**

- Modify: `dashboard/src/components/panels/logs/LogStream.tsx`
- Modify: `dashboard/src/components/panels/logs/LogsPanel.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add render-time level filtering in LogStream**

LogStream currently reads `entries` directly. Add `useMemo` to filter by level:

```tsx
import { useLogsStore, type LogLevel } from "@/stores/logs";

export function LogStream() {
  const allEntries = useLogsStore((s) => s.entries);
  const levelFilter = useLogsStore((s) => s.filters.levels);
  const streaming = useLogsStore((s) => s.streaming);

  // Render-time filtering — buffer retains all entries
  const entries = useMemo(() => {
    if (levelFilter.length === 0 || levelFilter.length === 4) {
      return allEntries;  // no filter active or all selected
    }
    return allEntries.filter((e) => levelFilter.includes(e.level));
  }, [allEntries, levelFilter]);

  // ... rest unchanged, uses `entries`
```

- [ ] **Step 2: Add buffer count display in LogsPanel toolbar**

Add buffer count next to the title:

```tsx
const totalEntries = useLogsStore((s) => s.entries.length);
const maxEntries = useLogsStore((s) => s.maxEntries);

// In toolbar, after title:
<span className="text-[10px] font-mono text-muted-foreground">
  {totalEntries} / {maxEntries}
</span>;
```

- [ ] **Step 3: Verify level badge colors are correct**

LogStream already has LEVEL_COLORS mapping:

- debug → muted/muted-foreground
- info → primary-muted/primary
- warn → warning-muted/warning
- error → destructive-muted/destructive

This matches the spec requirement. No change needed.

- [ ] **Step 4: Add i18n keys**

Add to `zh.json` logs namespace:

```json
"bufferCount": "{current} / {max}",
"bufferFull": "缓存已满，最早的日志已被淘汰"
```

Add corresponding English keys.

- [ ] **Step 5: Verify**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(logs): render-time level filter, buffer count display" \
  dashboard/src/components/panels/logs/LogStream.tsx \
  dashboard/src/components/panels/logs/LogsPanel.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                            | Task      |
| --------------------------------------------------------------------------- | --------- |
| sessions-advanced-search / server-side search / Search by session key       | Task 1, 2 |
| sessions-advanced-search / server-side search / Clear search                | Task 1, 2 |
| sessions-advanced-search / type filter / Filter by type                     | Task 2    |
| sessions-advanced-search / type filter / Multiple type selection            | Task 2    |
| sessions-advanced-search / active time filter / Filter recently active      | Task 1, 2 |
| sessions-advanced-search / PaginatedList / Paginate sessions                | Task 2    |
| sessions-patch / label editing / Edit session label                         | Task 3    |
| sessions-patch / label editing / Cancel label edit                          | Task 3    |
| sessions-patch / thinkingLevel editing / Change thinking level              | Task 3    |
| sessions-patch / fastMode toggle / Toggle fast mode                         | Task 3    |
| sessions-patch / Patch failure / Patch API error                            | Task 3    |
| logs-incremental-fetch / cursor-based / Initial fetch without cursor        | Task 4    |
| logs-incremental-fetch / cursor-based / Incremental fetch with cursor       | Task 4    |
| logs-incremental-fetch / cursor-based / Cursor expiration recovery          | Task 4    |
| logs-incremental-fetch / maxBytes / Large log volume                        | Task 4    |
| logs-memory-management / ring buffer / Buffer overflow                      | Task 4    |
| logs-memory-management / ring buffer / Buffer count display                 | Task 5    |
| logs-memory-management / level filter / Filter by error level               | Task 5    |
| logs-memory-management / level filter / Multiple level selection            | Task 5    |
| logs-memory-management / level filter / Level filter does not affect buffer | Task 4, 5 |
| logs-memory-management / level badges / Level color mapping                 | Task 5    |

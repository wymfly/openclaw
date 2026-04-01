# Deck Shared List Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a composable list component library (`dashboard/src/components/lists/`) providing unified virtual scrolling, pagination, search, sort, batch actions, and inline editing — shared infrastructure for 12+ Deck panels.

**Architecture:** Composable API (not monolithic DataTable) — independent VirtualList, PaginatedList, ListSearchBar, SortableHeader, BatchActionBar, InlineEdit components orchestrated by a single `useListState<T>` hook. Built on shadcn Table/Pagination primitives and existing `@tanstack/react-virtual`. All text via `next-intl` `useTranslations("lists")`, all colors via shadcn variables + extended tokens.

**Tech Stack:** React 19, TypeScript (strict), shadcn/ui (Table + Pagination), @tanstack/react-virtual v3, next-intl, Vitest, Tailwind CSS

**OpenSpec Change:** `deck-shared-list-infra`

**Skill Dependencies:** `[frontend]` — dashboard CLAUDE.md (i18n, theme, HTML compliance rules)

---

## File Structure

```
dashboard/src/components/lists/
├── types.ts              # Shared types: SortDirection, SortState, FilterState, PaginationState, SelectionState
├── useListState.ts       # Core hook: filter/sort/pagination/selection state management
├── useListState.test.ts  # Unit tests for useListState
├── VirtualList.tsx        # Virtual scrolling list (render prop, scroll restoration)
├── PaginatedList.tsx      # Pagination container (button mode + infinite scroll mode)
├── ListSearchBar.tsx      # Debounced search + advanced filter dropdown
├── SortableHeader.tsx     # Tri-state sortable column header
├── BatchActionBar.tsx     # Selection count + action buttons slot
├── InlineEdit.tsx         # Click-to-edit (text input + select)
└── index.ts              # Barrel export

dashboard/src/components/ui/
├── table.tsx             # shadcn Table (to install)
└── pagination.tsx        # shadcn Pagination (to install)

dashboard/src/i18n/
├── zh.json               # Add "lists" namespace
└── en.json               # Add "lists" namespace
```

---

### Task 1: Install shadcn Table & Pagination + Create Directory Structure

covers: paginated-list/spec.md > ADDED > PaginatedList button mode (prereq)
covers: list-state-hook/spec.md > ADDED > useListState filter capability (prereq)

**Files:**

- Create: `dashboard/src/components/lists/types.ts`
- Create: `dashboard/src/components/lists/index.ts`
- Create: `dashboard/src/components/ui/table.tsx` (via shadcn CLI)
- Create: `dashboard/src/components/ui/pagination.tsx` (via shadcn CLI)
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Install shadcn Table and Pagination**

```bash
cd dashboard && npx shadcn@latest add table pagination --yes
```

Verify files exist:

```bash
ls dashboard/src/components/ui/table.tsx dashboard/src/components/ui/pagination.tsx
```

- [ ] **Step 2: Create types.ts with shared types**

Create `dashboard/src/components/lists/types.ts`:

```typescript
/** Sort direction for sortable columns. */
export type SortDirection = "asc" | "desc";

/** Current sort state — null means unsorted. */
export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

/** Generic filter state — keys and values are consumer-defined. */
export type FilterState = Record<string, unknown>;

/** Pagination state returned by useListState. */
export interface PaginationState {
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Selection state returned by useListState. */
export interface SelectionState {
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartialSelected: boolean;
}

/** Options for useListState hook. */
export interface UseListStateOptions<T, F extends FilterState = FilterState> {
  data: T[];
  /** Function to extract a unique ID from each item. Default: `(item) => (item as any).id` */
  idKey?: (item: T) => string;
  /** Filter function: receives an item and current filters, returns true to include. */
  filterFn?: (item: T, filters: F) => boolean;
  /** Custom sort function. When provided, overrides key-based sort. */
  sortFn?: (a: T, b: T, sort: SortState) => number;
  /** Items per page. 0 or undefined disables pagination. */
  pageSize?: number;
}

/** Full return type of useListState. */
export interface UseListStateReturn<T, F extends FilterState = FilterState> {
  // Data
  filteredData: T[];
  sortedData: T[];
  paginatedData: T[];
  // Filter
  filters: F;
  setFilters: (filters: F) => void;
  // Sort
  sort: SortState | null;
  setSort: (sort: SortState | null) => void;
  // Pagination
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  // Selection
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
}

/** Props for VirtualList renderItem. */
export interface VirtualRenderItemProps<T> {
  item: T;
  index: number;
  virtualRow: { start: number; size: number; index: number };
}

/** Filter field definition for ListSearchBar advanced filters. */
export interface FilterFieldDef {
  key: string;
  label: string;
  type: "select" | "multiselect" | "text";
  options?: { value: string; label: string }[];
}
```

- [ ] **Step 3: Create barrel index.ts**

Create `dashboard/src/components/lists/index.ts`:

```typescript
export * from "./types";
export { useListState } from "./useListState";
export { VirtualList } from "./VirtualList";
export { PaginatedList } from "./PaginatedList";
export { ListSearchBar } from "./ListSearchBar";
export { SortableHeader } from "./SortableHeader";
export { BatchActionBar } from "./BatchActionBar";
export { InlineEdit } from "./InlineEdit";
```

- [ ] **Step 4: Add i18n keys to zh.json and en.json**

Add `"lists"` namespace to `dashboard/src/i18n/zh.json` (insert after `"common"` block):

```json
"lists": {
  "empty": "暂无数据",
  "totalCount": "共 {count} 项",
  "selected": "已选 {count} 项",
  "selectAll": "全选",
  "clearSelection": "取消选择",
  "loadMore": "加载更多",
  "noMoreData": "已加载全部",
  "searchPlaceholder": "搜索...",
  "clearFilters": "清除过滤",
  "matchCount": "{count} 个结果",
  "advancedFilters": "高级过滤",
  "sortAsc": "升序",
  "sortDesc": "降序",
  "sortClear": "取消排序",
  "inlineEditConfirm": "按 Enter 确认",
  "inlineEditCancel": "按 Esc 取消",
  "pageInfo": "第 {current} / {total} 页",
  "loading": "加载中..."
}
```

Add corresponding `"lists"` namespace to `dashboard/src/i18n/en.json`:

```json
"lists": {
  "empty": "No data",
  "totalCount": "{count} items",
  "selected": "{count} selected",
  "selectAll": "Select all",
  "clearSelection": "Clear selection",
  "loadMore": "Load more",
  "noMoreData": "All loaded",
  "searchPlaceholder": "Search...",
  "clearFilters": "Clear filters",
  "matchCount": "{count} results",
  "advancedFilters": "Advanced filters",
  "sortAsc": "Ascending",
  "sortDesc": "Descending",
  "sortClear": "Clear sort",
  "inlineEditConfirm": "Press Enter to confirm",
  "inlineEditCancel": "Press Esc to cancel",
  "pageInfo": "Page {current} / {total}",
  "loading": "Loading..."
}
```

- [ ] **Step 5: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS (index.ts will show errors for missing modules — that's expected until we create them; the types.ts itself should be clean)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(lists): add shared types, i18n keys, shadcn Table/Pagination" \
  dashboard/src/components/lists/types.ts \
  dashboard/src/components/lists/index.ts \
  dashboard/src/components/ui/table.tsx \
  dashboard/src/components/ui/pagination.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 2: Implement useListState Hook — Filter & Sort

covers: list-state-hook/spec.md > ADDED > useListState filter capability > "Apply text filter"
covers: list-state-hook/spec.md > ADDED > useListState filter capability > "Clear filters"
covers: list-state-hook/spec.md > ADDED > useListState sort capability > "Sort by key ascending"
covers: list-state-hook/spec.md > ADDED > useListState sort capability > "Clear sort"
covers: list-state-hook/spec.md > ADDED > useListState sort capability > "Custom sort function"

**Files:**

- Create: `dashboard/src/components/lists/useListState.ts`
- Create: `dashboard/src/components/lists/useListState.test.ts`

- [ ] **Step 1: Write failing tests for filter and sort**

Create `dashboard/src/components/lists/useListState.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListState } from "./useListState";

interface TestItem {
  id: string;
  name: string;
  score: number;
}

const ITEMS: TestItem[] = [
  { id: "1", name: "Alice", score: 90 },
  { id: "2", name: "Bob", score: 75 },
  { id: "3", name: "Charlie", score: 85 },
  { id: "4", name: "Diana", score: 95 },
  { id: "5", name: "Eve", score: 80 },
];

describe("useListState — filter", () => {
  it("returns all data when no filters applied", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));
    expect(result.current.filteredData).toHaveLength(5);
  });

  it("filters data with filterFn and setFilters", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => {
      result.current.setFilters({ search: "ali" });
    });
    expect(result.current.filteredData).toHaveLength(1);
    expect(result.current.filteredData[0].name).toBe("Alice");
  });

  it("clears filters restores all data", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => result.current.setFilters({ search: "bob" }));
    expect(result.current.filteredData).toHaveLength(1);

    act(() => result.current.setFilters({}));
    expect(result.current.filteredData).toHaveLength(5);
  });
});

describe("useListState — sort", () => {
  it("sorts by key ascending", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => {
      result.current.setSort({ key: "score", direction: "asc" });
    });
    expect(result.current.sortedData.map((i) => i.score)).toEqual([75, 80, 85, 90, 95]);
  });

  it("sorts by key descending", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => {
      result.current.setSort({ key: "score", direction: "desc" });
    });
    expect(result.current.sortedData.map((i) => i.score)).toEqual([95, 90, 85, 80, 75]);
  });

  it("clears sort restores original order", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => result.current.setSort({ key: "score", direction: "asc" }));
    act(() => result.current.setSort(null));
    expect(result.current.sortedData.map((i) => i.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("uses custom sortFn when provided", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        sortFn: (a, b) => a.name.localeCompare(b.name),
      }),
    );

    act(() => {
      result.current.setSort({ key: "name", direction: "asc" });
    });
    expect(result.current.sortedData.map((i) => i.name)).toEqual([
      "Alice",
      "Bob",
      "Charlie",
      "Diana",
      "Eve",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd dashboard && npx vitest run src/components/lists/useListState.test.ts
```

Expected: FAIL — `useListState` module not found.

- [ ] **Step 3: Implement useListState with filter and sort**

Create `dashboard/src/components/lists/useListState.ts`:

```typescript
import { useState, useMemo, useCallback } from "react";
import type { SortState, FilterState, UseListStateOptions, UseListStateReturn } from "./types";

/**
 * Composable list state hook — manages filter, sort, pagination, and selection.
 * UI state only (not business state); cleans up on unmount.
 */
export function useListState<T, F extends FilterState = FilterState>(
  options: UseListStateOptions<T, F>,
): UseListStateReturn<T, F> {
  const {
    data,
    idKey = (item) => (item as Record<string, unknown>).id as string,
    filterFn,
    sortFn,
    pageSize: initialPageSize = 0,
  } = options;

  // ----- Filter state -----
  const [filters, setFiltersRaw] = useState<F>({} as F);

  const filteredData = useMemo(() => {
    if (!filterFn) return data;
    return data.filter((item) => filterFn(item, filters));
  }, [data, filterFn, filters]);

  // ----- Sort state -----
  const [sort, setSortRaw] = useState<SortState | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const sorted = [...filteredData];
    if (sortFn) {
      sorted.sort((a, b) => sortFn(a, b, sort));
    } else {
      sorted.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[sort.key];
        const bVal = (b as Record<string, unknown>)[sort.key];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "string" && typeof bVal === "string") {
          return sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        const diff = (aVal as number) - (bVal as number);
        return sort.direction === "asc" ? diff : -diff;
      });
    }
    return sorted;
  }, [filteredData, sort, sortFn]);

  // ----- Pagination state -----
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalPages = useMemo(() => {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(sortedData.length / pageSize));
  }, [sortedData.length, pageSize]);

  const paginatedData = useMemo(() => {
    if (pageSize <= 0) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  // ----- Selection state -----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isAllSelected = useMemo(() => {
    if (filteredData.length === 0) return false;
    return filteredData.every((item) => selectedIds.has(idKey(item)));
  }, [filteredData, selectedIds, idKey]);

  const isPartialSelected = useMemo(() => {
    if (filteredData.length === 0) return false;
    const someSelected = filteredData.some((item) => selectedIds.has(idKey(item)));
    return someSelected && !isAllSelected;
  }, [filteredData, selectedIds, isAllSelected, idKey]);

  // ----- Auto-reset behaviors -----
  const setFilters = useCallback((newFilters: F) => {
    setFiltersRaw(newFilters);
    setPageRaw(1);
    setSelectedIds(new Set());
  }, []);

  const setSort = useCallback((newSort: SortState | null) => {
    setSortRaw(newSort);
  }, []);

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.max(1, p));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredData.map(idKey)));
  }, [filteredData, idKey]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    filteredData,
    sortedData,
    paginatedData,
    filters,
    setFilters,
    sort,
    setSort,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    selectedIds,
    isAllSelected,
    isPartialSelected,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd dashboard && npx vitest run src/components/lists/useListState.test.ts
```

Expected: PASS — all filter and sort tests green.

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement useListState hook — filter & sort" \
  dashboard/src/components/lists/useListState.ts \
  dashboard/src/components/lists/useListState.test.ts
```

---

### Task 3: Implement useListState — Pagination, Selection & Auto-Reset

covers: list-state-hook/spec.md > ADDED > useListState pagination capability > "Get current page data"
covers: list-state-hook/spec.md > ADDED > useListState pagination capability > "Page size change adjusts total pages"
covers: list-state-hook/spec.md > ADDED > useListState pagination capability > "Disable pagination"
covers: list-state-hook/spec.md > ADDED > useListState selection capability > "Toggle single item"
covers: list-state-hook/spec.md > ADDED > useListState selection capability > "Select all filtered items"
covers: list-state-hook/spec.md > ADDED > useListState auto-reset behaviors > "Filter change resets page"
covers: list-state-hook/spec.md > ADDED > useListState auto-reset behaviors > "Clear selection on filter change"
covers: list-state-hook/spec.md > ADDED > useListState returns combined output > "Destructure all capabilities"

**Files:**

- Modify: `dashboard/src/components/lists/useListState.test.ts`

- [ ] **Step 1: Add pagination, selection, and auto-reset tests**

Append to `dashboard/src/components/lists/useListState.test.ts`:

```typescript
describe("useListState — pagination", () => {
  it("returns current page data", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS, pageSize: 2 }));
    expect(result.current.paginatedData).toHaveLength(2);
    expect(result.current.paginatedData[0].id).toBe("1");
    expect(result.current.totalPages).toBe(3);
  });

  it("navigates to second page", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS, pageSize: 2 }));

    act(() => result.current.setPage(2));
    expect(result.current.paginatedData.map((i) => i.id)).toEqual(["3", "4"]);
  });

  it("resets page when pageSize changes", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS, pageSize: 2 }));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPageSize(3));
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(2);
  });

  it("returns all data when pageSize is 0", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS, pageSize: 0 }));
    expect(result.current.paginatedData).toHaveLength(5);
  });
});

describe("useListState — selection", () => {
  it("toggles single item selection", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => result.current.toggleSelect("2"));
    expect(result.current.selectedIds.has("2")).toBe(true);
    expect(result.current.isPartialSelected).toBe(true);

    act(() => result.current.toggleSelect("2"));
    expect(result.current.selectedIds.has("2")).toBe(false);
  });

  it("selects all filtered items", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => result.current.setFilters({ search: "" }));
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(5);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("clearSelection empties selectedIds", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => result.current.selectAll());
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds.size).toBe(0);
  });
});

describe("useListState — auto-reset", () => {
  it("resets page to 1 when filters change", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        pageSize: 2,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setFilters({ search: "a" }));
    expect(result.current.page).toBe(1);
  });

  it("clears selection when filters change", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(5);

    act(() => result.current.setFilters({ search: "bob" }));
    expect(result.current.selectedIds.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests pass**

```bash
cd dashboard && npx vitest run src/components/lists/useListState.test.ts
```

Expected: PASS — all tests green (implementation already handles pagination, selection, and auto-reset from Task 2).

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] test(lists): add pagination, selection, auto-reset tests for useListState" \
  dashboard/src/components/lists/useListState.test.ts
```

---

### Task 4: Implement VirtualList

covers: virtual-list/spec.md > ADDED > VirtualList renders only visible items > "Fixed height rendering"
covers: virtual-list/spec.md > ADDED > VirtualList renders only visible items > "Dynamic height rendering"
covers: virtual-list/spec.md > ADDED > VirtualList supports scroll restoration > "Tab switch scroll restoration"
covers: virtual-list/spec.md > ADDED > VirtualList supports scroll restoration > "No restoration key provided"
covers: virtual-list/spec.md > ADDED > VirtualList accepts render prop for items > "Custom row rendering"
covers: virtual-list/spec.md > ADDED > VirtualList displays empty state > "Empty data with custom empty state"
covers: virtual-list/spec.md > ADDED > VirtualList displays empty state > "Empty data with default empty state"

**Files:**

- Create: `dashboard/src/components/lists/VirtualList.tsx`

- [ ] **Step 1: Implement VirtualList component**

Create `dashboard/src/components/lists/VirtualList.tsx`:

```tsx
"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef } from "react";
import type { VirtualRenderItemProps } from "./types";

interface VirtualListProps<T> {
  /** Data array to render. */
  data: T[];
  /** Estimated row height in pixels. Constant = fixed height; variable = dynamic. */
  estimateSize: (index: number) => number;
  /** Number of extra rows to render outside visible area. Default: 5. */
  overscan?: number;
  /** Render function for each visible item. */
  renderItem: (props: VirtualRenderItemProps<T>) => React.ReactNode;
  /** Custom empty state. Falls back to i18n default. */
  emptyState?: React.ReactNode;
  /** Session key for scroll position restoration. Omit to disable. */
  scrollRestorationKey?: string;
  /** Container height. Default: "100%". */
  height?: number | string;
  /** Optional className for the outer scroll container. */
  className?: string;
}

const SCROLL_STORAGE_PREFIX = "vlist-scroll-";

export function VirtualList<T>({
  data,
  estimateSize,
  overscan = 5,
  renderItem,
  emptyState,
  scrollRestorationKey,
  height = "100%",
  className,
}: VirtualListProps<T>) {
  const t = useTranslations("lists");
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // ----- Scroll restoration: save -----
  useEffect(() => {
    if (!scrollRestorationKey) return;
    const el = parentRef.current;
    if (!el) return;

    const handleScroll = () => {
      try {
        sessionStorage.setItem(SCROLL_STORAGE_PREFIX + scrollRestorationKey, String(el.scrollTop));
      } catch {
        // sessionStorage full or unavailable — ignore
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRestorationKey]);

  // ----- Scroll restoration: restore -----
  useEffect(() => {
    if (!scrollRestorationKey) return;
    const el = parentRef.current;
    if (!el) return;

    try {
      const saved = sessionStorage.getItem(SCROLL_STORAGE_PREFIX + scrollRestorationKey);
      if (saved) {
        el.scrollTop = Number(saved);
      }
    } catch {
      // ignore
    }
  }, [scrollRestorationKey]);

  // ----- Empty state -----
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center py-12 text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyState ?? t("empty")}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={className}
      style={{
        height,
        overflow: "auto",
        position: "relative",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem({
              item: data[virtualRow.index],
              index: virtualRow.index,
              virtualRow: {
                start: virtualRow.start,
                size: virtualRow.size,
                index: virtualRow.index,
              },
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS (some unrelated warnings from index.ts importing not-yet-created files are OK — focus on VirtualList.tsx being clean).

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement VirtualList with scroll restoration" \
  dashboard/src/components/lists/VirtualList.tsx
```

---

### Task 5: Implement PaginatedList

covers: paginated-list/spec.md > ADDED > PaginatedList button mode > "Navigate pages with buttons"
covers: paginated-list/spec.md > ADDED > PaginatedList button mode > "Page size change resets to first page"
covers: paginated-list/spec.md > ADDED > PaginatedList infinite scroll mode > "Scroll to bottom triggers load more"
covers: paginated-list/spec.md > ADDED > PaginatedList infinite scroll mode > "No more data stops loading"
covers: paginated-list/spec.md > ADDED > PaginatedList infinite scroll mode > "Custom scroll root"
covers: paginated-list/spec.md > ADDED > PaginatedList loading states > "Button mode loading"
covers: paginated-list/spec.md > ADDED > PaginatedList loading states > "Infinite mode loading"
covers: paginated-list/spec.md > ADDED > PaginatedList total count display > "Show total count"

**Files:**

- Create: `dashboard/src/components/lists/PaginatedList.tsx`

- [ ] **Step 1: Implement PaginatedList component**

Create `dashboard/src/components/lists/PaginatedList.tsx`:

```tsx
"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface PaginatedListButtonProps {
  mode: "button";
  /** Current page (1-indexed). */
  page: number;
  /** Total pages. */
  totalPages: number;
  /** Called when user clicks a page button. */
  onPageChange: (page: number) => void;
}

interface PaginatedListInfiniteProps {
  mode: "infinite";
  /** Whether more data is available. */
  hasMore: boolean;
  /** Called when sentinel enters viewport. */
  onLoadMore: () => void;
  /** Optional scroll root ref for IntersectionObserver. */
  scrollRoot?: React.RefObject<HTMLElement | null>;
}

type PaginatedListProps = {
  /** Content to render (the actual list items). */
  children: React.ReactNode;
  /** Whether data is loading. */
  loading?: boolean;
  /** Total item count for display. */
  totalCount?: number;
  /** Number of skeleton rows in button mode loading. Default: 3, max: 5. */
  skeletonCount?: number;
} & (PaginatedListButtonProps | PaginatedListInfiniteProps);

export function PaginatedList(props: PaginatedListProps) {
  const t = useTranslations("lists");
  const { children, loading = false, totalCount } = props;

  return (
    <div className="flex flex-col gap-2">
      {/* Total count */}
      {totalCount != null && (
        <div className="text-xs text-muted-foreground px-1">
          {t("totalCount", { count: totalCount })}
        </div>
      )}

      {/* List content */}
      <div className="min-h-0 flex-1">{children}</div>

      {/* Loading state */}
      {loading && props.mode === "button" && (
        <ButtonModeLoading count={Math.min(props.skeletonCount ?? 3, 5)} />
      )}

      {/* Button pagination */}
      {props.mode === "button" && !loading && props.totalPages > 1 && (
        <ButtonPagination
          page={props.page}
          totalPages={props.totalPages}
          onPageChange={props.onPageChange}
        />
      )}

      {/* Infinite scroll sentinel */}
      {props.mode === "infinite" && (
        <InfiniteSentinel
          hasMore={props.hasMore}
          loading={loading}
          onLoadMore={props.onLoadMore}
          scrollRoot={props.scrollRoot}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button pagination sub-component
// ---------------------------------------------------------------------------

function ButtonPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  // Show up to 5 page numbers centered around current page
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              onClick={() => onPageChange(p)}
              isActive={p === page}
              className="cursor-pointer"
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

// ---------------------------------------------------------------------------
// Infinite scroll sentinel sub-component
// ---------------------------------------------------------------------------

function InfiniteSentinel({
  hasMore,
  loading,
  onLoadMore,
  scrollRoot,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  scrollRoot?: React.RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("lists");
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: scrollRoot?.current ?? null, threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, scrollRoot]);

  if (!hasMore && !loading) {
    return <div className="text-center py-3 text-xs text-muted-foreground">{t("noMoreData")}</div>;
  }

  return (
    <div ref={sentinelRef} className="flex items-center justify-center py-3">
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading rows
// ---------------------------------------------------------------------------

function ButtonModeLoading({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement PaginatedList with button + infinite modes" \
  dashboard/src/components/lists/PaginatedList.tsx
```

---

### Task 6: Implement ListSearchBar

covers: list-search/spec.md > ADDED > ListSearchBar debounced input > "Debounced search callback"
covers: list-search/spec.md > ADDED > ListSearchBar debounced input > "Custom debounce delay"
covers: list-search/spec.md > ADDED > ListSearchBar debounced input > "Immediate clear"
covers: list-search/spec.md > ADDED > ListSearchBar match count display > "Display match count"
covers: list-search/spec.md > ADDED > ListSearchBar match count display > "No match count when empty search"
covers: list-search/spec.md > ADDED > ListSearchBar advanced filter dropdown > "Toggle advanced filters"
covers: list-search/spec.md > ADDED > ListSearchBar advanced filter dropdown > "Filter change triggers callback"
covers: list-search/spec.md > ADDED > ListSearchBar keyboard accessible > "Enter key immediate search"
covers: list-search/spec.md > ADDED > ListSearchBar keyboard accessible > "Escape key clears input"

**Files:**

- Create: `dashboard/src/components/lists/ListSearchBar.tsx`

- [ ] **Step 1: Implement ListSearchBar component**

Create `dashboard/src/components/lists/ListSearchBar.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FilterFieldDef, FilterState } from "./types";

interface ListSearchBarProps<F extends FilterState = FilterState> {
  /** Called after debounce delay with the search text. */
  onSearch: (query: string) => void;
  /** Debounce delay in milliseconds. Default: 300. */
  debounceMs?: number;
  /** Number of matches to display. Omit to hide. */
  matchCount?: number;
  /** Placeholder text override. Falls back to i18n default. */
  placeholder?: string;
  /** Advanced filter field definitions. Omit to hide filter button. */
  filters?: FilterFieldDef[];
  /** Current filter values. */
  filterValues?: F;
  /** Called when any advanced filter value changes. */
  onFilterChange?: (filters: F) => void;
  /** Optional className for the outer container. */
  className?: string;
}

export function ListSearchBar<F extends FilterState = FilterState>({
  onSearch,
  debounceMs = 300,
  matchCount,
  placeholder,
  filters,
  filterValues,
  onFilterChange,
  className,
}: ListSearchBarProps<F>) {
  const t = useTranslations("lists");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced search
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      onSearch(query);
    }, debounceMs);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, onSearch]);

  const clearSearch = useCallback(() => {
    setQuery("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearch("");
    setFiltersOpen(false);
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        onSearch(query);
      } else if (e.key === "Escape") {
        clearSearch();
      }
    },
    [query, onSearch, clearSearch],
  );

  const hasQuery = query.trim().length > 0;
  const hasFilters = filters && filters.length > 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--border)] bg-card">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? t("searchPlaceholder")}
          className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />

        {/* Match count */}
        {hasQuery && matchCount != null && (
          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
            {t("matchCount", { count: matchCount })}
          </span>
        )}

        {/* Clear button */}
        {hasQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

        {/* Advanced filter toggle */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer",
              filtersOpen && "bg-muted text-foreground",
            )}
            aria-label={t("advancedFilters")}
          >
            <SlidersHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Advanced filter area */}
      {hasFilters && filtersOpen && (
        <div className="flex flex-wrap gap-2 px-3 py-2 rounded-md border border-[var(--border-subtle)] bg-card">
          {filters.map((field) => (
            <FilterField
              key={field.key}
              field={field}
              value={(filterValues as Record<string, unknown>)?.[field.key]}
              onChange={(val) => {
                if (onFilterChange) {
                  onFilterChange({
                    ...filterValues,
                    [field.key]: val,
                  } as F);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter field renderer
// ---------------------------------------------------------------------------

function FilterField({
  field,
  value,
  onChange,
}: {
  field: FilterFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.type === "select" && field.options) {
    return (
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{field.label}</span>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="text-xs bg-transparent border border-[var(--border)] rounded px-1.5 py-0.5 text-foreground outline-none"
        >
          <option value="">—</option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "multiselect" && field.options) {
    const selected = (value as string[]) ?? [];
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{field.label}</span>
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => {
            const active = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = active
                    ? selected.filter((v) => v !== opt.value)
                    : [...selected, opt.value];
                  onChange(next.length > 0 ? next : undefined);
                }}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-[var(--border)] text-muted-foreground hover:bg-muted",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // text
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>{field.label}</span>
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="text-xs bg-transparent border border-[var(--border)] rounded px-1.5 py-0.5 text-foreground outline-none w-24"
      />
    </label>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement ListSearchBar with debounce and advanced filters" \
  dashboard/src/components/lists/ListSearchBar.tsx
```

---

### Task 7: Implement SortableHeader

covers: list-interactions/spec.md > ADDED > SortableHeader tri-state sort > "Tri-state sort cycle"
covers: list-interactions/spec.md > ADDED > SortableHeader tri-state sort > "Switch sort column"
covers: list-interactions/spec.md > ADDED > SortableHeader tri-state sort > "Keyboard activation"

**Files:**

- Create: `dashboard/src/components/lists/SortableHeader.tsx`

- [ ] **Step 1: Implement SortableHeader component**

Create `dashboard/src/components/lists/SortableHeader.tsx`:

```tsx
"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { SortDirection, SortState } from "./types";

interface SortableHeaderProps {
  /** Column key used in sort state. */
  columnKey: string;
  /** Column label text. */
  children: React.ReactNode;
  /** Current sort state from useListState. */
  sort: SortState | null;
  /** Called to update sort state. */
  onSortChange: (sort: SortState | null) => void;
  /** Optional className. */
  className?: string;
}

/**
 * Tri-state sort cycle: unsorted → asc → desc → unsorted.
 * When switching columns, always starts at asc.
 */
function nextSort(columnKey: string, current: SortState | null): SortState | null {
  if (!current || current.key !== columnKey) {
    return { key: columnKey, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { key: columnKey, direction: "desc" };
  }
  // desc → clear
  return null;
}

export function SortableHeader({
  columnKey,
  children,
  sort,
  onSortChange,
  className,
}: SortableHeaderProps) {
  const isActive = sort?.key === columnKey;
  const direction: SortDirection | null = isActive ? sort.direction : null;

  const handleClick = useCallback(() => {
    onSortChange(nextSort(columnKey, sort));
  }, [columnKey, sort, onSortChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium cursor-pointer select-none",
        "text-muted-foreground hover:text-foreground transition-colors",
        isActive && "text-foreground",
        className,
      )}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
    >
      {children}
      <SortIcon direction={direction} />
    </button>
  );
}

function SortIcon({ direction }: { direction: SortDirection | null }) {
  if (direction === "asc") {
    return <ArrowUp size={12} className="text-primary" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} className="text-primary" />;
  }
  return <ArrowUpDown size={12} className="opacity-40" />;
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement SortableHeader with tri-state cycle" \
  dashboard/src/components/lists/SortableHeader.tsx
```

---

### Task 8: Implement BatchActionBar

covers: list-interactions/spec.md > ADDED > BatchActionBar selection management > "Show selection count"
covers: list-interactions/spec.md > ADDED > BatchActionBar selection management > "Select all toggle"
covers: list-interactions/spec.md > ADDED > BatchActionBar selection management > "Partial selection indicator"
covers: list-interactions/spec.md > ADDED > BatchActionBar selection management > "Clear selection"
covers: list-interactions/spec.md > ADDED > BatchActionBar selection management > "No items selected"
covers: list-interactions/spec.md > ADDED > BatchActionBar accepts action buttons via slot > "Custom delete action"

**Files:**

- Create: `dashboard/src/components/lists/BatchActionBar.tsx`

- [ ] **Step 1: Implement BatchActionBar component**

Create `dashboard/src/components/lists/BatchActionBar.tsx`:

```tsx
"use client";

import { Minus, Square, SquareCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface BatchActionBarProps<T> {
  /** Set of selected item IDs. */
  selectedIds: Set<string>;
  /** All currently visible (filtered) items for "select all". */
  filteredItems: T[];
  /** ID extraction function. */
  idKey: (item: T) => string;
  /** Whether all filtered items are selected. */
  isAllSelected: boolean;
  /** Whether some but not all filtered items are selected. */
  isPartialSelected: boolean;
  /** Toggle select all / clear all. */
  onSelectAll: () => void;
  /** Clear all selections. */
  onClearSelection: () => void;
  /** Render prop for custom action buttons. */
  actions?: (props: { selectedIds: Set<string> }) => React.ReactNode;
  /** Optional className. */
  className?: string;
}

export function BatchActionBar<T>({
  selectedIds,
  isAllSelected,
  isPartialSelected,
  onSelectAll,
  onClearSelection,
  actions,
  className,
}: BatchActionBarProps<T>) {
  const t = useTranslations("lists");

  // Don't render when nothing is selected
  if (selectedIds.size === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md border border-primary/20 bg-[var(--primary-muted)]",
        className,
      )}
    >
      {/* Select-all checkbox */}
      <button
        type="button"
        onClick={onSelectAll}
        className="text-primary cursor-pointer"
        aria-label={t("selectAll")}
      >
        {isAllSelected ? (
          <SquareCheck size={16} />
        ) : isPartialSelected ? (
          <Minus size={16} className="text-primary" />
        ) : (
          <Square size={16} />
        )}
      </button>

      {/* Selection count */}
      <span className="text-xs font-medium text-foreground">
        {t("selected", { count: selectedIds.size })}
      </span>

      {/* Action buttons slot */}
      {actions && <div className="flex items-center gap-2 ml-auto">{actions({ selectedIds })}</div>}

      {/* Clear button */}
      <button
        type="button"
        onClick={onClearSelection}
        className="p-0.5 rounded hover:bg-muted text-muted-foreground cursor-pointer ml-auto"
        aria-label={t("clearSelection")}
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement BatchActionBar with selection management" \
  dashboard/src/components/lists/BatchActionBar.tsx
```

---

### Task 9: Implement InlineEdit

covers: list-interactions/spec.md > ADDED > InlineEdit click-to-edit > "Enter edit mode"
covers: list-interactions/spec.md > ADDED > InlineEdit click-to-edit > "Confirm with Enter"
covers: list-interactions/spec.md > ADDED > InlineEdit click-to-edit > "Cancel with Escape"
covers: list-interactions/spec.md > ADDED > InlineEdit click-to-edit > "Cancel on blur"
covers: list-interactions/spec.md > ADDED > InlineEdit click-to-edit > "Select type inline edit"

**Files:**

- Create: `dashboard/src/components/lists/InlineEdit.tsx`

- [ ] **Step 1: Implement InlineEdit component**

Create `dashboard/src/components/lists/InlineEdit.tsx`:

```tsx
"use client";

import { Check, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineEditTextProps {
  type?: "text";
  /** Current value displayed in read-only mode. */
  value: string;
  /** Called with new value when user confirms. */
  onConfirm: (value: string) => void;
  /** Optional placeholder for empty value. */
  placeholder?: string;
  /** Optional className for the outer container. */
  className?: string;
}

interface InlineEditSelectProps {
  type: "select";
  /** Current value displayed in read-only mode. */
  value: string;
  /** Called with new value when user confirms. */
  onConfirm: (value: string) => void;
  /** Options for select mode. */
  options: { value: string; label: string }[];
  /** Optional className for the outer container. */
  className?: string;
}

type InlineEditProps = InlineEditTextProps | InlineEditSelectProps;

export function InlineEdit(props: InlineEditProps) {
  const { value, onConfirm, className } = props;
  const t = useTranslations("lists");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Sync draft when value changes externally
  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  // Auto-focus on edit start
  useEffect(() => {
    if (editing) {
      if (props.type === "select") {
        selectRef.current?.focus();
      } else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
  }, [editing, props.type]);

  const startEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const confirm = useCallback(() => {
    setEditing(false);
    if (draft !== value) {
      onConfirm(draft);
    }
  }, [draft, value, onConfirm]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [confirm, cancel],
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click on confirm button
    setTimeout(() => {
      if (editing) {
        cancel();
      }
    }, 150);
  }, [editing, cancel]);

  // ----- Read-only mode -----
  if (!editing) {
    const displayValue =
      props.type === "select"
        ? (props.options.find((o) => o.value === value)?.label ?? value)
        : value;

    return (
      <button
        type="button"
        onClick={startEdit}
        className={cn(
          "group inline-flex items-center gap-1.5 text-sm cursor-pointer",
          "hover:text-primary transition-colors",
          className,
        )}
        title={t("inlineEditConfirm")}
      >
        <span className={cn(!displayValue && "text-muted-foreground italic")}>
          {displayValue || (props.type !== "select" ? (props.placeholder ?? "—") : "—")}
        </span>
        <Pencil
          size={12}
          className="opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground"
        />
      </button>
    );
  }

  // ----- Edit mode: select -----
  if (props.type === "select") {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <select
          ref={selectRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setEditing(false);
            if (e.target.value !== value) {
              onConfirm(e.target.value);
            }
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="text-sm bg-transparent border border-primary rounded px-1.5 py-0.5 outline-none text-foreground"
        >
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // ----- Edit mode: text -----
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="text-sm bg-transparent border border-primary rounded px-1.5 py-0.5 outline-none text-foreground min-w-[80px]"
      />
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(lists): implement InlineEdit with text and select modes" \
  dashboard/src/components/lists/InlineEdit.tsx
```

---

### Task 10: Integration Verification — Type Check, i18n, Dark Mode

covers: (cross-cutting verification for all specs)

**Files:**

- Modify: `dashboard/src/components/lists/index.ts` (fix any import issues)

- [ ] **Step 1: Run full type check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: PASS — zero errors across all list components.

- [ ] **Step 2: Verify i18n keys**

Confirm all `useTranslations("lists")` calls reference keys that exist in both `zh.json` and `en.json`:

```bash
cd dashboard && grep -rn 't("' src/components/lists/ | grep -oP 't\("\K[^"]+' | sort -u
```

Cross-check each key exists in `src/i18n/zh.json` and `src/i18n/en.json` under the `"lists"` namespace.

- [ ] **Step 3: Verify no hardcoded colors**

```bash
cd dashboard && grep -rn '#[0-9a-fA-F]\{3,6\}\|bg-white\|bg-black\|text-gray' src/components/lists/
```

Expected: No matches (all colors use CSS variables or Tailwind semantic classes).

- [ ] **Step 4: Verify barrel export completeness**

Open `dashboard/src/components/lists/index.ts` and confirm all 7 components + types are exported. Test import resolution:

```bash
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
scripts/committer "[enhanced] fix(lists): integration fixes for shared list infra" \
  dashboard/src/components/lists/index.ts
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                | Task   |
| --------------------------------------------------------------- | ------ |
| virtual-list / VirtualList renders only visible items (ADDED)   | Task 4 |
| virtual-list / VirtualList supports scroll restoration (ADDED)  | Task 4 |
| virtual-list / VirtualList uses render prop pattern (ADDED)     | Task 4 |
| virtual-list / VirtualList shows empty state (ADDED)            | Task 4 |
| paginated-list / PaginatedList button mode (ADDED)              | Task 5 |
| paginated-list / PaginatedList infinite scroll mode (ADDED)     | Task 5 |
| paginated-list / PaginatedList loading states (ADDED)           | Task 5 |
| paginated-list / PaginatedList total count display (ADDED)      | Task 5 |
| list-search / ListSearchBar debounced input (ADDED)             | Task 6 |
| list-search / ListSearchBar match count display (ADDED)         | Task 6 |
| list-search / ListSearchBar advanced filter dropdown (ADDED)    | Task 6 |
| list-search / ListSearchBar keyboard accessible (ADDED)         | Task 6 |
| list-interactions / SortableHeader tri-state sort (ADDED)       | Task 7 |
| list-interactions / BatchActionBar selection management (ADDED) | Task 8 |
| list-interactions / InlineEdit click-to-edit (ADDED)            | Task 9 |
| list-state-hook / useListState filter capability (ADDED)        | Task 2 |
| list-state-hook / useListState sort capability (ADDED)          | Task 2 |
| list-state-hook / useListState pagination capability (ADDED)    | Task 3 |
| list-state-hook / useListState selection capability (ADDED)     | Task 3 |
| list-state-hook / useListState auto-reset behaviors (ADDED)     | Task 3 |

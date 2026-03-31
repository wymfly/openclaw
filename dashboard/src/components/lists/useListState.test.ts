// @vitest-environment jsdom
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

describe("useListState — edge cases", () => {
  it("sorts null values to the end", () => {
    const data = [
      { id: "1", name: "Alice", score: 90 },
      { id: "2", name: "Bob", score: null as unknown as number },
      { id: "3", name: "Charlie", score: 85 },
    ];
    const { result } = renderHook(() => useListState({ data }));

    act(() => result.current.setSort({ key: "score", direction: "asc" }));
    expect(result.current.sortedData.map((i) => i.score)).toEqual([85, 90, null]);
  });

  it("sorts string fields without custom sortFn", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS }));

    act(() => result.current.setSort({ key: "name", direction: "asc" }));
    expect(result.current.sortedData.map((i) => i.name)).toEqual([
      "Alice", "Bob", "Charlie", "Diana", "Eve",
    ]);
  });

  it("clamps setPage to minimum 1", () => {
    const { result } = renderHook(() => useListState({ data: ITEMS, pageSize: 2 }));

    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(-1));
    expect(result.current.page).toBe(1);
  });

  it("selectAll selects only filtered items when filter is active", () => {
    const { result } = renderHook(() =>
      useListState({
        data: ITEMS,
        filterFn: (item, filters: { search?: string }) => {
          if (!filters.search) return true;
          return item.name.toLowerCase().includes(filters.search.toLowerCase());
        },
      }),
    );

    act(() => result.current.setFilters({ search: "ali" }));
    // "ali" matches only Alice
    act(() => result.current.selectAll());
    expect(result.current.selectedIds.size).toBe(1);
    expect(result.current.isAllSelected).toBe(true);
  });
});

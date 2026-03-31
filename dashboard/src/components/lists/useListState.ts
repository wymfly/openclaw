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

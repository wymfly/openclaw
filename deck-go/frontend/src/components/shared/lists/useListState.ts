import { useCallback, useMemo, useState } from "react";
import type { FilterState, SortState, UseListStateOptions, UseListStateReturn } from "./types";

function defaultIdKey<T>(item: T) {
  const id = (item as Record<string, unknown>).id;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

function compareUnknownValues(aVal: unknown, bVal: unknown, sort: SortState) {
  if (aVal == null && bVal == null) {
    return 0;
  }
  if (aVal == null) {
    return 1;
  }
  if (bVal == null) {
    return -1;
  }
  if (typeof aVal === "string" && typeof bVal === "string") {
    return sort.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  }
  if (typeof aVal === "number" && typeof bVal === "number") {
    const diff = aVal - bVal;
    return sort.direction === "asc" ? diff : -diff;
  }
  const aText = typeof aVal === "string" ? aVal : JSON.stringify(aVal ?? "");
  const bText = typeof bVal === "string" ? bVal : JSON.stringify(bVal ?? "");
  return sort.direction === "asc" ? aText.localeCompare(bText) : bText.localeCompare(aText);
}

export function useListState<T, F extends FilterState = FilterState>(
  options: UseListStateOptions<T, F>,
): UseListStateReturn<T, F> {
  const { data, filterFn, idKey = defaultIdKey, pageSize: initialPageSize = 0, sortFn } = options;
  const [filters, setFiltersRaw] = useState({} as F);
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sort, setSortRaw] = useState<SortState | null>(null);

  const filteredData = useMemo(() => {
    return filterFn ? data.filter((item) => filterFn(item, filters)) : data;
  }, [data, filterFn, filters]);

  const sortedData = useMemo(() => {
    if (!sort) {
      return filteredData;
    }
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      if (sortFn) {
        return sortFn(a, b, sort);
      }
      return compareUnknownValues(
        (a as Record<string, unknown>)[sort.key],
        (b as Record<string, unknown>)[sort.key],
        sort,
      );
    });
    return sorted;
  }, [filteredData, sort, sortFn]);

  const totalPages = useMemo(() => {
    if (pageSize <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(sortedData.length / pageSize));
  }, [pageSize, sortedData.length]);

  const paginatedData = useMemo(() => {
    if (pageSize <= 0) {
      return sortedData;
    }
    const effectivePage = Math.min(page, totalPages);
    const start = (effectivePage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [page, pageSize, sortedData, totalPages]);

  const isAllSelected = useMemo(() => {
    return filteredData.length > 0 && filteredData.every((item) => selectedIds.has(idKey(item)));
  }, [filteredData, idKey, selectedIds]);

  const isPartialSelected = useMemo(() => {
    const someSelected = filteredData.some((item) => selectedIds.has(idKey(item)));
    return someSelected && !isAllSelected;
  }, [filteredData, idKey, isAllSelected, selectedIds]);

  const setFilters = useCallback((newFilters: F) => {
    setFiltersRaw(newFilters);
    setPageRaw(1);
    setSelectedIds(new Set<string>());
  }, []);

  const setSort = useCallback((newSort: SortState | null) => {
    setSortRaw(newSort);
  }, []);

  const setPage = useCallback((newPage: number) => {
    setPageRaw(Math.max(1, newPage));
  }, []);

  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeRaw(newPageSize);
    setPageRaw(1);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
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
    setSelectedIds(new Set<string>());
  }, []);

  return {
    clearSelection,
    filteredData,
    filters,
    isAllSelected,
    isPartialSelected,
    page,
    paginatedData,
    pageSize,
    selectedIds,
    selectAll,
    setFilters,
    setPage,
    setPageSize,
    setSort,
    sort,
    sortedData,
    toggleSelect,
    totalPages,
  };
}

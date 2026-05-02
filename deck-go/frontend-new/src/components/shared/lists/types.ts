export type SortDirection = "asc" | "desc";

export type SortState<K extends string = string> = {
  direction: SortDirection;
  key: K;
};

export type FilterState = Record<string, unknown>;

export type UseListStateOptions<T, F extends FilterState = FilterState> = {
  data: T[];
  filterFn?: (item: T, filters: F) => boolean;
  idKey?: (item: T) => string;
  pageSize?: number;
  sortFn?: (a: T, b: T, sort: SortState) => number;
};

export type UseListStateReturn<T, F extends FilterState = FilterState> = {
  clearSelection: () => void;
  filteredData: T[];
  filters: F;
  isAllSelected: boolean;
  isPartialSelected: boolean;
  page: number;
  paginatedData: T[];
  pageSize: number;
  selectedIds: Set<string>;
  selectAll: () => void;
  setFilters: (filters: F) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sort: SortState | null) => void;
  sort: SortState | null;
  sortedData: T[];
  toggleSelect: (id: string) => void;
  totalPages: number;
};

export type FilterFieldDef = {
  key: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  type: "multiselect" | "select" | "text";
};

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

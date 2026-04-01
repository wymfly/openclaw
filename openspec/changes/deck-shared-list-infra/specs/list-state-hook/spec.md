## ADDED Requirements

### Requirement: useListState manages filter state

useListState SHALL 接收 `data` 数组和 `filterFn` 过滤函数，返回 `filteredData`（经过滤的数据）和 `setFilters` 函数。

#### Scenario: Apply text filter

- **WHEN** 调用 `setFilters({ search: "test" })` 且 `filterFn` 基于 search 字段过滤
- **THEN** `filteredData` SHALL 仅包含通过 `filterFn` 的项，并通过 `useMemo` 缓存

#### Scenario: Clear filters

- **WHEN** 调用 `setFilters({})` 清空所有过滤条件
- **THEN** `filteredData` SHALL 等于原始 `data`

#### Scenario: Filter change resets page

- **WHEN** 当前在第 3 页，用户修改过滤条件
- **THEN** 分页 SHALL 自动重置到第 1 页

### Requirement: useListState manages sort state

useListState SHALL 接收可选的 `sortFn` 或默认使用基于 `sortKey` + `sortDirection` 的通用排序，返回 `sortedData` 和 `setSort` 函数。

#### Scenario: Sort by key ascending

- **WHEN** 调用 `setSort({ key: "name", direction: "asc" })`
- **THEN** `sortedData` SHALL 按 name 字段升序排列

#### Scenario: Clear sort

- **WHEN** 调用 `setSort(null)`
- **THEN** `sortedData` SHALL 恢复原始数据顺序（即 filteredData 顺序）

#### Scenario: Custom sort function

- **WHEN** 传入自定义 `sortFn`
- **THEN** SHALL 使用该函数排序，忽略默认的 key-based 排序

### Requirement: useListState manages pagination state

useListState SHALL 返回 `paginatedData`（当前页数据）、`page`、`pageSize`、`totalPages` 和 `setPage`/`setPageSize` 函数。

#### Scenario: Get current page data

- **WHEN** filteredData 有 100 项、pageSize=20、page=2
- **THEN** `paginatedData` SHALL 返回第 21-40 项

#### Scenario: Page size change adjusts total pages

- **WHEN** filteredData 有 100 项，pageSize 从 20 改为 50
- **THEN** `totalPages` SHALL 变为 2，page 重置为 1

#### Scenario: Disable pagination

- **WHEN** 未传 `pageSize` 或 `pageSize` 为 0
- **THEN** `paginatedData` SHALL 等于 `sortedData`（全量数据），分页相关状态不可用

### Requirement: useListState manages selection state

useListState SHALL 返回 `selectedIds` Set、`toggleSelect`、`selectAll`、`clearSelection` 函数和 `isAllSelected` / `isPartialSelected` 布尔值。

#### Scenario: Toggle single item

- **WHEN** 调用 `toggleSelect("item-1")`
- **THEN** 如果 "item-1" 未选中则加入 `selectedIds`，如果已选中则移除

#### Scenario: Select all filtered items

- **WHEN** 调用 `selectAll()`
- **THEN** `selectedIds` SHALL 包含当前 `filteredData` 中所有项的 id（需要 `idKey` prop 指定 id 字段）

#### Scenario: Clear selection on filter change

- **WHEN** 过滤条件变化
- **THEN** `selectedIds` SHALL 自动清空（避免选中不可见项）

### Requirement: useListState returns combined output

useListState SHALL 返回一个统一的对象，包含所有状态和操作函数，方便解构使用。

#### Scenario: Destructure all capabilities

- **WHEN** 调用 `const { filteredData, paginatedData, sortedData, page, totalPages, selectedIds, setFilters, setSort, setPage, toggleSelect, selectAll, clearSelection } = useListState({ data, filterFn, pageSize: 20, idKey: "id" })`
- **THEN** 所有返回值 SHALL 类型安全（TypeScript 泛型推导 T 从 data 数组元素类型）

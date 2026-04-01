## 1. 基础设施准备

- [x] 1.1 安装 shadcn Table 和 Pagination UI 组件（`npx shadcn@latest add table pagination`），验证 `dashboard/src/components/ui/table.tsx` 和 `pagination.tsx` 生成
- [x] 1.2 创建 `dashboard/src/components/lists/` 目录结构，添加 `types.ts`（共享类型：SortDirection、FilterState、PaginationState、SelectionState 等）和 `index.ts` barrel export
- [x] 1.3 在 `zh.json` 和 `en.json` 中添加 `lists` 命名空间（empty、totalCount、selected、loadMore、noMoreData、searchPlaceholder、clearFilters 等 i18n key）

## 2. 核心 Hook: useListState

- [x] 2.1 实现 `useListState<T>` hook 的 filter 能力：接收 `data: T[]`、`filterFn`、`filters` 状态，返回 `filteredData`（useMemo 缓存）和 `setFilters`
- [x] 2.2 实现 sort 能力：`setSort({ key, direction })`、自定义 `sortFn`、`sortedData` 输出
- [x] 2.3 实现 pagination 能力：`page`、`pageSize`、`totalPages`、`paginatedData`、`setPage`/`setPageSize`，filter 变化自动重置 page
- [x] 2.4 实现 selection 能力：`selectedIds` Set、`toggleSelect`、`selectAll`、`clearSelection`、`isAllSelected`/`isPartialSelected`，filter 变化自动清空选择
- [x] 2.5 编写 useListState 单元测试（覆盖 filter/sort/pagination/selection 的状态联动场景）

## 3. 列表渲染组件

- [x] 3.1 实现 VirtualList 组件：基于 `@tanstack/react-virtual` 的 `useVirtualizer`，支持 `estimateSize`（固定/动态行高）、`overscan`、`renderItem` render prop、`emptyState`
- [x] 3.2 实现 VirtualList 滚动恢复：`scrollRestorationKey` prop + sessionStorage 持久化滚动位置
- [x] 3.3 实现 PaginatedList 组件：`mode="button"` 使用 shadcn Pagination、`mode="infinite"` 使用 IntersectionObserver sentinel
- [x] 3.4 实现 PaginatedList 的 loading 状态（button 模式 skeleton 行、infinite 模式 spinner）、totalCount 显示、hasMore/onLoadMore 接口

## 4. 交互组件

- [x] 4.1 实现 ListSearchBar：debounced input（默认 300ms）、matchCount 显示、清除按钮、Enter 立即搜索、Escape 清空
- [x] 4.2 实现 ListSearchBar 高级过滤下拉：`filters` prop 驱动的可展开过滤区域、`onFilterChange` 回调
- [x] 4.3 实现 SortableHeader：三态排序循环（无→升→降→无）、排序指示器图标、键盘可访问（Enter/Space）
- [x] 4.4 实现 BatchActionBar：选中计数显示、全选/半选/取消 checkbox、`actions` render prop 按钮插槽
- [x] 4.5 实现 InlineEdit：click-to-edit 模式（文本/选择器）、Enter 确认、Escape/blur 取消、auto-focus

## 5. 集成验证

- [x] 5.1 创建 Storybook-like 验证页面或独立测试面板，组合演示 VirtualList + useListState + SortableHeader + ListSearchBar 的完整数据流
- [x] 5.2 验证所有组件的 dark mode 样式正确（使用 shadcn 标准变量 + 扩展令牌，无硬编码颜色）
- [x] 5.3 验证所有用户可见文字通过 i18n `useTranslations("lists")` 调用，中英文切换正确
- [x] 5.4 运行 `tsc --noEmit` 确保零类型错误，所有组件泛型类型正确推导

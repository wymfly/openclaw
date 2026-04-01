## Why

Deck Dashboard 的 25+ 面板中有大量列表/表格 UI（AgentList、SessionList、RunHistory、DocList、SkillList 等），但每个面板独立实现分页、搜索、排序、虚拟滚动等逻辑，导致：

1. **行为不一致** — 有的用 "Load More" 按钮（SubagentHistoryTab, visibleCount += 20），有的用 IntersectionObserver 无限滚动（MonitorHistoryTab），有的无分页直接全量渲染（RunHistory），用户体验碎片化
2. **大量重复代码** — 每个面板重复实现 filter state + `useMemo` 过滤/排序 + 可见数量管理 + 空状态 + loading 骨架，模式相同但实现各异
3. **缺少共享 UI 原语** — shadcn/ui 未安装 Table、Pagination 组件，列表排序头、批量操作栏、行内编辑等基础交互在每处从头构建
4. **后续提案的前置依赖** — Usage 面板重建（多维度表格）、Sessions/Logs 加固（高级搜索+分页）均需要统一的列表基础设施

`@tanstack/react-virtual` v3.13.23 已安装但仅用于 VirtualScrollResult（纯文本行），需要将其能力扩展为通用列表虚拟化方案。

## What Changes

- 新增 `dashboard/src/components/lists/` 目录，提供可组合的列表基础组件
- **VirtualList** — 基于 `@tanstack/react-virtual` 的通用虚拟滚动列表，支持动态行高、overscan 配置、滚动恢复
- **PaginatedList** — 统一分页容器，支持两种模式：按钮分页（固定 pageSize）和 IntersectionObserver 无限加载（cursor-based）
- **ListSearchBar** — 统一搜索栏组件，内置 debounce（默认 300ms，参考 TranscriptSearch）、清除按钮、匹配计数、可选的高级过滤下拉
- **SortableHeader** — 可排序列头，支持升序/降序/默认三态切换、排序指示器
- **BatchActionBar** — 批量选择操作栏，支持全选/部分选/取消，显示选中数量，提供批量操作按钮插槽
- **InlineEdit** — 行内编辑组件，click-to-edit 模式，支持文本/选择器类型，ESC 取消 / Enter 确认
- **useListState hook** — 统一列表状态管理（过滤、排序、分页、选择），可与 Zustand store 集成
- 新增 shadcn Table 和 Pagination UI 原语作为底层样式基础

## Capabilities

### New Capabilities

- `virtual-list`: 基于 @tanstack/react-virtual 的通用虚拟滚动列表组件，支持动态行高和滚动恢复
- `paginated-list`: 统一分页容器，支持按钮分页和 cursor-based 无限加载两种模式
- `list-search`: 列表搜索栏组件，内置 debounce、匹配计数、高级过滤支持
- `list-interactions`: 排序列头（SortableHeader）、批量操作栏（BatchActionBar）、行内编辑（InlineEdit）等交互原语
- `list-state-hook`: useListState 统一列表状态管理 hook（过滤、排序、分页、选择）

### Modified Capabilities

(none)

## Impact

- **新文件**: `dashboard/src/components/lists/` 下 7+ 组件文件 + `useListState.ts` hook
- **UI 原语**: 需安装 shadcn Table 和 Pagination 组件到 `dashboard/src/components/ui/`
- **依赖**: 无新 npm 依赖，复用已有 `@tanstack/react-virtual`
- **i18n**: 新增 `lists` 命名空间到 `zh.json` / `en.json`（空状态、分页、搜索占位符等通用文案）
- **下游影响**: 提案 2（Usage 面板重建）和提案 7（Sessions/Logs 加固）将直接消费这些组件
- **迁移路径**: 现有面板不强制迁移，新组件提供渐进式替换路径

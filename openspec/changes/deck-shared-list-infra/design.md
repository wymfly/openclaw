## Context

Deck Dashboard 当前有 25+ 面板，其中至少 12 个包含列表/表格 UI。每个面板独立实现列表行为：

| 面板                | 分页方式                       | 搜索              | 排序 | 虚拟滚动    |
| ------------------- | ------------------------------ | ----------------- | ---- | ----------- |
| SubagentHistoryTab  | Load More (visibleCount += 20) | ❌                | ❌   | ❌          |
| MonitorHistoryTab   | IntersectionObserver + cursor  | ✅ 输入框         | ❌   | ❌          |
| SessionList         | 无分页（全量）                 | ❌                | ❌   | ❌          |
| RunHistory (Cron)   | 无分页（全量 HTML table）      | ❌                | ❌   | ❌          |
| DocList             | 无分页（client-side filter）   | ✅ 文本匹配       | ❌   | ❌          |
| SkillList           | 无分页（grouped filter）       | ✅ + 状态过滤     | ❌   | ❌          |
| TranscriptSearch    | —                              | ✅ debounce 300ms | ❌   | ❌          |
| VirtualScrollResult | —                              | ❌                | ❌   | ✅ 固定行高 |

现有基础设施：

- `@tanstack/react-virtual` v3.13.23 已安装，仅 VirtualScrollResult 使用（固定行高 20px，纯文本行）
- shadcn/ui 已安装 Badge/Button/Card/Dialog/Input/Select/Tabs 等，**未安装 Table/Pagination**
- Zustand 作为状态管理，所有面板通过 `useXxxStore()` hook 消费数据
- `next-intl` 的 `useTranslations()` 用于所有用户可见文字

## Goals / Non-Goals

**Goals:**

- 提供可组合的列表基础组件库（`dashboard/src/components/lists/`），统一列表 UX 行为
- 支持三种渲染策略：全量（小列表 < 100 项）、分页（中列表）、虚拟滚动（大列表 1000+）
- 提供统一的 `useListState` hook 管理过滤/排序/分页/选择状态
- 与 Zustand store 无缝集成，不强制改变现有 store 结构
- 遵循 Deck 设计系统（shadcn 标准变量 + 扩展令牌）、i18n 规范、HTML 合规规范

**Non-Goals:**

- 不引入 `@tanstack/react-table` — 避免引入重型依赖，用轻量组合 cover 需求
- 不强制迁移现有面板 — 提供渐进式替换路径，现有面板按需迁移
- 不实现服务端排序/过滤 — 当前 Deck 列表数据量适合客户端处理，服务端分页由 cursor-based API 原生支持
- 不实现拖拽排序 — 无当前需求

## Decisions

### D1: 组合式 API 而非单一 DataTable

**选择**: 提供独立的 VirtualList、PaginatedList、SortableHeader、BatchActionBar 等组件，通过 `useListState` hook 组合使用。

**替代方案**: 单一 `<DataTable>` 组件封装所有能力（类似 Ant Design Table）。

**理由**: Deck 的列表形态差异大（卡片列表、网格行、展开详情行、分组列表），单一 DataTable 的 props 会爆炸式增长。组合式 API 让每个面板按需组装，复杂度可控。同时与 shadcn/ui 的无头组件哲学一致。

### D2: useListState 作为状态中枢

**选择**: 单一 `useListState<T>` hook 管理所有列表状态（filters、sort、pagination、selection），返回派生的 `filteredData`、`paginatedData` 和操作函数。

**替代方案 A**: 分离的 hooks（useFilter、useSort、usePagination）各自独立。

**替代方案 B**: 将列表状态合并到 Zustand store。

**理由**: 分离 hooks 需要手动协调（排序变化时重置页码等），组合为单一 hook 保证状态一致性。不合并到 Zustand 是因为列表状态是 UI 状态（非业务状态），应随组件卸载清除。Zustand store 只负责数据获取。

### D3: shadcn Table + Pagination 作为样式基础

**选择**: 安装 shadcn/ui 的 Table（`<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>`）和 Pagination 组件作为底层样式原语。列表组件在其上构建。

**理由**: 与已有 shadcn 组件风格统一，自动获得 dark mode 支持。Table 组件仅提供语义化标签 + 样式，不绑定数据逻辑，与组合式 API 无冲突。

### D4: 虚拟滚动复用 @tanstack/react-virtual

**选择**: VirtualList 基于已安装的 `@tanstack/react-virtual`，扩展 VirtualScrollResult 的模式支持动态行高。

**替代方案**: 引入 `react-window` 或 `react-virtuoso`。

**理由**: 已有依赖，团队已有使用经验（VirtualScrollResult），`@tanstack/react-virtual` 是无头库，不限制 DOM 结构，与组合式 API 天然契合。

### D5: 分页模式统一为 PaginatedList 的两种 mode

**选择**: `<PaginatedList mode="button" | "infinite">` 统一两种分页模式。button 模式使用 shadcn Pagination 组件，infinite 模式使用 IntersectionObserver sentinel。

**理由**: 两种模式共享 pageSize 管理、loading 状态、空状态处理，只在触发方式上不同。统一组件减少重复代码，同时保留面板选择分页方式的灵活性。

### D6: 文件组织

```
dashboard/src/components/lists/
├── VirtualList.tsx           # 虚拟滚动列表
├── PaginatedList.tsx         # 分页容器（button / infinite）
├── ListSearchBar.tsx         # 搜索栏 + 高级过滤
├── SortableHeader.tsx        # 可排序列头
├── BatchActionBar.tsx        # 批量操作栏
├── InlineEdit.tsx            # 行内编辑
├── useListState.ts           # 列表状态管理 hook
├── types.ts                  # 共享类型定义
└── index.ts                  # barrel export
```

## Risks / Trade-offs

- **[组合复杂度]** 组合式 API 的灵活性代价是面板需要手动组装多个组件 → 通过完善的 TypeScript 类型提示和 JSDoc 文档降低上手门槛；后续可按需提供预组合的 `<SimpleList>` 快捷组件
- **[性能回归]** useListState 在大数据集上的 filter/sort 可能阻塞主线程 → filteredData 使用 `useMemo` 缓存，大数据集（> 5000 项）文档建议使用虚拟滚动模式
- **[渐进迁移协调]** 新旧列表组件并存期间的样式不一致 → 新组件使用相同的 CSS 变量体系，视觉差异最小
- **[IntersectionObserver 兼容]** 嵌套滚动容器中 IntersectionObserver 可能不触发 → PaginatedList 的 root 参数允许指定滚动容器，默认 viewport

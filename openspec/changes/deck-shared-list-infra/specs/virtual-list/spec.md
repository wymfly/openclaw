## ADDED Requirements

### Requirement: VirtualList renders only visible items

VirtualList SHALL use `@tanstack/react-virtual` 的 `useVirtualizer` 渲染仅可视区域内的列表项，支持固定行高和动态行高两种模式。

#### Scenario: Fixed height rendering

- **WHEN** VirtualList 接收 `estimateSize={() => 48}` 且数据量为 5000 项
- **THEN** DOM 中渲染的行元素数量 SHALL 不超过 `visibleCount + 2 * overscan`（默认 overscan=5）

#### Scenario: Dynamic height rendering

- **WHEN** VirtualList 接收 `estimateSize` 函数且各行实际高度不同
- **THEN** virtualizer SHALL 在行挂载后通过 `measureElement` 回调校正行高，滚动位置保持正确

### Requirement: VirtualList supports scroll restoration

VirtualList SHALL 在组件 remount 时恢复之前的滚动位置（通过可选的 `scrollRestorationKey` prop）。

#### Scenario: Tab switch scroll restoration

- **WHEN** 用户从列表 Tab 切换到其他 Tab 再切回
- **THEN** 列表 SHALL 恢复到之前的滚动偏移量，而非重置到顶部

#### Scenario: No restoration key provided

- **WHEN** VirtualList 未传 `scrollRestorationKey`
- **THEN** 组件 SHALL 正常渲染，不执行滚动恢复逻辑

### Requirement: VirtualList accepts render prop for items

VirtualList SHALL 通过 `renderItem` render prop 渲染每一行，将 `{ item, index, virtualRow }` 传递给调用方。

#### Scenario: Custom row rendering

- **WHEN** 调用方传入 `renderItem={({ item, index }) => <CustomRow data={item} />}`
- **THEN** 每个可见行 SHALL 使用该 render prop 渲染，并正确传递 item 数据和索引

### Requirement: VirtualList displays empty state

VirtualList SHALL 在数据为空数组时渲染 `emptyState` prop 内容，或默认的空状态提示（通过 i18n `lists.empty` key）。

#### Scenario: Empty data with custom empty state

- **WHEN** `data` 为空数组且传入 `emptyState={<NoResults />}`
- **THEN** SHALL 渲染 `<NoResults />` 组件，不渲染虚拟滚动容器

#### Scenario: Empty data with default empty state

- **WHEN** `data` 为空数组且未传 `emptyState`
- **THEN** SHALL 渲染默认空状态文本（i18n key: `lists.empty`）

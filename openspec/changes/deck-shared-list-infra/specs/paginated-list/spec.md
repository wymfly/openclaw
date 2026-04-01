## ADDED Requirements

### Requirement: PaginatedList supports button pagination mode

PaginatedList SHALL 在 `mode="button"` 时渲染 shadcn Pagination 组件（上一页/下一页/页码），按 `pageSize` 分割数据。

#### Scenario: Navigate pages with buttons

- **WHEN** 数据 100 项、`pageSize=20`、用户点击第 3 页按钮
- **THEN** SHALL 显示第 41-60 项，Pagination 组件高亮第 3 页，上一页/下一页按钮均可用

#### Scenario: Page size change resets to first page

- **WHEN** 用户更改 pageSize（如从 20 改为 50）
- **THEN** SHALL 重置到第 1 页，按新 pageSize 显示数据

### Requirement: PaginatedList supports infinite scroll mode

PaginatedList SHALL 在 `mode="infinite"` 时使用 IntersectionObserver 监听 sentinel 元素，触发加载更多数据。

#### Scenario: Scroll to bottom triggers load more

- **WHEN** sentinel 元素进入视口且 `hasMore` 为 true 且 `loading` 为 false
- **THEN** SHALL 调用 `onLoadMore` 回调

#### Scenario: No more data stops loading

- **WHEN** `hasMore` 为 false
- **THEN** sentinel 元素 SHALL 不再触发 `onLoadMore`，可选显示 "已加载全部" 提示

#### Scenario: Custom scroll root

- **WHEN** 传入 `scrollRoot` ref 指定嵌套滚动容器
- **THEN** IntersectionObserver SHALL 使用该容器作为 root，而非 viewport

### Requirement: PaginatedList shows loading state

PaginatedList SHALL 在 `loading` 为 true 时渲染加载指示器（button 模式在底部显示 skeleton 行，infinite 模式在 sentinel 处显示 spinner）。

#### Scenario: Button mode loading

- **WHEN** `mode="button"` 且 `loading` 为 true
- **THEN** SHALL 在列表底部渲染 skeleton 占位行（数量等于 pageSize，最多 5 行）

#### Scenario: Infinite mode loading

- **WHEN** `mode="infinite"` 且 `loading` 为 true
- **THEN** SHALL 在 sentinel 位置渲染 spinner 动画

### Requirement: PaginatedList displays total count

PaginatedList SHALL 在列表顶部或底部显示数据总量（格式通过 i18n key `lists.totalCount` 模板化）。

#### Scenario: Show total count

- **WHEN** `totalCount` prop 传入（或从 data.length 推导）
- **THEN** SHALL 显示 "共 {count} 项"（中文）/ "{count} items"（英文）

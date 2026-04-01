## ADDED Requirements

### Requirement: ListSearchBar provides debounced search input

ListSearchBar SHALL 渲染搜索输入框，内置 debounce 延迟（默认 300ms，可通过 `debounceMs` prop 覆盖），在 debounce 结束后调用 `onSearch` 回调。

#### Scenario: Debounced search callback

- **WHEN** 用户输入 "test" 后停止输入 300ms
- **THEN** SHALL 仅调用一次 `onSearch("test")`，中间的逐字输入不触发回调

#### Scenario: Custom debounce delay

- **WHEN** 传入 `debounceMs={500}`
- **THEN** SHALL 在用户停止输入 500ms 后触发 `onSearch`

#### Scenario: Immediate clear

- **WHEN** 用户点击清除按钮（X）
- **THEN** SHALL 立即调用 `onSearch("")`，不等待 debounce

### Requirement: ListSearchBar shows match count

ListSearchBar SHALL 在输入框右侧显示匹配数量（通过 `matchCount` prop），格式为 `{count} 个结果`。

#### Scenario: Display match count

- **WHEN** `matchCount` 传入值为 42 且搜索框有输入
- **THEN** SHALL 在输入框内右侧显示 "42 个结果"（中文）/ "42 results"（英文）

#### Scenario: No match count when empty search

- **WHEN** 搜索框为空
- **THEN** SHALL 不显示 matchCount，即使 prop 有值

### Requirement: ListSearchBar supports advanced filter dropdown

ListSearchBar SHALL 支持可选的 `filters` prop，渲染高级过滤下拉区域（展开/收起），包含多个 filter 字段。

#### Scenario: Toggle advanced filters

- **WHEN** 用户点击搜索栏旁的过滤图标按钮
- **THEN** SHALL 展开/收起高级过滤区域（动画过渡）

#### Scenario: Filter change triggers callback

- **WHEN** 用户在高级过滤区域修改某个 filter 值
- **THEN** SHALL 调用 `onFilterChange` 回调，传递完整的 filter 对象

### Requirement: ListSearchBar is keyboard accessible

ListSearchBar SHALL 支持键盘操作：Enter 立即触发搜索（不等 debounce），Escape 清空输入并收起过滤。

#### Scenario: Enter key immediate search

- **WHEN** 用户在输入框中按 Enter
- **THEN** SHALL 立即调用 `onSearch` 并取消待执行的 debounce

#### Scenario: Escape key clears input

- **WHEN** 用户在输入框中按 Escape
- **THEN** SHALL 清空搜索文本、调用 `onSearch("")`、收起高级过滤（如已展开）

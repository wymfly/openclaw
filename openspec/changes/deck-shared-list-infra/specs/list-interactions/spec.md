## ADDED Requirements

### Requirement: SortableHeader renders tri-state sort indicator

SortableHeader SHALL 渲染可点击的列头，支持三态循环：无排序 → 升序 → 降序 → 无排序。

#### Scenario: Tri-state sort cycle

- **WHEN** 用户连续点击同一列头三次
- **THEN** 第一次点击切换为升序（▲ 指示器），第二次切换为降序（▼ 指示器），第三次恢复无排序（无指示器）

#### Scenario: Switch sort column

- **WHEN** 列 A 为降序排序，用户点击列 B
- **THEN** 列 A 排序清除，列 B 切换为升序

#### Scenario: Keyboard activation

- **WHEN** 列头获得焦点且用户按 Enter 或 Space
- **THEN** SHALL 触发与点击相同的排序切换行为

### Requirement: BatchActionBar shows selection state and actions

BatchActionBar SHALL 在有选中项时固定显示在列表顶部，展示选中数量和操作按钮。

#### Scenario: Show selection count

- **WHEN** 列表中有 5 项被选中
- **THEN** SHALL 显示 "已选 5 项"（中文）/ "5 selected"（英文）和操作按钮区域

#### Scenario: Select all toggle

- **WHEN** 用户点击全选 checkbox
- **THEN** SHALL 选中当前过滤后的所有项（非全量数据），全选 checkbox 变为勾选状态

#### Scenario: Partial selection indicator

- **WHEN** 部分项被选中（非空且非全部）
- **THEN** 全选 checkbox SHALL 显示半选（indeterminate）状态

#### Scenario: Clear selection

- **WHEN** 用户点击 "取消选择" 按钮
- **THEN** SHALL 清除所有选中项，BatchActionBar 隐藏

#### Scenario: No items selected

- **WHEN** 没有任何项被选中
- **THEN** BatchActionBar SHALL 不渲染（display: none 或条件渲染）

### Requirement: BatchActionBar accepts action buttons via slot

BatchActionBar SHALL 通过 `actions` render prop 渲染自定义操作按钮，将 `selectedItems` 数组传递给调用方。

#### Scenario: Custom delete action

- **WHEN** 调用方传入 `actions={({ selectedItems }) => <Button onClick={() => onDelete(selectedItems)}>删除</Button>}`
- **THEN** SHALL 渲染该自定义按钮，点击时传递当前选中项数组

### Requirement: InlineEdit supports click-to-edit mode

InlineEdit SHALL 在只读态显示文本值，点击后切换为编辑态（输入框或选择器）。

#### Scenario: Enter edit mode

- **WHEN** 用户点击 InlineEdit 的只读文本
- **THEN** SHALL 切换为编辑态，显示输入框并自动获得焦点，输入框预填当前值

#### Scenario: Confirm with Enter

- **WHEN** 用户在编辑态按 Enter
- **THEN** SHALL 调用 `onConfirm(newValue)` 并切换回只读态

#### Scenario: Cancel with Escape

- **WHEN** 用户在编辑态按 Escape
- **THEN** SHALL 取消编辑、恢复原值、切换回只读态，不调用 `onConfirm`

#### Scenario: Cancel on blur

- **WHEN** 编辑态输入框失去焦点（非因点击确认按钮）
- **THEN** SHALL 取消编辑，恢复原值（与 Escape 行为一致）

#### Scenario: Select type inline edit

- **WHEN** InlineEdit 配置 `type="select"` 且传入 `options` 数组
- **THEN** 编辑态 SHALL 渲染 shadcn Select 下拉，而非文本输入框

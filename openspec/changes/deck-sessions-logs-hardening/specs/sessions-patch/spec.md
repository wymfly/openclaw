## ADDED Requirements

### Requirement: SessionDetail supports label editing

SessionDetail SHALL 支持通过 InlineEdit 组件编辑 session 的 label 属性。

#### Scenario: Edit session label

- **WHEN** 用户点击 session 名称/label 区域
- **THEN** SHALL 切换为编辑模式（InlineEdit），输入新 label 后 Enter 确认，调用 `sessions.patch` 保存

#### Scenario: Cancel label edit

- **WHEN** 用户按 Escape
- **THEN** SHALL 取消编辑，恢复原始 label

### Requirement: SessionDetail supports thinkingLevel editing

SessionDetail SHALL 支持修改 session 的 thinkingLevel（off/low/medium/high）。

#### Scenario: Change thinking level

- **WHEN** 用户通过 InlineEdit（type="select"）选择 "high"
- **THEN** SHALL 调用 `sessions.patch` 传入 `thinkingLevel: "high"`，更新成功后刷新显示

### Requirement: SessionDetail supports fastMode toggle

SessionDetail SHALL 提供 fastMode 开关。

#### Scenario: Toggle fast mode

- **WHEN** 用户切换 fastMode Switch
- **THEN** SHALL 调用 `sessions.patch` 传入 `fastMode: true/false`

### Requirement: Patch failure shows error

属性修改失败时 SHALL 显示错误提示。

#### Scenario: Patch API error

- **WHEN** `sessions.patch` 返回错误（如权限不足）
- **THEN** SHALL 显示 toast 通知，回滚 UI 到修改前状态

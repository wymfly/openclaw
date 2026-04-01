## ADDED Requirements

### Requirement: ConflictDialog shows field-level diff

ConflictDialog SHALL 展示字段级差异表格，每行显示冲突字段的路径、本地值、远端值。

#### Scenario: Display field-level conflicts

- **WHEN** baseHash 不匹配且 3 个字段有冲突
- **THEN** ConflictDialog SHALL 显示 3 行差异，每行包含：字段路径、本地值（左列）、远端值（右列）

#### Scenario: Highlight changed values

- **WHEN** 差异表格渲染
- **THEN** 变化的值 SHALL 用背景色高亮（本地为 warning-muted，远端为 primary-muted）

### Requirement: ConflictDialog supports per-field merge selection

ConflictDialog SHALL 支持逐字段选择保留本地值或采用远端值。

#### Scenario: Select local value for a field

- **WHEN** 用户点击某冲突字段的 "保留本地" 按钮
- **THEN** 该字段 SHALL 标记为使用本地值，其他字段不受影响

#### Scenario: Apply merged result

- **WHEN** 用户对所有冲突字段做出选择后点击 "应用"
- **THEN** SHALL 合并所有选择结果并保存配置，使用最新的 baseHash

#### Scenario: Quick resolve all

- **WHEN** 用户点击 "全部保留本地" 或 "全部采用远端"
- **THEN** SHALL 一次性选择所有字段的同一方向并应用

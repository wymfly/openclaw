## ADDED Requirements

### Requirement: Files browser displays complete file list
ContextTab 顶部 SHALL 渲染文件列表视图，调用 `agents.files.list` API 展示 agent 所有 bootstrap 文件。

#### Scenario: Display file list
- **WHEN** ContextTab 加载且 `agents.files.list` 返回 5 个文件
- **THEN** SHALL 渲染文件列表，每行显示文件名（name）、大小（size，格式化为 KB）、最后修改时间（updatedAtMs，相对时间）、状态标签（missing 标红）

#### Scenario: Click to edit file
- **WHEN** 用户点击文件列表中的某个文件
- **THEN** SHALL 调用 `agents.files.get`（如当前未缓存），在下方展开 BootstrapFileEditor 编辑该文件

#### Scenario: Missing file indicator
- **WHEN** `agents.files.list` 返回某文件 `missing: true`
- **THEN** 该文件行 SHALL 显示 "缺失" 标签（destructive 颜色），点击后提供创建选项

### Requirement: Files browser supports create missing file
文件列表 SHALL 支持为 missing 状态的文件创建初始内容。

#### Scenario: Create missing file
- **WHEN** 用户点击 missing 文件行的 "创建" 按钮
- **THEN** SHALL 在 BootstrapFileEditor 中打开空编辑器，用户输入内容后调用 `agents.files.set` 创建文件

## ADDED Requirements

### Requirement: Slash command palette appears on / input

MessageInput SHALL 在用户输入 `/` 作为行首字符时弹出命令面板 Popover，展示可用命令列表。

#### Scenario: Trigger command palette

- **WHEN** 用户在空输入框中输入 `/`
- **THEN** SHALL 在输入框上方弹出 Popover，显示 15 个可用命令（对齐官方 UI 命令集），每个显示名称和简短描述

#### Scenario: Filter commands by typing

- **WHEN** 用户输入 `/co`
- **THEN** Popover SHALL 过滤为匹配的命令（如 `/compact`），模糊匹配命令名称和描述

#### Scenario: Select command with keyboard

- **WHEN** Popover 打开时用户按 ArrowDown 选中命令并按 Enter
- **THEN** SHALL 执行该命令（调用对应的 handler）并关闭 Popover、清空输入框

#### Scenario: Dismiss palette

- **WHEN** 用户按 Escape 或点击 Popover 外部
- **THEN** Popover SHALL 关闭，输入框内容保留

### Requirement: Slash commands execute corresponding actions

每个 slash 命令 SHALL 调用对应的后端 API 或前端操作。

#### Scenario: /new creates session

- **WHEN** 用户执行 `/new`
- **THEN** SHALL 创建新 session 并切换到该 session

#### Scenario: /stop aborts run

- **WHEN** 用户在 agent 运行中执行 `/stop`
- **THEN** SHALL 调用中止 API 停止当前运行

#### Scenario: /model switches model

- **WHEN** 用户执行 `/model`
- **THEN** SHALL 弹出模型选择下拉，用户选择后通过 `sessions.patch` 更新当前 session 的模型

#### Scenario: /export exports session

- **WHEN** 用户执行 `/export`
- **THEN** SHALL 将当前 session 的消息导出为 markdown 文件并触发下载

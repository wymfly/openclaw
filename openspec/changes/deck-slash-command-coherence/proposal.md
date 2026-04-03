## Why

Deck Chat 面板的 15 个 slash 命令在后端链路（executor → API route → Gateway RPC）上已完整实现，但**前端反馈链路断裂**：配置类命令（`/fast`、`/think`、`/verbose`、`/model`）执行成功后用户在聊天面板**看不到任何变化**；`/focus` 注册了但 action handler 是空操作；`/stop` 在 abort 失败时仍乐观清除 streaming 状态。命令执行后缺乏即时可感知的 UI 反馈，用户无法确认命令是否生效，违背了"前端→Gateway→前端反馈"全链路逻辑自洽的原则。

## What Changes

- 新增 **Session 配置状态条**：在聊天面板输入框上方常驻显示当前 session 的 model、thinking level、fast mode、verbose level，命令修改后即时更新
- 新增 **命令执行 Toast 反馈**：所有修改类命令成功/失败后弹出 toast 通知（复用已有 `useNotificationsStore`）
- 修复 **`/focus` 空操作**：从命令注册表中移除（UI store 无 focusMode 支持），避免误导用户
- 修复 **`/stop` 乐观状态同步**：abort 失败时不清除 streaming 标记，并展示错误反馈
- 补全 **SessionMeta 配置字段**：`chat-types.ts` 的 `SessionMeta` 缺少 `thinkingLevel`、`fastMode`、`verboseLevel`，导致聊天面板无法读取这些状态
- 修复 **`refresh` action 无降级**：`patchSession` 成功后主动更新本地 store 而非仅依赖 SSE 推送

## Capabilities

### New Capabilities

- `session-config-bar`: 聊天面板内的常驻 session 配置状态条，显示 model/thinking/fast/verbose
- `command-feedback`: slash 命令执行后的即时 toast 反馈机制（成功确认 + 错误提示）

### Modified Capabilities

- `chat-slash-commands`: 移除 `/focus`；修复 `/stop` 状态同步；`patchSession` 成功后主动更新 store

## Impact

- **新组件**: `SessionConfigBar.tsx`（状态条）
- **修改组件**: `MessageInput.tsx`（action handler 修复 + toast 接入 + 状态条渲染位置）、`slash-commands.ts`（移除 focus）、`slash-command-executor.ts`（patchSession 返回更新后的值）
- **Store**: `chat-types.ts` SessionMeta 补全 `thinkingLevel`/`fastMode`/`verboseLevel` 字段；`chat-dispatchers.ts` 处理 sessions.changed 时同步这些字段
- **i18n**: `chat` 命名空间新增配置状态条标签和 toast 消息文本
- **无后端变更**: 所有修复基于已有 Gateway RPC 响应数据

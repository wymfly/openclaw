## MODIFIED Requirements

### Requirement: Slash commands execute corresponding actions

每个 slash 命令 SHALL 调用对应的后端 API 或前端操作，并在执行后提供可感知的反馈。

#### Scenario: /focus removed from registry

- **WHEN** 用户输入 `/` 查看命令列表
- **THEN** 命令面板 SHALL NOT 显示 `/focus` 命令（因 UI store 无 focusMode 支持，移除以避免空操作误导）

#### Scenario: /stop respects abort result

- **WHEN** 用户执行 `/stop` 且 abort API 返回非 200
- **THEN** SHALL NOT 将 session streaming 标记设为 false，SHALL 弹出 error toast

#### Scenario: /stop abort succeeds

- **WHEN** 用户执行 `/stop` 且 abort API 返回 200
- **THEN** SHALL 将 session streaming 标记设为 false，并弹出 success toast "Stopped"

#### Scenario: patchSession optimistic store update

- **WHEN** `/model`、`/think`、`/fast`、`/verbose` 执行 `patchSession` 成功（API 200）
- **THEN** executor SHALL 返回更新后的配置值（如 `{ fastMode: true }`），caller SHALL 立即更新 chat store 的 SessionMeta 对应字段（不仅依赖 SSE `refresh`）

#### Scenario: /fast status shows current value

- **WHEN** 用户执行 `/fast` 或 `/fast status`
- **THEN** SHALL 返回当前 fast mode 状态作为 system message（如 "Fast mode: on"），而非空内容

## REMOVED Requirements

### Requirement: /focus toggles focus mode

**Reason**: UI store 无 focusMode 状态，action handler 为空操作（no-op），对用户造成误导
**Migration**: 从 `SLASH_COMMANDS` 注册表和 `executeSlashCommand` switch 中移除 focus 相关代码。待 focusMode 功能实现后可重新添加

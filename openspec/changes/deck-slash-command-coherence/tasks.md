## 1. SessionMeta 字段补全 + Store 同步

- [x] 1.1 在 `dashboard/src/stores/chat-types.ts` 的 `SessionMeta` 接口添加 `thinkingLevel?: string`、`fastMode?: boolean`、`verboseLevel?: string` 字段
- [x] 1.2 在 `dashboard/src/stores/chat-dispatchers.ts` 的 `sessions.changed` SSE 事件处理中，提取并写入 thinkingLevel/fastMode/verboseLevel 到 SessionMeta
- [x] 1.3 在 `dashboard/src/stores/chat-dispatchers.ts` 的 `sessions.list` 初始加载逻辑中，从响应提取配置字段填充 SessionMeta
- [x] 1.4 类型检查：`cd dashboard && npx tsc --noEmit` 通过

## 2. Executor 反馈增强

- [x] 2.1 在 `dashboard/src/components/panels/chat/slash-command-executor.ts` 的 `SlashCommandResult` 接口添加 `toastMessage?: string` 和 `toastType?: "success" | "info" | "error"` 字段
- [x] 2.2 修改 `patchSession()` 成功时返回 toastMessage（如 "Fast mode: on"）和 `toastType: "success"`，并附带 `configUpdate` 字段（乐观更新数据）
- [x] 2.3 修改 `executeCompact()` 成功时返回 `toastMessage: "Session compacted"` + `toastType: "success"`
- [x] 2.4 修改 `executeFast()` 无参数/status 时，从 `/api/sessions` 获取当前值并返回 content（如 "Fast mode: on"）而非空内容
- [x] 2.5 修改 `executeKill()` 成功时返回 `toastMessage` 确认文本
- [x] 2.6 各 executor 函数的错误分支补充 `toastType: "error"`
- [x] 2.7 类型检查通过

## 3. 移除 /focus 命令

- [x] 3.1 从 `dashboard/src/components/panels/chat/slash-commands.ts` 的 `SLASH_COMMANDS` 数组中删除 focus 条目
- [x] 3.2 从 `dashboard/src/components/panels/chat/slash-command-executor.ts` 的 switch 中删除 focus case
- [x] 3.3 从 `SlashCommandAction` union type 中删除 `"toggle-focus"`
- [x] 3.4 从 `dashboard/src/components/panels/chat/MessageInput.tsx` 中删除 toggle-focus 注释行
- [x] 3.5 从 `dashboard/src/i18n/zh.json` 和 `en.json` 中删除 `cmd_focus` 相关 key
- [x] 3.6 类型检查通过

## 4. MessageInput action handler 修复

- [x] 4.1 在 `handleSlashCommand` 中接入 `useNotificationsStore.addToast()`：当 result 含 toastMessage 时弹出 toast
- [x] 4.2 修复 `/stop` handler：仅在 abort API 返回 200 时才 `setSessionStreaming(false)`；失败时弹 error toast 且保留 streaming 状态
- [x] 4.3 为 `/new` 和 `/reset` 成功添加 success toast（"New session created"）
- [x] 4.4 为 `/clear` 成功添加 info toast（"Messages cleared"）
- [x] 4.5 为 `/export` 成功添加 success toast（"Session exported"）；用 try/catch 包裹 exportSessionAsMarkdown
- [x] 4.6 `patchSession` 成功后，从 result.configUpdate 乐观更新 chat store 的 SessionMeta 对应字段
- [x] 4.7 类型检查通过

## 5. SessionConfigBar 组件

- [x] 5.1 创建 `dashboard/src/components/panels/chat/SessionConfigBar.tsx`：从 chat store 读取当前 session 的 model/thinkingLevel/fastMode/verboseLevel，用 icon + 文本渲染状态条
- [x] 5.2 样式对齐 RunStatusBar：`text-[10px] font-mono text-[var(--muted-foreground)]`，使用 lucide icon（Cpu/Brain/Zap/Terminal），间距 gap-3
- [x] 5.3 仅显示已设置（非 undefined）的字段；model 未设置时显示 "default"
- [x] 5.4 在 MessageInput.tsx 或其父组件中，将 SessionConfigBar 渲染在输入框正上方
- [x] 5.5 类型检查通过

## 6. i18n 补全

- [x] 6.1 在 `dashboard/src/i18n/zh.json` 的 chat 命名空间添加：configModel、configThinking、configFast、configVerbose、toastFastOn、toastFastOff、toastThink、toastModel、toastVerbose、toastCompacted、toastNewSession、toastCleared、toastExported、toastStopped、toastAbortFailed
- [x] 6.2 在 `dashboard/src/i18n/en.json` 同步添加对应英文翻译
- [x] 6.3 SessionConfigBar 和 executor toast 消息使用 i18n key

## 7. 验证

- [x] 7.1 `cd dashboard && npx tsc --noEmit` 零错误
- [x] 7.2 手动验证：执行 `/fast on` → 看到 toast + 配置状态条更新
- [x] 7.3 手动验证：执行 `/think high` → 看到 toast + 配置状态条更新
- [x] 7.4 手动验证：执行 `/model` 无参数 → 看到当前模型和可用列表的 system message
- [x] 7.5 手动验证：执行 `/focus` → 看到 "Unknown command" 反馈
- [x] 7.6 手动验证：dark mode 下 SessionConfigBar 显示正常
- [x] 7.7 Commit 所有变更

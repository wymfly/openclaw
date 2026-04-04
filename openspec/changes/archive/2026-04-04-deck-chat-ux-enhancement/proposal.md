## Why

Deck 的 Chat 面板已有基本的消息发送/接收、session 管理和工具调用展示，但在输入体验和运行时信息反馈上与官方 CLI 存在差距：

1. **无 Slash 命令** — 官方 CLI 支持 16 个 slash 命令（/new, /reset, /compact, /stop, /model, /think, /export 等），Deck 无此功能
2. **无输入历史** — 官方 CLI 的 InputHistory 类支持 50 条历史、去重、ArrowUp/Down 导航，Deck 输入框无历史回溯
3. **无 Token 计数** — ChatEvent.usage 字段包含 token 消耗信息，但未在 UI 展示；用户无法感知单次对话的资源消耗
4. **无 Compaction 可视化** — 上下文压缩（compaction）是重要的运行时事件，通过 sessions.changed 事件的 compacted 标志传递，Deck 未展示

## What Changes

- 新增 **Slash 命令面板**: 在输入框中输入 `/` 时弹出命令面板，展示可用命令列表并支持模糊搜索
- 新增 **输入历史**: ArrowUp/Down 导航最近 50 条输入，支持去重和搜索
- 新增 **Token 计数显示**: 在消息底部或 RunStatusBar 中展示 token 使用量（input/output/cache）
- 新增 **Compaction 通知**: 检测 compaction 事件并在 chat 中显示系统通知卡片

## Capabilities

### New Capabilities

- `chat-slash-commands`: 输入框 slash 命令面板，支持命令列表展示和模糊搜索
- `chat-input-history`: 输入历史管理，ArrowUp/Down 导航，去重和持久化
- `chat-token-display`: 消息级和 session 级 token 消耗显示
- `chat-compaction-viz`: 上下文压缩事件可视化通知

### Modified Capabilities

(none)

## Impact

- **新组件**: SlashCommandPalette.tsx、TokenUsageDisplay.tsx、CompactionNotice.tsx
- **修改组件**: MessageInput.tsx（slash 命令触发 + 输入历史）、MessageList.tsx（compaction 通知插入）、RunStatusBar.tsx（token 计数）
- **Store**: 新增或扩展 chat store 的输入历史状态（sessionStorage 持久化）
- **i18n**: `chat` 命名空间新增 slash 命令名称/描述、token 计数标签、compaction 通知文本
- **无后端变更**: 所有功能基于已有的 ChatEvent 数据和 sessions.changed 事件

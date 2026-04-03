## Why

`deck-chat-flow-closure` 解决了 Deck Chat 的传输、projection 和恢复闭环，但消息内容本身仍然没有统一契约：

- **Gateway 对外 transcript surface 过于宽松**：`chat.history` 的 `content` 仍然是 `Type.Unknown()`，`session.message` / `session.tool` 也没有供 Deck 复用的正式消息 schema
- **Deck 自己维护多套 normalize / render 逻辑**：聊天页、实时 dispatcher、reload 补全、Sessions 面板各自做 shape 假设
- **相同 server state 会被不同页面解释成不同 UI**：同一条消息在 chat 页可能显示 JSON，在 Sessions 面板可能直接变空字符串
- **结构化工具结果会被降级为纯文本**：一旦 `tool result` 携带结构化 `content` 或 `details`，前端当前实现会直接 `JSON.stringify`
- **新增消息类型缺少编译期护栏**：只要 Gateway 输出新增 block type，Deck 往往只能在运行时通过“JSON 泄漏”“静默丢内容”才发现问题

这说明当前问题不是单点 bug，而是 **Gateway transcript 契约、Deck ingestion、Deck rendering 三层没有统一真源**。

## What Changes

- 新增 **chat-message-contract** 能力：为 Deck-facing transcript surface 定义 canonical block/message schema，覆盖 `chat.history`、`session.message`、`session.tool`
- 新增 **transcript-rendering-contract** 能力：Deck 通过统一的 block renderer registry 渲染 canonical transcript block，并对未知 block 提供显式 fallback
- 修改 **chat-session-sync**：让 snapshot/history/live event/reload/SessionDetail 全部走同一套 transcript adapter 与 store projection
- 扩展 **Gateway → Deck codegen**：将 transcript / event payload 的 typed contract 暴露给 Deck，而不是继续在前端手写 payload shape
- 保持现有 auth / session projection / slash command 语义提案不变，不在本 change 中重做视觉样式

## Capabilities

### New Capabilities

- `chat-message-contract`: Gateway 为 Deck-facing transcript 与 session message/tool surface 提供 canonical block/message schema
- `transcript-rendering-contract`: Deck 为 canonical transcript block 提供统一 renderer registry 与 fallback 行为

### Modified Capabilities

- `chat-session-sync`: 所有 transcript ingestion 路径和会话详情视图改为共享同一套 transcript adapter / render contract

## Impact

- **Gateway protocol**：`src/gateway/protocol/schema/*`、`src/gateway/protocol/index.ts`、相关 describe/codegen 输出
- **Gateway chat/session broadcast**：`chat.history` 读取、`session.message` / `session.tool` 广播 payload
- **Deck transcript core**：`dashboard/src/components/panels/chat/*`、`dashboard/src/stores/chat*`、`dashboard/src/stores/sessions.ts`
- **Deck transcript views**：聊天页消息流、tool result 卡片、Sessions 面板历史详情
- **测试与护栏**：contract tests、chat/sessions 一致性测试、protocol drift / renderer coverage 校验

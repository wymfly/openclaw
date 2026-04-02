## Why

Deck Chat 已经具备较强的富渲染能力，但“发送 → Gateway → 回流 → 恢复”的数据链路仍然是碎片化的：

- **认证链路不闭环**：聊天 REST API 受 `withAuth` 保护，但浏览器聊天请求和 SSE 都没有统一的 Deck access token 注入路径
- **会话状态没有单一真源**：`sessions.list`、`chat.history`、`chat/agent` SSE、`session.message`、approval、A2UI/canvas 各走各的，前端只消费其中一部分
- **历史会话与实时会话不一致**：历史回放能恢复消息文本，但 approval、A2UI/canvas、运行状态、session meta 不能稳定恢复
- **slash 命令语义偏移**：`/reset` 实际新建会话、`/clear` 只清本地内存、`/kill all` 是伪能力
- **恢复能力过弱**：SSE 断线重连只依赖 100 条内存 buffer，右侧画布和 session UI 状态缺少可重建的投影

这些问题已经不是单点 bug，而是 Deck Chat 的前后端契约、事件桥接和 UI 状态恢复策略需要统一重构。

## What Changes

- 新增 **chat-session-sync** 能力：让 chat 页的初始 hydrate、运行时同步、session.message/tool 分支事件、meta 更新都进入统一的 session projection
- 新增 **chat-state-recovery** 能力：让历史会话、即时会话、断线重连后的会话在 approval、A2UI/canvas、session meta、工具块上保持一致
- 保持现有 **header-token 认证模型**，但补齐浏览器侧统一注入与带鉴权的实时流传输，不再依赖匿名 `EventSource`
- 修复 **slash 命令契约**：`/reset` 对应 `sessions.reset`，`/clear` 对应新的后端 clear API，移除 `/kill all`
- 修改 **approval-security**：approval 事件带上会话路由上下文，并在聊天页内联闭环，同时保持独立 Approvals 面板可用
- 修改 **gateway-communication**：实时流 catch-up 从持久化投影恢复，而不是仅依赖小型内存 replay buffer

## Capabilities

### New Capabilities

- `chat-session-sync`: 聊天页的全量 hydrate 与运行时 session 级同步
- `chat-state-recovery`: 聊天页的 approval/A2UI/canvas/会话元数据恢复与实时一致性

### Modified Capabilities

- `chat-slash-commands`: 修复 `/reset`、`/clear`、`/kill all`
- `approval-security`: 让 approval 在 chat 内联闭环并携带 session 路由信息
- `gateway-communication`: 保持现有 token 模型下的浏览器鉴权实时流，以及基于持久化存储的 catch-up

## Impact

- **前端**：`dashboard/src/components/panels/chat/*`、`dashboard/src/stores/chat*`、统一的浏览器鉴权/流客户端
- **Deck server**：`dashboard/src/app/api/chat/*`、`dashboard/src/app/api/stream/route.ts`、`dashboard/server/*` 的事件桥接与投影恢复
- **Gateway**：session clear RPC、approval 事件上下文、session/message/tool/changed 契约补强
- **测试**：需要补齐 slash command、approval inline、session recovery、A2UI recovery、stream reconnect 与 auth transport 的验证

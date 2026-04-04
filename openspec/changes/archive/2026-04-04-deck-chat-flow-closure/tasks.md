## 1. 浏览器鉴权与实时流基础

- [x] 1.1 设计并实现统一的浏览器传输层（`deckFetch` / `deckStream`），让聊天、approval、canvas、commands discovery 等请求共享同一套 Deck access token 注入逻辑
- [x] 1.2 将聊天页和依赖 `/api/stream` 的相关消费者从匿名 `EventSource` 迁移到可带 header 的流客户端
- [x] 1.3 为受保护 API 的 401 场景补充浏览器 unlock/auth 状态，避免当前"页面可打开但所有聊天 API 静默失效"

## 2. Gateway / Deck 契约补强

- [x] 2.1 为 approval 事件桥接补充 `sessionKey`（必要时带 `runId`），让聊天页能稳定路由 approval
- [x] 2.2 新增 `sessions.clear` Gateway RPC 与 Deck API route，定义清空 transcript/history 但保留 session identity/config 的语义
- [x] 2.3 梳理 `sessions.changed`、`session.message`、`session.tool`、approval、A2UI/canvas 的统一事件契约

## 3. Session Projection 与恢复链路

- [x] 3.1 扩展聊天页 SessionMeta / SessionState，使 `sessions.list` 与 `chat.history` 返回的完整字段都能进入前端真源状态
- [x] 3.2 接入 `session.message` / `session.tool`，补齐非当前 run 的 transcript 更新链路
- [x] 3.3 将 approval、A2UI/canvas、工具进度等 UI 相关状态纳入可恢复的 session projection
- [x] 3.4 将 `/api/stream` 的 catch-up 从内存 replay buffer 迁移到持久化投影/事件 outbox

## 4. Slash 命令语义修复

- [x] 4.1 `/reset` 改为真正调用 `sessions.reset`，并在前端按"当前 session 被重置"处理
- [x] 4.2 `/clear` 改为调用新的 clear 后端 API，同时清理本地会话状态并与服务端结果保持一致
- [x] 4.3 从聊天命令注册中移除 `/kill all`
- [x] 4.4 校正 slash 命令执行后的本地 optimistic 更新与服务端回源逻辑

## 5. Approval 闭环

- [x] 5.1 将 `ApprovalDialog` 真正接入 chat 面板
- [x] 5.2 让 chat 内联审批与独立 Approvals 面板复用同一套 resolve API 和同一套 pending state
- [x] 5.3 补齐 approval 请求、resolve、刷新、重连后的恢复行为

## 6. A2UI / Canvas 恢复

- [x] 6.1 将 canvas 可见性从全局 UI 偏好改为 session-scoped 恢复状态
- [x] 6.2 让 A2UI 入站事件不仅即时推送到 iframe，也进入可恢复投影
- [x] 6.3 修复 `canvas.eval` 可用性判断，使其依赖实际 mounted/ready bridge，而不是页面级 register 计数
- [x] 6.4 验证切会话、重开右侧栏、刷新页面、断线重连时的 A2UI/canvas 一致性

## 7. 验证

- [x] 7.1 为 slash command 语义修复补齐单元测试
- [x] 7.2 为 approval inline 闭环补齐前后端测试
- [x] 7.3 为 `session.message/tool`、A2UI recovery、SSE catch-up、auth stream transport 补齐测试
- [x] 7.4 运行类型检查、lint、相关测试，并完成历史会话/实时会话一致性的手工验收

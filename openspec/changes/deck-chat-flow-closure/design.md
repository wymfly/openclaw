## Context

当前 Deck Chat 的主链路可以拆成 5 条：

1. **发送链路**
   `MessageInput` → `/api/chat/sessions/create|send` → `sessions.create|sessions.steer` → `chat.send`
2. **初始 hydrate**
   `ChatPanel` → `/api/chat/sessions` + `/api/chat/history`
3. **实时回流**
   Gateway WS → `OpenClawGatewayAdapter` → `EventBus` → `/api/stream` → `useChatSSE`
4. **旁路状态**
   approval、`session.message/tool`、A2UI/canvas、`sessions.changed`
5. **恢复链路**
   页面刷新、会话切换、SSE 重连、右侧画布重开

现在的问题不是“某条链路坏了”，而是 5 条链路没有统一的状态模型：

- `sessions.list` 和 `chat.history` 返回的字段被前端截断
- `chat` / `agent` 事件驱动的是当前 run，而 `session.message/tool` 没有接进聊天页
- approval 只在独立面板闭环，chat 内没有闭环
- A2UI/canvas 主要是“即时推给 iframe”，不是“可恢复的 session 状态”
- 认证沿用 header-token，但浏览器没有统一注入层；`EventSource` 更是天然无法带自定义 header

用户期望是：**历史会话和实时会话的 UI 状态完全一致**。这意味着 Deck Chat 不能只把“消息文本”当作会话状态，而必须把 approval、A2UI/canvas、运行中元数据、session meta 一起纳入可重建的数据投影。

## Goals / Non-Goals

**Goals**

- 让聊天页形成单一真源的数据流：初始 hydrate、实时更新、恢复都落到同一套 session projection
- 在保持现有 Deck access token 模型的前提下，让浏览器 REST 与实时流都能鉴权通过
- 让 `/reset`、`/clear`、approval、A2UI/canvas 等功能语义和后端能力一一对应
- 让历史会话、实时会话、断线重连后的会话在 UI 上保持一致

**Non-Goals**

- 不改成 cookie/session auth
- 不重写整个聊天 UI 视觉结构
- 不把所有 Deck 面板都迁移到聊天会话投影模型
- 不在本提案中引入新的 slash 命令类别

## Proposed Architecture

### 1. 浏览器传输层：保持 header-token，替换匿名 EventSource

Deck 保持当前 `Authorization` / `x-deck-token` 认证模型，不引入 cookie。

新增统一浏览器传输层：

- `deckFetch()`：所有 chat/approval/canvas 相关 REST API 统一通过它发送
- `deckStream()`：基于 `fetch()` + `ReadableStream` 的 SSE/事件流客户端，支持附带 `x-deck-token`
- 浏览器侧维护一个短生命周期的 Deck access token 状态
  - 页面初始可公开加载
  - 当受保护 API 返回 401 时，UI 进入 unlock/auth state
  - 用户提供 Deck access token 后，后续 REST 与 stream 共用同一注入层

这样保留了现有 access-gate 语义，同时让聊天页、approval、activity、commands discovery 等所有依赖 `/api/stream` 的功能都能在同一 auth model 下工作。

### 2. 会话真源：Session Projection

前端聊天状态不再依赖单一来源，而是由 3 类来源合并得到：

1. **`sessions.list`**：提供 session 级元数据与生命周期快照
2. **`chat.history`**：提供权威消息块历史
3. **实时事件投影**：`chat`、`agent`、`sessions.changed`、`session.message`、`session.tool`、approval、A2UI/canvas

其中 session projection 由 Deck server 和前端 store 共同维护：

- Gateway 仍然是 run / session / approval 原始事件的来源
- Deck server 负责桥接并持久化与聊天 UI 相关的事件投影
- 前端 store 负责最终展示态，但不再把某些 UI 状态只保存在 React 组件局部状态或 iframe 内

### 3. Runtime Sync：从“只看 chat/agent”扩展到完整 session 同步

聊天页的实时同步将明确拆成两个层次：

- **Run layer**
  - `chat`
  - `agent`
- **Session layer**
  - `sessions.changed`
  - `session.message`
  - `session.tool`
  - `approval.pending/resolved`
  - A2UI/canvas projection events

前端不再只依赖当前 run 的 `chat/agent` 事件。打开某个 session 后，聊天页必须对这个 session 建立权威同步：

- 运行中的当前对话继续用 `chat/agent`
- 外部追加消息、补写 transcript、后台工具结果走 `session.message/tool`
- approval、A2UI/canvas、session meta 统一写入该 session 的投影

### 4. Recovery：把“UI 状态”也当成数据恢复对象

历史会话与实时会话一致，要求恢复的不是“字符串”，而是“界面状态”。

本提案中，以下内容都属于可恢复状态：

- session meta：model / thinking / fast / verbose / status / runtime / tokens / cost
- active approval
- 工具执行状态与工具结果块
- A2UI surface/event log
- canvas 可见性与当前呈现内容

恢复策略：

- **页面刷新**：通过 `sessions.list` + `chat.history` + Deck 投影快照重建
- **会话切换**：切换回来时不依赖组件局部状态，而是从 session projection 恢复
- **SSE 重连**：基于持久化事件 outbox / projection catch-up 恢复，不依赖 100 条内存 ring buffer
- **右侧栏重开**：A2UI/canvas 通过已保存的 event log / surface snapshot 重新灌入 iframe

### 5. Slash Command Semantics

现有命令的语义需要和后端能力完全对齐：

- `/reset`
  - 调用 `sessions.reset`
  - 保持同一个 `sessionKey`
  - 清空消息、A2UI、approval、工具进度，但保留会话身份
- `/clear`
  - 调用新增的 `sessions.clear`
  - 清空 transcript / message history / A2UI projection
  - 保留当前 session 的配置和绑定关系
- `/kill all`
  - 从聊天命令中移除

### 6. Approval Inline Closure

approval 在 Gateway 事件里已经带有 `request.sessionKey`，但 Deck bridge 没有把它向前传成 chat 可路由 payload。

修复后：

- `approval.pending` / `approval.resolved` payload 明确包含 `sessionKey`
- 聊天页和 Approvals 面板都消费同一条 approval 事件
- 任一入口 resolve 后，两个入口都同步清除 pending state

### 7. A2UI / Canvas Recovery

当前 canvas 可见性是全局 UI 状态，实际 bridge readiness 却是 session-scoped，这两个维度需要统一。

修复后：

- canvas / A2UI 的可见性、surface、事件日志都挂在 session projection 下
- 全局 UI store 只保留“当前右侧栏打开哪个 session 的哪个面板”
- `canvas.eval` 可用性以“该 session 的 bridge 已挂载并 ready”为准，而不是页面级 ref count

## Decisions

### D1: 保持 header-token auth，不回退到 cookie

**选择**：保留 `Authorization` / `x-deck-token` 认证模型；补浏览器侧统一注入层和带 header 的实时流客户端。

**原因**：这是用户明确选择，也更符合 Deck 当前 access-gate 的实现与平台代理场景。

### D2: 历史会话与实时会话共用同一 Session Projection

**选择**：不再把 history 和 live 视为两套不同展示逻辑。所有聊天 UI 都从同一个 session projection 读。

**原因**：只有这样才能实现“历史会话和即时会话 UI 状态完全一致”。

### D3: `/clear` 使用独立后端能力，而不是复用 `/reset`

**选择**：新增 `sessions.clear`，与 `sessions.reset` 分开。

**原因**：`reset` 是重置会话，`clear` 是清空历史，两者语义不同。复用会让前后端再次失去契约一致性。

### D4: approval 事件路由以 `sessionKey` 为主，`runId` 为辅

**选择**：Bridge 对 approval payload 解包时，把 `request.sessionKey` 提升成顶层字段，必要时同时携带 `runId`。

**原因**：chat 页需要稳定路由到具体 session；面向 run 的附加上下文只用于 UI 关联，不作为主键。

### D5: A2UI/canvas 恢复依赖 Deck projection，而不是 iframe 内存

**选择**：A2UI 入站事件、surface 列表、canvas 展示态进入 Deck 的持久化投影，再由前端重放到 iframe。

**原因**：iframe 是渲染终端，不应该成为权威状态源。

### D6: SSE catch-up 从持久化 outbox / projection 获取，不再依赖内存 ring buffer

**选择**：`Last-Event-ID` 恢复路径从投影存储读取。

**原因**：聊天流是高频流，100 条内存 buffer 无法保证恢复正确性。

## Risks / Trade-offs

**[引入新的 session clear RPC]**
需要补 Gateway method、schema、Deck route、命令调用和测试。
缓解：语义清晰，长期比继续在前端做“本地假清空”更安全。

**[A2UI/canvas 投影变复杂]**
Deck server 需要保存更多 UI 相关数据。
缓解：只保存会话恢复必需的最小快照与可重放事件，不保存 iframe 内部实现细节。

**[统一传输层影响多个 SSE 消费者]**
`/api/stream` 的客户端不止聊天页在用。
缓解：提取共享 `deckStream()`，逐步替换 `EventSource` 消费者，而不是只在 chat 内做特判。

**[session.message 订阅范围扩大]**
如果对过多 session 建立实时订阅，可能增加 Gateway 压力。
缓解：先对 active session、正在 streaming 的 session、以及具有待恢复 UI 状态的 session 建立订阅，并设置清理策略。

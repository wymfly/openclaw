# Deck Chat Flow Closure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Deck 聊天页的发送、实时流、历史恢复、approval、A2UI/canvas、slash 命令在前后端形成单一真源的数据闭环，并保证历史会话与即时会话 UI 状态一致。

**Architecture:** 分 3 层推进。第一层收敛浏览器传输与 Gateway/Deck 契约，解决 header-token + `/api/stream` + `sessions.clear` 的基础问题。第二层建立聊天页的 session projection，把 `sessions.list`、`chat.history`、`session.message/tool`、approval、canvas/A2UI 投到同一份可恢复状态。第三层修正 slash 命令、inline approval、canvas ready 判定和恢复逻辑，并用协议生成、类型检查和测试收口。

**Tech Stack:** Next.js 15 App Router, React 19, Zustand, sql.js, TypeBox/AJV Gateway protocol, Vitest

---

## File Structure

| File                                                                                                    | Responsibility                                                                 | Action           |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- |
| `openspec/changes/deck-chat-flow-closure/*`                                                             | 已确认的 proposal / design / spec / tasks                                      | REFERENCE        |
| `dashboard/src/app/layout.tsx`                                                                          | 注入 Deck auth bootstrap / unlock UI 容器                                      | MODIFY           |
| `dashboard/src/components/layout/DeckAuthProvider.tsx`                                                  | 浏览器内存态 Deck token + unlock 状态                                          | CREATE           |
| `dashboard/src/lib/deck-client.ts`                                                                      | 统一 `deckFetch()` / `deckStream()` / SSE backoff / Last-Event-ID              | CREATE           |
| `dashboard/src/app/api/stream/route.ts`                                                                 | 流式接口鉴权、replay、给自定义流客户端返回一致语义                             | MODIFY           |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                                                    | chat/session/approval/canvas 全量事件接入 chat store                           | MODIFY           |
| `dashboard/src/components/panels/approvals/useApprovalsSSE.ts`                                          | 复用共享 stream client                                                         | MODIFY           |
| `dashboard/src/components/notifications/useNotificationSSE.ts`                                          | 复用共享 stream client                                                         | MODIFY           |
| `dashboard/src/hooks/use-command-discovery.ts`                                                          | 复用共享 stream client                                                         | MODIFY           |
| `dashboard/src/components/panels/chat/chat-api.ts`                                                      | 聊天页浏览器 API 封装（send/create/reset/clear/snapshot/approve/canvas）       | CREATE           |
| `dashboard/src/app/api/chat/snapshot/route.ts`                                                          | 单次返回 active session 的消息、meta、approval、A2UI/canvas 快照               | CREATE           |
| `dashboard/src/app/api/chat/history/route.ts`                                                           | 改 typed `gwRequest`，只负责 Gateway history passthrough                       | MODIFY           |
| `dashboard/src/app/api/chat/sessions/create/route.ts`                                                   | 改 typed `gwRequest`                                                           | MODIFY           |
| `dashboard/src/app/api/chat/send/route.ts`                                                              | 改 typed `gwRequest`                                                           | MODIFY           |
| `dashboard/src/app/api/chat/abort/route.ts`                                                             | 改 typed `gwRequest`                                                           | MODIFY           |
| `dashboard/src/app/api/chat/sessions/reset/route.ts`                                                    | 真正调用 `sessions.reset`                                                      | CREATE           |
| `dashboard/src/app/api/chat/sessions/clear/route.ts`                                                    | 真正调用 `sessions.clear`                                                      | CREATE           |
| `dashboard/src/components/panels/chat/history-normalize.ts`                                             | history/snapshot 归一化与安全解析，避免 hydrate 静默失败                       | CREATE           |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`                                                    | session list hydrate + active snapshot hydrate + session-scoped right panel    | MODIFY           |
| `dashboard/src/components/panels/chat/MessageInput.tsx`                                                 | 首条消息/create-send 分支、reset/clear、inline approval resolve、chat-api 接入 | MODIFY           |
| `dashboard/src/components/panels/chat/slash-command-executor.ts`                                        | `/reset`、`/clear`、移除 `/kill all`，返回权威 action/result                   | MODIFY           |
| `dashboard/src/components/panels/chat/slash-commands.ts`                                                | 移除 `/kill all` 命令定义                                                      | MODIFY           |
| `dashboard/src/components/panels/chat/CanvasPanel.tsx`                                                  | bridge ready、A2UI 入站持久化、session 切换/重开恢复                           | MODIFY           |
| `dashboard/src/components/panels/chat/ApprovalDialog.tsx`                                               | 接入聊天页真实闭环                                                             | MODIFY           |
| `dashboard/src/stores/chat-types.ts`                                                                    | SessionMeta / SessionState / Approval / A2UI / canvas 恢复字段                 | MODIFY           |
| `dashboard/src/stores/chat.ts`                                                                          | session-scoped projection state 与 canvas ready 状态                           | MODIFY           |
| `dashboard/src/stores/chat-hooks.ts`                                                                    | 选择器扩展，暴露 approval / canvas / projection hooks                          | MODIFY           |
| `dashboard/src/stores/chat-dispatchers.ts`                                                              | thinking 去重、`session.message/tool`、approval、A2UI/canvas 投影合流          | MODIFY           |
| `dashboard/src/stores/ui.ts`                                                                            | 去掉 chat 专属的全局 `canvasVisible` 状态                                      | MODIFY           |
| `dashboard/server/approval-bridge.ts`                                                                   | approval payload 提升 `sessionKey` / `runId` 并持久化到 projection             | MODIFY           |
| `dashboard/server/gateway-adapter.ts`                                                                   | 管理 `sessions.messages.subscribe` / unsubscribe 与 reconnect 恢复             | MODIFY           |
| `dashboard/server/runtime.ts`                                                                           | 初始化 chat projection / approval / canvas bridge                              | MODIFY           |
| `dashboard/server/projection-store.ts`                                                                  | 持久化 session UI projection（approval + A2UI/canvas snapshot）                | MODIFY           |
| `dashboard/migrations/009_chat_session_projection.sql`                                                  | session UI projection 表                                                       | CREATE           |
| `dashboard/server/node-connection.ts`                                                                   | 以 session bridge-ready 作为 eval 可用性判定，而不是页面级计数                 | MODIFY           |
| `dashboard/src/app/api/deck/canvas/route.ts`                                                            | session-scoped canvas register/ready/unready/result 接口                       | MODIFY           |
| `src/gateway/protocol/schema/sessions.ts`                                                               | 新增 `SessionsClearParams/Result` schema                                       | MODIFY           |
| `src/gateway/protocol/index.ts`                                                                         | 导出/校验 `sessions.clear` schema                                              | MODIFY           |
| `src/gateway/server-methods/sessions.ts`                                                                | 实现 `sessions.clear` handler                                                  | MODIFY           |
| `src/gateway/session-reset-service.ts` 或 `src/gateway/session-clear-service.ts`                        | reset/clear 共用清理辅助逻辑                                                   | MODIFY or CREATE |
| `src/gateway/server-methods-list.ts`                                                                    | 注册 `sessions.clear`                                                          | MODIFY           |
| `src/gateway/method-scopes.ts`                                                                          | `sessions.clear` scope                                                         | MODIFY           |
| `src/gateway/method-registry-data.ts`                                                                   | 加入 `sessions.clear` 供 protocol codegen                                      | MODIFY           |
| `dashboard/src/types/gateway-*.generated.ts`                                                            | `pnpm protocol:gen:ts` 自动生成                                                | GENERATED        |
| `dashboard/server/__tests__/access-gate.test.ts`                                                        | stream auth / no-token dev-mode 行为                                           | MODIFY           |
| `dashboard/server/__tests__/approval-bridge.test.ts`                                                    | approval payload 带 `sessionKey` / `runId`                                     | MODIFY           |
| `dashboard/server/__tests__/gateway-adapter.test.ts`                                                    | session message subscription / reconnect                                       | MODIFY           |
| `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`                                     | thinking 去重、session-msg/tool、approval、A2UI/canvas 投影                    | MODIFY           |
| `dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts`                                    | A2UI replay / userAction / bridge ready                                        | MODIFY           |
| `dashboard/src/components/panels/chat/__tests__/slash-command-executor.test.ts`                         | `/reset` `/clear` `/kill` 语义                                                 | CREATE           |
| `src/gateway/session-message-events.test.ts`                                                            | `session.message/tool` 订阅与 `sessions.clear` 之后的行为                      | MODIFY           |
| `src/gateway/sessions-patch.test.ts` 或 `src/gateway/server.sessions.gateway-server-sessions-a.test.ts` | `sessions.clear` / `sessions.reset` 契约                                       | MODIFY           |

## Chunk 1: Transport + Contract

### Task 1: 收敛浏览器传输层与 `/api/stream` 鉴权

**Files:**

- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/components/layout/DeckAuthProvider.tsx`
- Create: `dashboard/src/lib/deck-client.ts`
- Modify: `dashboard/src/app/api/stream/route.ts`
- Modify: `dashboard/src/components/panels/approvals/useApprovalsSSE.ts`
- Modify: `dashboard/src/components/notifications/useNotificationSSE.ts`
- Modify: `dashboard/src/hooks/use-command-discovery.ts`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Test: `dashboard/server/__tests__/access-gate.test.ts`

covers: gateway-communication/spec.md

- [ ] **Step 1.1: 加入客户端 auth bootstrap**
      实现 `DeckAuthProvider`，用内存态保存 `x-deck-token` / unlock 状态；`layout.tsx` 注入 provider。不要把 token 落 cookie；provider 只负责浏览器侧请求注入和 401 切换 unlock UI。

- [ ] **Step 1.2: 实现共享 `deckFetch()` / `deckStream()`**
      在 `dashboard/src/lib/deck-client.ts` 提供：
  - `deckFetch(input, init)`：自动注入 `Authorization` 或 `x-deck-token`
  - `deckStream(url, handlers)`：基于 `fetch()` + `ReadableStream` 解析 SSE，支持 `Last-Event-ID`、指数退避、`AbortController`

- [ ] **Step 1.3: 给 `/api/stream` 加上 access-gate**
      让 `dashboard/src/app/api/stream/route.ts` 和 JSON API 一致地检查 Deck token；保留“未配置 token 时全部放行”的 dev-mode 语义。

- [ ] **Step 1.4: 替换所有 `/api/stream` 的 `EventSource` 消费点**
      将 `useChatSSE.ts`、`useApprovalsSSE.ts`、`useNotificationSSE.ts`、`use-command-discovery.ts` 改成共享 `deckStream()`，避免继续存在匿名 EventSource 分叉。

- [ ] **Step 1.5: 写测试并验证**
      至少覆盖：
  - 未配置 token 时 `/api/stream` 允许连接
  - 配置 token 时无 header 返回 401
  - `deckStream()` 能处理 `Last-Event-ID` 与 reconnect

Run:

```bash
pnpm test -- dashboard/server/__tests__/access-gate.test.ts
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 1.6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): unify browser auth and stream transport for chat flows" \
  dashboard/src/app/layout.tsx \
  dashboard/src/components/layout/DeckAuthProvider.tsx \
  dashboard/src/lib/deck-client.ts \
  dashboard/src/app/api/stream/route.ts \
  dashboard/src/components/panels/approvals/useApprovalsSSE.ts \
  dashboard/src/components/notifications/useNotificationSSE.ts \
  dashboard/src/hooks/use-command-discovery.ts \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/server/__tests__/access-gate.test.ts
```

### Task 2: 补 `sessions.clear` 和 approval/session 事件契约

**Files:**

- Modify: `src/gateway/protocol/schema/sessions.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods/sessions.ts`
- Modify or Create: `src/gateway/session-reset-service.ts` or `src/gateway/session-clear-service.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`
- Modify: `src/gateway/method-registry-data.ts`
- Modify: `dashboard/server/approval-bridge.ts`
- Modify: `dashboard/server/gateway-adapter.ts`
- Test: `src/gateway/session-message-events.test.ts`
- Test: `dashboard/server/__tests__/approval-bridge.test.ts`

covers: chat-slash-commands/spec.md
covers: approval-security/spec.md
covers: gateway-communication/spec.md

- [ ] **Step 2.1: 为 Gateway 增加 `sessions.clear`**
      新增 params/result schema、handler、scope、method registry metadata。语义要求：
  - 保留 `sessionKey`
  - 保留会话配置与绑定关系
  - 清空 transcript / history / A2UI projection 对应的恢复数据
  - 广播 `sessions.changed`，reason 使用新的 `"clear"`

- [ ] **Step 2.2: 抽出 reset/clear 共用清理逻辑**
      把 runtime cleanup、queue cleanup、browser tab cleanup、transcript 归档/重建这类逻辑从 `sessions.reset` 路径复用给 `sessions.clear`，避免复制分叉。

- [ ] **Step 2.3: 让 approval 事件携带 `sessionKey`**
      修改 `dashboard/server/approval-bridge.ts`，从 Gateway 的 `request.sessionKey`/`request.runId` 解包并广播到 `approval.pending` / `approval.resolved`。

- [ ] **Step 2.4: 让 Deck 真正消费 `session.message/tool`**
      在 `gateway-adapter.ts` 增加 active session 的 subscribe/unsubscribe 生命周期管理，并在 reconnect 后自动补订阅。

- [ ] **Step 2.5: 重新生成协议并补测试**
      运行协议生成，补上 `sessions.clear`、approval payload、session message subscription 的测试。

Run:

```bash
pnpm protocol:gen:ts
pnpm test -- src/gateway/session-message-events.test.ts
pnpm test -- dashboard/server/__tests__/approval-bridge.test.ts
```

- [ ] **Step 2.6: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add sessions.clear and route approval/session events for deck chat" \
  src/gateway/protocol/schema/sessions.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods/sessions.ts \
  src/gateway/server-methods-list.ts \
  src/gateway/method-scopes.ts \
  src/gateway/method-registry-data.ts \
  dashboard/server/approval-bridge.ts \
  dashboard/server/gateway-adapter.ts \
  src/gateway/session-message-events.test.ts \
  dashboard/server/__tests__/approval-bridge.test.ts
```

## Chunk 2: Session Projection + Command Semantics

### Task 3: 建立 active session snapshot / projection hydrate

**Files:**

- Create: `dashboard/src/app/api/chat/snapshot/route.ts`
- Create: `dashboard/src/components/panels/chat/history-normalize.ts`
- Create: `dashboard/src/components/panels/chat/chat-api.ts`
- Modify: `dashboard/src/app/api/chat/history/route.ts`
- Modify: `dashboard/src/app/api/chat/sessions/create/route.ts`
- Modify: `dashboard/src/app/api/chat/send/route.ts`
- Modify: `dashboard/src/app/api/chat/abort/route.ts`
- Create: `dashboard/src/app/api/chat/sessions/reset/route.ts`
- Create: `dashboard/src/app/api/chat/sessions/clear/route.ts`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-hooks.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`

covers: chat-session-sync/spec.md
covers: chat-state-recovery/spec.md

- [ ] **Step 3.1: 实现单次 `chat snapshot` route**
      `/api/chat/snapshot` 返回：
  - `messages`
  - `meta`
  - `activeApproval`
  - `a2uiState` / canvas snapshot
  - 必要的 session lifecycle 字段  
    它内部允许 fan-out 到 `gw.chat.history`、`gw.sessions.list`、projection store，但前端只看一个权威 payload。

- [ ] **Step 3.2: 抽出安全的 history normalize**
      把 `ChatPanel.tsx` 里的 `normalizeContent()` / `mergeToolMessages()` 移到独立文件，并把 `toolCall.arguments` 的解析改成安全分支，任何单条坏历史都不能炸毁整个 hydrate。

- [ ] **Step 3.3: 扩展 chat store 的 projection 字段**
      补齐：
  - SessionMeta: `status/startedAt/endedAt/runtimeMs/model/thinkingLevel/fastMode/verboseLevel/totalTokens/estimatedCostUsd/...`
  - SessionState: `activeApproval`、A2UI/canvas ready、恢复所需 snapshot
  - selectors：提供 session-scoped canvas / approval / A2UI hooks

- [ ] **Step 3.4: 扩展 dispatcher**
      在 `chat-dispatchers.ts` 里统一处理：
  - `sessions.changed`
  - `session.message`
  - `session.tool`
  - `approval.pending/resolved`
  - A2UI/canvas projection  
    并修复 thinking 流：增量期不能重复追加累计全文。

- [ ] **Step 3.5: 改造 `ChatPanel` hydrate**
      `ChatPanel.tsx` 改成：
  - session list：只负责 sidebar metadata
  - active session：只从 `/api/chat/snapshot` hydrate
  - 切 session / 刷新 / reconnect 后都使用同一份 snapshot merge 逻辑

- [ ] **Step 3.6: 跑测试与类型检查**
      Run:

```bash
pnpm test -- dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 3.7: Commit**

```bash
scripts/committer "[enhanced] feat(deck-chat): hydrate active sessions from a single projection snapshot" \
  dashboard/src/app/api/chat/snapshot/route.ts \
  dashboard/src/components/panels/chat/history-normalize.ts \
  dashboard/src/components/panels/chat/chat-api.ts \
  dashboard/src/app/api/chat/history/route.ts \
  dashboard/src/app/api/chat/sessions/create/route.ts \
  dashboard/src/app/api/chat/send/route.ts \
  dashboard/src/app/api/chat/abort/route.ts \
  dashboard/src/app/api/chat/sessions/reset/route.ts \
  dashboard/src/app/api/chat/sessions/clear/route.ts \
  dashboard/src/components/panels/chat/ChatPanel.tsx \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat.ts \
  dashboard/src/stores/chat-hooks.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
```

### Task 4: 修正发送链路和 slash 命令语义

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/slash-command-executor.ts`
- Modify: `dashboard/src/components/panels/chat/slash-commands.ts`
- Create: `dashboard/src/components/panels/chat/__tests__/slash-command-executor.test.ts`

covers: chat-slash-commands/spec.md

- [ ] **Step 4.1: 把消息发送改成 `chat-api.ts`**
      `MessageInput.tsx` 不再直接散落 `fetch("/api/chat/*")`，统一走 `chat-api.ts`，这样错误处理、auth header 和返回 shape 只定义一次。

- [ ] **Step 4.2: 修正首条消息 create/send 分支**
      当 `sessions.create` 返回 `runStarted=false + runError` 时，不能再无条件二次 steer；把“create-only”“create+run-started”“create-run-failed”“create-with-attachments-then-steer”拆成明确分支。

- [ ] **Step 4.3: 让 `/reset`、`/clear` 语义落到后端能力**
      `slash-command-executor.ts` 改成：
  - `/reset` → `/api/chat/sessions/reset`
  - `/clear` → `/api/chat/sessions/clear`
  - `/kill all` 从命令注册和执行器彻底删除

- [ ] **Step 4.4: 让前端状态与服务端结果同步**
      `/reset` 和 `/clear` 执行成功后，前端不要只 toast；要按 snapshot/route 返回结果同步 messages、approval、A2UI/canvas、session meta，避免假清空和假新会话。

- [ ] **Step 4.5: 写执行器测试**
      至少覆盖：
  - `/reset` 不创建新 session
  - `/clear` 真调用 clear API
  - `/kill all` 不再出现在 registry

Run:

```bash
pnpm test -- dashboard/src/components/panels/chat/__tests__/slash-command-executor.test.ts
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 4.6: Commit**

```bash
scripts/committer "[enhanced] fix(deck-chat): align slash commands and first-send semantics with gateway" \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/components/panels/chat/slash-command-executor.ts \
  dashboard/src/components/panels/chat/slash-commands.ts \
  dashboard/src/components/panels/chat/__tests__/slash-command-executor.test.ts
```

## Chunk 3: Approval + A2UI/Canvas Recovery + Verification

### Task 5: 让 approval 在聊天页内闭环

**Files:**

- Modify: `dashboard/src/components/panels/chat/ApprovalDialog.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/approvals.ts`
- Test: `dashboard/server/__tests__/approval-bridge.test.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`

covers: approval-security/spec.md

- [ ] **Step 5.1: 将 `ApprovalDialog` 真正挂入聊天页**
      在 active session 有 `activeApproval` 时显示 inline approval；resolve 后调用统一 `chat-api.ts` / approvals API。

- [ ] **Step 5.2: 统一 chat store 与 approvals store 的 pending 语义**
      approval 事件到来时同时更新：
  - 当前 session 的 `activeApproval`
  - 独立 approvals 面板的 pending list  
    任一入口 resolve 后，两边一起清除。

- [ ] **Step 5.3: 补审批闭环测试**
      至少验证：
  - `approval.pending` 带 `sessionKey` 时能路由到对应 session
  - `approval.resolved` 后 chat 与 approvals store 一致清空

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "[enhanced] feat(deck-chat): close approval loop inline and in approvals panel" \
  dashboard/src/components/panels/chat/ApprovalDialog.tsx \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat.ts \
  dashboard/src/stores/approvals.ts \
  dashboard/server/__tests__/approval-bridge.test.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
```

### Task 6: 持久化 A2UI/canvas projection，去掉全局 `canvasVisible`

**Files:**

- Create: `dashboard/migrations/009_chat_session_projection.sql`
- Modify: `dashboard/server/projection-store.ts`
- Modify: `dashboard/server/runtime.ts`
- Modify: `dashboard/server/node-connection.ts`
- Modify: `dashboard/src/app/api/deck/canvas/route.ts`
- Modify: `dashboard/src/components/panels/chat/CanvasPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/stores/ui.ts`
- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-hooks.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts`

covers: chat-state-recovery/spec.md

- [ ] **Step 6.1: 为 session UI projection 增加持久化表**
      在 Deck DB 新建按 `session_key` 存储的 projection 表，至少保存：
  - `active_approval`
  - `a2ui_state`
  - `canvas_state`
  - `updated_at`

- [ ] **Step 6.2: 用 session-scoped canvas 状态替换 `useUIStore.canvasVisible`**
      把 chat 专属的 canvas 显示态移入 chat session state；`ui.ts` 不再保存全局 `canvasVisible/canvasMode`。

- [ ] **Step 6.3: 让 `CanvasPanel` 把入站 A2UI/canvas 写回投影**
      `a2ui_push` / `a2ui_reset` / surfaces change / bridge ready 不能只推给 iframe；必须同步更新 store 和 projection store，供重开右侧栏、切 session、刷新页面恢复。

- [ ] **Step 6.4: 用 bridge-ready 取代页面级 canvas ref-count**
      `node-connection.ts` 与 `/api/deck/canvas` 改成按 session 记录 mounted/ready 状态；只有当前 session bridge ready 时才接受 `canvas.eval`，否则立即返回 `UNAVAILABLE`。

- [ ] **Step 6.5: 验证恢复路径**
      至少手动/自动覆盖：
  - 切会话后再切回，canvas/A2UI 恢复
  - 关闭右侧栏再打开，iframe 重放恢复
  - SSE 重连后最后一个 session 的 A2UI/canvas 状态不丢

Run:

```bash
pnpm test -- dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 6.6: Commit**

```bash
scripts/committer "[enhanced] feat(deck-chat): persist session-scoped a2ui and canvas recovery state" \
  dashboard/migrations/009_chat_session_projection.sql \
  dashboard/server/projection-store.ts \
  dashboard/server/runtime.ts \
  dashboard/server/node-connection.ts \
  dashboard/src/app/api/deck/canvas/route.ts \
  dashboard/src/components/panels/chat/CanvasPanel.tsx \
  dashboard/src/components/panels/chat/ChatPanel.tsx \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/stores/ui.ts \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat.ts \
  dashboard/src/stores/chat-hooks.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts
```

### Task 7: 统一验证与收口

**Files:**

- Modify as needed from previous tasks

- [ ] **Step 7.1: 跑协议与类型检查**
      Run:

```bash
pnpm protocol:gen:check
pnpm tsc --noEmit
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 7.2: 跑 lint / format / 关键测试**
      Run:

```bash
pnpm check
pnpm test -- dashboard/server/__tests__/access-gate.test.ts
pnpm test -- dashboard/server/__tests__/approval-bridge.test.ts
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts
pnpm test -- dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
pnpm test -- dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts
pnpm test -- dashboard/src/components/panels/chat/__tests__/slash-command-executor.test.ts
pnpm test -- src/gateway/session-message-events.test.ts
```

- [ ] **Step 7.3: 跑完整测试套件**
      除非用户明确允许缩小范围，否则合并前执行：

```bash
pnpm test
```

- [ ] **Step 7.4: 进行代码审查**
      实现完成后按仓库规则走一次外部审查，默认入口是 `gemini-review`；先核实意见真实性，再决定采纳。

- [ ] **Step 7.5: 最终提交**
      按实际改动分 2-4 个 scoped commit；不要把传输层、Gateway 契约、projection 恢复和 UI 调整糊成一个大提交。

---

Plan complete and saved to `docs/plans/2026-04-02-deck-chat-flow-closure-plan.md`. Ready to execute.

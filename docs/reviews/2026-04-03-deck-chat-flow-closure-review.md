# Review: deck-chat-flow-closure

> **Commit:** `08acceff6f` — `[enhanced] feat(deck): close chat flow state loops`
> **Scope:** OpenSpec proposal → design → specs → plan → code (88 files, +4785/-763)
> **Reviewer:** Claude Opus 4.6
> **Date:** 2026-04-03

---

## Executive Summary

本次提交将 Deck Chat 的五条碎片化数据链路（发送、hydrate、实时回流、旁路状态、恢复）统一到一套 session projection 模型下。从提案到实现整体思路连贯、代码质量高，但存在一个设计承诺未兑现（SSE catch-up 持久化）和一个流程问题（88 文件合并为单 commit）。

**综合评分：8.2 / 10**

---

## 1. OpenSpec Artifacts

### 1.1 Proposal (9/10)

| 维度     | 评价                                                            |
| -------- | --------------------------------------------------------------- |
| 问题诊断 | 精准——"5 条链路没有统一状态模型"的定位抓住了根因                |
| 变更范围 | 清晰——2 new + 4 modified capabilities，前端/server/Gateway 三层 |
| Impact   | 完整——列出了所有受影响目录                                      |

**小瑕疵：** "保持现有 header-token 认证模型"的浏览器降级方案（`globalThis.prompt()`）适合 dev/demo，生产场景可能需要更优雅的 unlock UI。

### 1.2 Design (8.5/10)

7 个架构决策（D1–D6 + canvas recovery）逻辑自洽。"UI 状态也是可恢复数据"的认知升级是本提案最核心的价值。

**关键问题：**

- **D6（SSE catch-up 从持久化 outbox）未兑现** — 实际 `/api/stream/route.ts:118` 仍调用 `bus.getEventsSince(lastEventId)` 使用内存 ring buffer。Projection store 只保存 A2UI/canvas 状态，不保存完整事件 catch-up。这是本次审查中**最严重的设计-实现偏差**。

### 1.3 Specs (8/10)

5 个 spec 覆盖了主要场景：

| Spec                  | 场景数 | 状态                                 |
| --------------------- | ------ | ------------------------------------ |
| chat-session-sync     | 4      | 已实现                               |
| chat-state-recovery   | 4      | 部分实现（catch-up 持久化未落地）    |
| chat-slash-commands   | 4      | 完全实现                             |
| approval-security     | 3      | 已实现（双面板同步依赖事件最终一致） |
| gateway-communication | 2      | 部分实现（同 catch-up 问题）         |

**缺陷：**

1. `gateway-communication` 和 `chat-state-recovery` 的 catch-up persistent storage scenario 与实际实现不符
2. Spec 中缺少 CLAUDE.md 要求的 `Evidence: file:line` 标注

### 1.4 Tasks (8.5/10)

7 组任务从基础到验证层层推进，覆盖范围合理。

---

## 2. Implementation Plan

### Plan (8/10)

**优点：**

- 88 个文件的 file structure 表格详尽
- 每个 step 有明确的 run 命令和 commit 策略
- Chunk 划分合理：Transport → Projection → Recovery

**偏差：**

| 计划内容                                     | 实际                         | 影响                          |
| -------------------------------------------- | ---------------------------- | ----------------------------- |
| `DeckAuthProvider.tsx` 独立组件              | auth 内联在 `deck-client.ts` | 低 — 功能等价                 |
| `migrations/009_chat_session_projection.sql` | 复用 settings 表 key-value   | 低 — 务实选择                 |
| `chat-hooks.ts` selectors 文件               | 未创建                       | 低                            |
| `deckStream` 指数退避                        | 固定延迟重连                 | 低 — 注释中留了退避建议       |
| 分 2–4 个 scoped commit                      | 1 个 88 文件 commit          | **中** — 不利于 revert/bisect |
| SSE catch-up 持久化 outbox                   | 仍用内存 ring buffer         | **高** — 设计核心承诺未兑现   |

---

## 3. Code Implementation

### 3.1 Gateway (9/10)

**`sessions.clear` 全链路正确：**

- `session-reset-service.ts` — `clearSessionConversationState()` 保留 session identity/config，清空运行状态。与 `reset` 正确区分语义
- `sessions.ts:939-968` — handler 遵循标准模式：validate → business → respond → broadcast `sessions.changed`
- `sessions-method-defs.ts` — 一次性补齐所有 sessions 方法的 metadata（params/result schema + scope）
- 四处同步（schema → handler → method-list → scopes → registry-data）全部到位

**sessions.ts schema** — 新增 262 行，覆盖 session row/list/clear/reset/compact/send 等完整 result type。

### 3.2 Browser Transport Layer (9/10)

**`deck-client.ts`（207 行）：**

- `deckFetch()` — 自动注入 `x-deck-token`，401 时尝试 prompt
- `deckStream()` — 基于 `fetch() + ReadableStream` 的 SSE 客户端，替代原生 `EventSource`
- `parseSSEChunk()` — 正确处理多行 `data:` 字段拼接
- `Last-Event-ID` 自动追踪并在 reconnect 时传递
- `waitForReconnect()` 正确处理 abort signal 清理

**测试（`deck-client.test.ts`）：** 覆盖 auth header、401 retry with prompted token、reconnect after network failure。

### 3.3 Chat API Layer (9.5/10)

**`chat-api.ts`（396 行）— 本次最高质量的新文件：**

- 统一错误处理：`readApiError()` + `parseResponseJson<T>()`
- `normalizeSessionMeta()` — 正确映射 Gateway/前端字段名差异（`key`/`sessionKey`、`title`/`displayName`）
- `resolveInitialSessionSendPlan()` — 优雅处理 create→send 四种分支（started / send / error / attachments）
- `sanitizeA2UIState()` — 正确剥离 `bridgeStatus`（运行时状态不持久化）
- 所有 API 方法返回 typed response

### 3.4 History Normalize (9/10)

**`history-normalize.ts`（153 行）：**

- `normalizeToolInput()` — 安全解析 JSON string/object/undefined，任何格式不 crash
- `mergeToolMessages()` — 正确实现 Anthropic 格式（tool_use in assistant + tool_result in user）到单消息合并
- `normalizeHistoryMessages()` — 保证每条消息有唯一 id

**测试（`history-normalize.test.ts`）：** 54 行覆盖主要路径。

### 3.5 Dispatcher Architecture (9/10)

**`chat-dispatchers.ts`（862 行）— 核心架构改造：**

**Thinking 去重（对应 spec `chat-session-sync`）：**

```
tracker.prevThinking 追踪累积文本 → 替换而非追加 → 避免 A / AB / ABC 重复
```

**Tool block 合并策略：**

```
chat delta 不含 tool blocks → merge 时保留本地 tool blocks + 替换 text/thinking
```

**`reloadFullContent()`：**

- 2 次重试
- session-removed 安全检查
- tool block 保留策略（history text/thinking + local tool blocks）

**`dispatchSessionStateEvent()`：**

- 完整处理 `clear`/`reset`/`delete` 的 projection 重置
- 同步 session lifecycle（status/startedAt/endedAt/runtimeMs）到 state + meta

**`dispatchSessionMessageEvent()`：**

- 通过 messageId 去重
- 正确处理 `toolResult` role 映射

### 3.6 SSE Hook (8.5/10)

**`useChatSSE.ts`（234 行）：**

- 正确使用 `deckStream()` 替代原生 `EventSource`
- 新增事件类型：`session-msg`、`session-tool`、`session-state`、`approval.pending`、`approval.resolved`、`canvas`
- Canvas 事件正确触发 `persistSessionProjection`

**问题：** `updateSessionMeta`（行 144-152）直接调用 `useChatStore.setState()` 而非通过 `getStore()` 委托，破坏了 `ChatStoreAPI` 接口抽象的一致性。其他方法都通过 `getStore()` 转发。

### 3.7 Slash Command Semantics (9.5/10)

**完全对齐 spec：**

| 命令        | 设计承诺                                     | 实现                                                                 |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------- |
| `/reset`    | 调用 `sessions.reset`，保持 `sessionKey`     | `resetChatSession()` → `/api/chat/sessions/reset` → `sessions.reset` |
| `/clear`    | 调用 `sessions.clear`，保留 session identity | `clearChatSession()` → `/api/chat/sessions/clear` → `sessions.clear` |
| `/kill all` | 从聊天命令中移除                             | `LOCAL_COMMAND_DEFS` 中无 `kill`（13 个命令）                        |

`SlashCommandAction` 新增 `"reset"` 和 `"clear"` 语义，executor 返回正确 action 供 caller 处理。

### 3.8 Approval Closure (8/10)

- `approval-bridge.ts` — 正确从 `request.sessionKey`/`request.runId` 解包并广播带 session 上下文的事件
- `useChatSSE.ts` — `approval.pending` 分发到 chat store 的 `dispatchApproval`
- `approval.resolved` 同时被 approvals store 和 chat store 消费

**问题：** 两个 store 之间无显式联动。"任一入口 resolve 后两边同步清除"依赖 Gateway 回发的 `approval.resolved` SSE 事件——功能可工作但属于**最终一致**而非**同步清除**。

### 3.9 Projection Store (8.5/10)

- 复用 settings 表 key-value 模式——务实选择，免去 migration
- `getChatSessionProjection` / `setChatSessionProjection` / `clearChatSessionProjection` 覆盖 CRUD
- reset/clear route 正确调用 `clearChatSessionProjection`

**局限：** 目前只持久化 `a2uiState`，`activeApproval` 仍依赖内存 `PendingMap`（server 重启丢失）。

### 3.10 Snapshot Route (8.5/10)

**`/api/chat/snapshot/route.ts`（97 行）：**

- Fan-out 到 `chat.history` + `sessions.list` + `getPendingApprovals()` + `projection store`
- 统一返回 `{ messages, meta, activeApproval, a2uiState }`
- 正确使用 `withAuth` 保护

---

## 4. Test Coverage

### 4.1 覆盖情况

| 测试文件                                    | 覆盖范围                                                                                                  | 用例数 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| `dispatcher.test.ts`                        | delta/final/error/aborted、cross-session、thinking 去重、approval、A2UI、session state、reloadFullContent | ~30    |
| `slash-command-executor.test.ts`            | kill 移除、reset 路由、clear 路由                                                                         | 3      |
| `deck-client.test.ts`                       | auth header、401 retry、reconnect                                                                         | 3      |
| `projection-store.test.ts`                  | CRUD 操作                                                                                                 | ~5     |
| `chat-api.test.ts`                          | 归一化逻辑                                                                                                | ~5     |
| `history-normalize.test.ts`                 | content/tool 归一化                                                                                       | ~5     |
| `stream/route.test.ts`                      | stream route 基础功能                                                                                     | ~5     |
| `session-message-events.test.ts`（Gateway） | session message/tool 订阅                                                                                 | ~5     |
| `server.sessions.*.test.ts`（Gateway）      | sessions.clear/reset 契约                                                                                 | ~5     |

### 4.2 覆盖缺口

- Snapshot route 无独立测试
- Stream route access-gate 行为（plan 中 Task 1 Step 1.5 要求）
- A2UI bridge 恢复路径（切会话→切回→canvas 恢复）
- `DeckAuthProvider` / unlock UI 状态转换

---

## 5. Findings Summary

### Critical (1)

| #   | 问题                      | 位置                                        | 说明                                                                                                                                   |
| --- | ------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | SSE catch-up 持久化未实现 | `dashboard/src/app/api/stream/route.ts:118` | Design D6 和 2 个 spec scenario 承诺从持久化 outbox 恢复，实际仍用 `bus.getEventsSince()` 内存 ring buffer。需要补实现或降级 spec 承诺 |

### Major (2)

| #   | 问题                      | 位置                                   | 说明                                                                                     |
| --- | ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| M1  | 88 文件单 commit          | commit `08acceff6f`                    | Plan Step 7.5 建议分 2-4 个 scoped commit。单 commit 不利于 revert/bisect/review         |
| M2  | Approval 双面板非同步清除 | `useChatSSE.ts` + `useApprovalsSSE.ts` | 两个 store 各自消费 `approval.resolved`，依赖 SSE 事件最终一致而非 spec 要求的"同步清除" |

### Minor (5)

| #   | 问题                                       | 位置                                              | 说明                                                         |
| --- | ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| m1  | `updateSessionMeta` 绕过 ChatStoreAPI 接口 | `useChatSSE.ts:144-152`                           | 直接 `useChatStore.setState()` 而非 `getStore()` 委托        |
| m2  | `deckStream` 无指数退避                    | `deck-client.ts:202`                              | stream route 注释建议了退避策略，但实现为固定延迟            |
| m3  | Projection 只持久化 A2UI                   | `projection-store.ts`                             | `activeApproval` 依赖内存，server 重启丢失                   |
| m4  | Spec 缺 Evidence 标注                      | `openspec/changes/deck-chat-flow-closure/specs/*` | CLAUDE.md 要求 THEN 引用"已有能力"时需 `Evidence: file:line` |
| m5  | Snapshot route 无测试                      | `dashboard/src/app/api/chat/snapshot/route.ts`    | 作为新 hydrate 入口缺少直接测试                              |

---

## 6. Recommendations

### 必须处理

1. **C1 — 在 spec/design 中标注 catch-up 持久化为 deferred**，或在后续 commit 补实现。当前内存 buffer 不满足 spec 承诺

### 建议处理

2. **M1 — 后续提交按 plan chunk 分拆**。至少分成：Gateway 契约 / 传输层 / session projection / slash 命令 / approval+canvas
3. **M2 — 评估是否需要 store 间直接联动**（例如 approval resolve 时 chat store 直接调用 approvals store 的 `removePending`）
4. **m1 — 将 `updateSessionMeta` 移到 `getStore()` 模式**保持 ChatStoreAPI 一致性
5. **m5 — 补 snapshot route 测试**

---

## 7. Score Card

| 维度            | 评分       | 说明                                               |
| --------------- | ---------- | -------------------------------------------------- |
| 提案/设计质量   | 8.5/10     | 问题定位精准，架构决策合理                         |
| Spec 覆盖度     | 8/10       | 17 个 scenario，2 个与实现不一致                   |
| Plan 可执行性   | 8/10       | 结构好但多处偏差                                   |
| 代码实现质量    | 9/10       | chat-api + dispatcher + history-normalize 质量优秀 |
| 设计-实现一致性 | 7.5/10     | D6 catch-up 未兑现是主要扣分项                     |
| 测试覆盖度      | 8/10       | 核心路径覆盖好，边缘场景有缺口                     |
| **综合**        | **8.2/10** |                                                    |

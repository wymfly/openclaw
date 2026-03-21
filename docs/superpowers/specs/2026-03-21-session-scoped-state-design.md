# Session-Scoped 状态基础设施设计规范

## 概述

将 openclaw-deck Dashboard 的 chat 状态管理从扁平 Zustand store 重构为 session-scoped `Map<sessionKey, SessionState>` 架构。解决当前会话切换时的数据竞态、SSE 连接断裂、异步操作无法取消、后台 session 状态丢失等阻碍性问题，并为后续高级功能（Tool Progress、Approval、A2UI Canvas、多窗格）提供健壮的基础设施。

## 背景与动机

### 当前架构问题

多模态对话功能实现后，暴露出 session 渲染的结构性问题。虽然通过 4 个 hotfix commit 解决了最严重的症状（跨 session 消息注入、旧 fetch 覆盖、闪现），但核心设计缺陷未根治：

1. **扁平 store** — 所有消息、流状态、SSE 事件共用一个 Zustand store，靠运行时 `if (sessionKey !== activeSessionId) return` 做过滤
2. **SSE 连接不稳定** — `activeSessionId` 在 `useEffect` 依赖数组中，切换 session 导致 EventSource 重建（连接断裂 + 3 秒重连延迟）
3. **异步操作无法取消** — `reloadLastMessage` 等 fetch 无 AbortController，可能跨 session 污染
4. **后台 session 丢失** — 切走的 session 流式进度完全丢弃
5. **消息 ID 不唯一** — `hist-${index}` 格式导致 React key 冲突

### 后续功能依赖

以下功能都需要 session-scoped 的状态隔离：

- Tool 执行实时进度（tool_use → tool_result 生命周期跟踪）
- Human-in-the-loop 审批流（跨 session 的 pending approval）
- A2UI Canvas 交互（iframe 状态与 session 绑定）
- 多 Agent 并行对话（多 session 同时流式输出）
- 多窗格 UI（同时渲染多个 session）

## 设计原则

1. **Session 即一等实体** — 每个 session 拥有完整、隔离的状态容器
2. **单连接 + 客户端路由** — 一个 EventSource 服务所有 session，按 `payload.sessionKey` 分发
3. **活跃/惰性分层** — 正在流式输出的 session 永不淘汰，已完成的按 LRU 释放
4. **Gateway 零改动** — 所有变更限制在 Dashboard 前端（`dashboard/src/`）

## 约束

- Gateway 的 SSE 端点已在所有事件中携带 `sessionKey`，无需修改
- 与渠道消息流（Telegram/Discord/WeCom 等）完全不冲突 — 改动范围仅在 Dashboard 前端
- 现有 API routes（`/api/chat/send`、`/api/chat/history` 等）不变

---

## 一、数据模型

### SessionState

```typescript
interface SessionState {
  // --- 消息 ---
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingRunId: string | null;
  error: string | null;

  // --- Tool 执行进度 ---
  toolProgress: Record<string, ToolProgress>;
  // 使用 Record 而非 Map — 与 Zustand 不可变性模型和 JSON 序列化兼容

  // --- 审批 ---
  activeApproval: ApprovalRequest | null;

  // --- A2UI Canvas ---
  a2uiState: A2UIState | null;

  // --- 生命周期管理 ---
  status: "active" | "idle";
  lastAccessedAt: number;
  // 注意：AbortController 不存储在 SessionState 中（不可序列化）
  // 见「AbortController 管理」小节
}
```

> **附件状态不纳入 SessionState** — `PendingAttachment`（文件选择、预览、base64 编码）保留为 `MessageInput` 组件的本地状态。原因：不存在跨 session 的附件场景（用户不会在 session A 选文件然后切到 session B 发送），组件级状态更简单且避免 `File` 对象在 store 中的序列化问题。

### 子类型

```typescript
interface ToolProgress {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  status: "running" | "completed" | "error";
  result?: string | ContentBlock[];
  startedAt: number;
}

interface ApprovalRequest {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  status: "pending" | "approved" | "denied";
}

interface A2UIState {
  html: string;
}

// 侧栏列表用的轻量元信息（不含消息内容）
interface SessionMeta {
  key: string; // sessionKey
  agentId: string;
  title?: string; // Gateway 生成的派生标题
  updatedAt: number;
  lastMessagePreview?: string; // 最后一条消息的摘要文本
}
```

### AbortController 管理

`AbortController` 是非序列化的浏览器 API 对象，**不存储在 Zustand store 中**（会破坏 devtools/persist 中间件）。使用模块级 Map 独立管理：

```typescript
// 模块级，与 store 生命周期解耦
const sessionAbortControllers = new Map<string, AbortController>();

function getSessionAbort(sessionKey: string): AbortController {
  let ctrl = sessionAbortControllers.get(sessionKey);
  if (!ctrl) {
    ctrl = new AbortController();
    sessionAbortControllers.set(sessionKey, ctrl);
  }
  return ctrl;
}

function abortSession(sessionKey: string): void {
  sessionAbortControllers.get(sessionKey)?.abort();
  sessionAbortControllers.delete(sessionKey);
}
```

### 设计决策

- **`streamingRunId`** — 显式记录当前流式 runId，`reloadLastMessage` 精确定位要替换的消息
- **`toolProgress` 用 Record** — 一个 session 内可能同时有多个 tool 在执行（Agent 并行调用）；使用 Record 而非 Map，与 Zustand 浅比较和 JSON 序列化兼容
- **AbortController 外置** — 模块级 Map 管理，避免 store 序列化问题，session 淘汰或删除时调用 `abortSession(key)` 取消所有 pending fetch
- **`status` 仅区分 active/idle** — `error` 字段独立存在，不引入更多状态枚举
- **附件留在组件本地** — 不存在跨 session 附件场景，`File` 对象不可序列化

### 交互模式兼容性

SessionState 天然支持所有高级交互模式，不同场景只是字段值的组合：

| 场景          | isStreaming | activeApproval | a2uiState | status |
| ------------- | ----------- | -------------- | --------- | ------ |
| 普通对话中    | true        | null           | null      | active |
| 等待审批      | true        | {...}          | null      | active |
| 流式 + Canvas | true        | null           | {...}     | active |
| 审批 + Canvas | true        | {...}          | {...}     | active |
| 对话结束      | false       | null           | {...}     | idle   |
| 空闲          | false       | null           | null      | idle   |

---

## 二、Store API

### 顶层结构

```typescript
interface ChatStore {
  // --- 顶层状态 ---
  sessions: Map<string, SessionState>;
  activeSessionKey: string | null;
  activeAgentId: string | null; // 当前选中的 Agent（保留现有字段）
  sessionMeta: SessionMeta[]; // 侧栏列表（轻量，从 /api/chat/sessions 加载）

  // --- Session 生命周期 ---
  ensureSession(key: string): SessionState;
  // 如果 Map 中不存在则创建空 SessionState
  // 如果已存在则更新 lastAccessedAt 并返回
  // 注意：ensureSession 不创建 SessionMeta — SSE 事件产生的
  // "幽灵 session" 会在下次 sessions 刷新时出现在侧栏

  removeSession(key: string): void;
  // abortSession(key) + 从 Map 和 sessionMeta 中删除

  setActiveSession(key: string | null): void;
  // 详见「Rehydrate 流程」

  evictStale(maxIdleMs?: number): void;
  // 详见「淘汰策略」— 必须通过 set() 创建新 Map 触发 re-render

  // --- Session Meta ---
  setSessionMeta(meta: SessionMeta[]): void;
  // 从 /api/chat/sessions 加载后整体替换
  refreshSessionMeta(): Promise<void>;
  // 异步刷新侧栏列表

  // --- 消息操作（以 sessionKey 定位）---
  addMessage(sessionKey: string, msg: ChatMessage): void;
  // 幂等：如果 msg.id 已存在于该 session 的 messages 中，忽略（不创建重复）
  // 这保证 SSE delta 事件的首次和后续调用都安全

  updateStreamingBlocks(sessionKey: string, runId: string, blocks: ContentBlock[]): void;
  finalizeStreamingMessage(sessionKey: string, runId: string): void;
  replaceMessageContent(sessionKey: string, messageId: string, blocks: ContentBlock[]): void;
  setMessages(sessionKey: string, msgs: ChatMessage[]): void;
  // 整体替换该 session 的消息。用于历史加载和 rehydrate。
  // 合并策略：如果 session 已有通过 SSE 到达的消息（messages.length > 0），
  // 则按 message.id 去重合并，而非直接覆盖（防止 rehydrate 与 SSE 竞态丢消息）

  // --- 流状态操作 ---
  setStreaming(sessionKey: string, streaming: boolean, runId?: string): void;
  setError(sessionKey: string, error: string | null): void;

  // --- 实体操作 ---
  updateToolProgress(sessionKey: string, toolUseId: string, progress: Partial<ToolProgress>): void;
  setActiveApproval(sessionKey: string, approval: ApprovalRequest | null): void;
  setA2UIState(sessionKey: string, state: A2UIState | null): void;

  // --- Agent ---
  setActiveAgent(agentId: string | null): void;
}
```

### Selector Hooks

```typescript
// 便捷 hook — 返回完整 SessionState
// ⚠️ 仅用于调试或需要多字段的场景，生产组件优先使用细粒度 hooks
function useSessionState(sessionKey?: string): SessionState | undefined;

// 细粒度 hooks — 避免不必要的 re-render（生产组件必须使用）
function useSessionMessages(sessionKey?: string): ChatMessage[];
function useSessionStreaming(sessionKey?: string): { isStreaming: boolean; runId: string | null };
function useSessionToolProgress(sessionKey?: string): Record<string, ToolProgress>;
function useSessionApproval(sessionKey?: string): ApprovalRequest | null;
function useActiveSessionKey(): string | null;
function useSessionMetaList(): SessionMeta[];

// 侧栏状态指示器 — 从 SessionState 派生
function useSessionIndicator(key: string): "approval" | "streaming" | "canvas" | "idle" | "none";
```

### 关键行为

- **`ensureSession`** 是唯一创建入口 — dispatcher 收到未知 sessionKey 事件时自动创建。来自未知 session 的事件会创建"幽灵 session"（有状态但不在侧栏），下次 `refreshSessionMeta()` 时出现在侧栏
- **`setActiveSession` 不再 clearMessages** — 切换只移动指针，旧 session 消息保留在 Map 中
- **`addMessage` 幂等** — 按 `message.id` 去重，SSE delta 的首次和后续调用都安全，不会创建重复消息
- **`setMessages` 合并策略** — rehydrate 时如果 session 已有 SSE 到达的消息，按 ID 去重合并而非覆盖，防止竞态丢消息
- **Selector hooks 做细粒度订阅** — `useSessionMessages(key)` 只在该 session 的 messages 变化时 re-render
- **`sessionMeta` 和 `sessions` Map 分离** — 侧栏列表从 `/api/chat/sessions` 加载，不依赖完整 SessionState；`ensureSession` 不创建 meta 条目

---

## 三、SSE Dispatcher 架构

将 SSE 拆成两层：连接层（稳定）和路由层（按 sessionKey 分发）。

### 连接层

```typescript
// useSSEConnection() — 生命周期 = ChatPanel 组件挂载/卸载
useEffect(() => {
  const es = new EventSource("/api/stream");
  es.addEventListener("chat", (e) => dispatchChatEvent(JSON.parse(e.data)));
  es.addEventListener("agent", (e) => dispatchAgentEvent(JSON.parse(e.data)));
  es.addEventListener("approval.pending", (e) => dispatchApproval(JSON.parse(e.data)));
  es.addEventListener("approval.resolved", () => /* ... */);
  es.addEventListener("a2ui", (e) => dispatchA2UIEvent(JSON.parse(e.data)));
  return () => es.close();
}, []); // 空依赖！不因 session 切换而重建
```

### 路由层

```typescript
function dispatchChatEvent(payload: ChatSSEPayload) {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) return;

  const store = useChatStore.getState();
  store.ensureSession(sessionKey);

  switch (payload.state) {
    case "delta": {
      const session = store.sessions.get(sessionKey)!;
      const isFirstDelta = session.streamingRunId !== payload.runId;

      store.setStreaming(sessionKey, true, payload.runId);

      if (isFirstDelta) {
        // 首个 delta — 创建 assistant 消息
        store.addMessage(sessionKey, {
          id: payload.runId,
          role: "assistant",
          content: [{ type: "text", text: payload.text ?? "" }],
          timestamp: Date.now(),
          streaming: true,
        });
      } else {
        // 后续 delta — 追加文本到现有消息
        store.updateStreamingBlocks(sessionKey, payload.runId, [
          { type: "text", text: payload.text ?? "" },
        ]);
      }
      // addMessage 是幂等的（按 id 去重），所以即使判断逻辑有边界情况，
      // 也不会创建重复消息
      break;
    }
    case "final":
      store.updateStreamingBlocks(sessionKey, payload.runId, [
        { type: "text", text: payload.text ?? "" },
      ]);
      store.finalizeStreamingMessage(sessionKey, payload.runId);
      store.setStreaming(sessionKey, false);
      reloadFullContent(sessionKey, payload.runId);
      break;
    case "error":
      store.setError(sessionKey, payload.message);
      store.setStreaming(sessionKey, false);
      break;
    case "aborted":
      store.setStreaming(sessionKey, false);
      break;
  }
}
```

### 异步操作取消安全

```typescript
async function reloadFullContent(sessionKey: string, runId: string) {
  const signal = getSessionAbort(sessionKey).signal;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`/api/chat/history?sessionKey=${sessionKey}&limit=1`, { signal });
      if (signal.aborted) return;
      const data = await res.json();
      // 二次检查：session 是否仍存在于 Map 中
      if (!useChatStore.getState().sessions.has(sessionKey)) return;
      useChatStore.getState().replaceMessageContent(sessionKey, runId, mapToContentBlocks(data));
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (attempt === 0) await sleep(1000);
    }
  }
}
```

### 与当前架构对比

| 方面             | 当前                                                 | 新设计                           |
| ---------------- | ---------------------------------------------------- | -------------------------------- |
| EventSource 依赖 | `[activeSessionId, ...]` — 切 session 重建连接       | `[]` — 组件级生命周期，稳定      |
| 事件过滤         | `if (key !== activeSessionId) return` — 丢弃后台事件 | 按 key 路由 — 后台事件也跟踪     |
| store 访问       | 闭包捕获 action 函数                                 | `getState()` 访问最新状态        |
| 异步取消         | 无                                                   | `session.abortController.signal` |

---

## 四、Session 生命周期管理

### 状态机

```
  ┌──────────┐   SSE delta 到达    ┌──────────┐
  │  (不存在) │ ──────────────────→ │  active   │
  └──────────┘   ensureSession()   │ 正在流式  │
       ↑                           └────┬─────┘
       │                                │ SSE final/error/aborted
       │ evictStale()                   ↓
       │ (超过阈值)              ┌──────────┐
       └──────────────────────── │   idle    │
         释放 messages[]        │ 流已结束  │
         保留 sessionMeta       └────┬─────┘
                                     │ 用户切回 / 新 SSE delta
                                     ↓
                              ┌────────────┐
                              │ rehydrate  │
                              │ 从 history │
                              │ 重新加载    │
                              └────────────┘
```

### 淘汰策略

```typescript
function evictStale(maxIdleMs = 5 * 60 * 1000) {
  const now = Date.now();
  const { sessions, activeSessionKey } = useChatStore.getState();
  const keysToEvict: string[] = [];

  for (const [key, session] of sessions) {
    if (session.status === "active") continue; // 活跃 session 永不淘汰
    if (key === activeSessionKey) continue; // 当前查看的不淘汰
    if (now - session.lastAccessedAt < maxIdleMs) continue;
    keysToEvict.push(key);
  }

  if (keysToEvict.length === 0) return;

  // 必须通过 set() 创建新 Map 以触发 Zustand re-render
  // 直接 sessions.delete() 不改变引用，订阅者不会收到通知
  useChatStore.setState((state) => {
    const next = new Map(state.sessions);
    for (const key of keysToEvict) {
      abortSession(key); // 取消 pending fetch
      next.delete(key);
    }
    return { sessions: next };
  });
  // sessionMeta 保留 — 侧栏列表不受影响
}
```

> **测试友好**：`evictStale(maxIdleMs)` 接受参数，测试中可传 100ms 避免等待 5 分钟。

### 淘汰触发时机

| 触发点                                  | 原因                     |
| --------------------------------------- | ------------------------ |
| `setActiveSession(key)`                 | 用户切换时顺便清理       |
| `ensureSession(key)` 且 Map.size > 阈值 | 缓存过多时清理           |
| `visibilitychange` → hidden             | 用户切走标签页时激进清理 |

### Rehydrate 流程

切回已淘汰 session 时透明加载：

```typescript
setActiveSession(key) {
  // 先触发淘汰（自然触发点）
  get().evictStale();

  set({ activeSessionKey: key });
  if (!key) return;

  const session = get().sessions.get(key);
  if (session) {
    // 缓存命中 — 瞬间展示，更新访问时间
    // 通过 set() 更新以触发 re-render
    set((state) => {
      const next = new Map(state.sessions);
      const s = { ...next.get(key)!, lastAccessedAt: Date.now() };
      next.set(key, s);
      return { sessions: next };
    });
    return;
  }

  // 缓存未命中 — rehydrate
  get().ensureSession(key);
  const signal = getSessionAbort(key).signal;

  loadHistory(key, signal)
    .then(messages => {
      if (get().activeSessionKey !== key) return;
      // 使用 setMessages 的合并策略：
      // 如果加载期间有 SSE 事件到达（addMessage 已填入消息），
      // setMessages 会按 ID 去重合并，不会丢失 SSE 消息
      get().setMessages(key, messages);
    });
}
```

### 内存预算

| 项目                                | 每 session | 10 个缓存 session |
| ----------------------------------- | ---------- | ----------------- |
| messages（100 条 + content blocks） | ~200 KB    | ~2 MB             |
| toolProgress（5 个工具）            | ~5 KB      | ~50 KB            |
| approval + a2ui                     | ~2 KB      | ~20 KB            |
| **总计**                            | ~207 KB    | **~2 MB**         |

---

## 五、消息 ID 迁移

```typescript
// 旧：不唯一
function toUiMessage(msg: GatewayMessage, index: number): ChatMessage {
  return { id: `hist-${index}`, ... };
}

// 新：全局唯一且跨 rehydrate 稳定
function toUiMessage(msg: GatewayMessage, index: number, sessionKey: string): ChatMessage {
  return {
    id: msg.id ?? `${sessionKey}:${msg.timestamp ?? 0}:${index}`,
    // 优先使用 Gateway 消息自带 id
    // 否则用 sessionKey + 时间戳 + 索引 保证全局唯一
    // 不使用 Date.now() — 保证同一消息在多次 rehydrate 中 ID 稳定
    ...
  };
}
```

---

## 六、迁移策略

### 原则

现有功能零回归。重构是换引擎，不是换车。

### 步骤

| Step | 内容                                                 | 风险                   | 产出                                                                     |
| ---- | ---------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------ |
| 1    | 新建 SessionState 类型 + selector hooks              | 零 — 纯类型定义        | `types.ts` + `hooks.ts`                                                  |
| 2    | 重写 `stores/chat.ts` + 兼容层                       | 中 — 核心改动          | 新 store，旧 API 通过桥接暂时可用                                        |
| 3    | 重写 `useChatSSE` → `useSSEConnection` + dispatchers | 中 — SSE 重构          | 新 SSE 层                                                                |
| 4    | 逐个迁移消费方组件                                   | 低 — 逐个替换 selector | ChatPanel → MessageList → MessageInput → SessionSidebar → ApprovalDialog |
| 5    | 移除兼容层                                           | 低 — 删除旧代码        | 干净的新 API                                                             |
| 6    | 添加 evictStale 生命周期管理                         | 低 — 增量添加          | 完整内存管理                                                             |

### 兼容层（Step 2-4 过渡期）

```typescript
function getActiveSession(): SessionState | undefined {
  const state = useChatStore.getState();
  if (!state.activeSessionKey) return undefined;
  return state.sessions.get(state.activeSessionKey);
}
```

### 影响矩阵

| 文件                 | 改动量 | 说明                            |
| -------------------- | ------ | ------------------------------- |
| `stores/chat.ts`     | 重写   | 扁平 → Map                      |
| `useChatSSE.ts`      | 重写   | 闭包 → dispatcher               |
| `ChatPanel.tsx`      | 中等   | useEffect 简化                  |
| `MessageList.tsx`    | 小     | selector 替换                   |
| `MessageInput.tsx`   | 小     | selector + action 加 sessionKey |
| `SessionSidebar.tsx` | 更简单 | 删除 clearMessages 调用         |
| `ApprovalDialog.tsx` | 小     | selector 替换                   |
| API routes           | 零     | 不变                            |
| Gateway              | 零     | 不变                            |

---

## 七、验收标准

| #   | 验证点              | 验证方式                                                  |
| --- | ------------------- | --------------------------------------------------------- |
| 1   | 正常对话收发        | 发消息 → 流式回复 → 完整内容块渲染                        |
| 2   | Session 切换无闪现  | 快速切换 3 个 session，无旧消息闪现                       |
| 3   | 后台 session 流跟踪 | 在 session A 发消息 → 切到 B → 切回 A 看到完整回复        |
| 4   | SSE 连接稳定        | 连续切换 10 次 session，Network 面板只有 1 个 EventSource |
| 5   | 附件发送            | 图片 + 文件附件正常发送和渲染                             |
| 6   | Abort 功能          | 流式中点击停止 → 立即停止 → 可重新发送                    |
| 7   | 淘汰后恢复          | 等待 5 分钟 → 切回已淘汰 session → 历史正确加载           |
| 8   | 内存无泄漏          | DevTools Memory 面板，20 次切换后无持续增长               |
| 9   | 多模态历史          | 含图片/工具/thinking 块的历史消息正确渲染                 |

---

## 八、后续提案路线图

本提案（提案 1）建立基础设施后，以下提案在预留的 SessionState 槽位上独立开发：

### 提案 2: Tool Progress 实时渲染

- **填充槽位**：`SessionState.toolProgress`
- **工作内容**：SSE dispatcher 路由 tool 事件 → `updateToolProgress()` → `ToolProgressCard` UI 组件
- **前置依赖**：提案 1
- **是否需要头脑风暴**：否，直接写 plan
- **预估复杂度**：低

### 提案 3: Approval 审批流

- **填充槽位**：`SessionState.activeApproval`
- **工作内容**：SSE dispatcher 路由 approval 事件 → `setActiveApproval()` → `ApprovalDialog` 增强 + 侧栏指示器
- **前置依赖**：提案 1
- **是否需要头脑风暴**：否，直接写 plan
- **预估复杂度**：低
- **备注**：Gateway RPC 已有 (`exec.approvals.*`)，ApprovalDialog 组件已存在

### 提案 4: A2UI Canvas 交互

- **填充槽位**：`SessionState.a2uiState`
- **工作内容**：iframe 沙箱渲染、bridge 通信协议、双向交互模型、安全策略
- **前置依赖**：提案 1
- **是否需要头脑风暴**：**是** — 涉及新系统能力，设计空间大
- **预估复杂度**：高

### 提案 5: 多窗格 UI（C 方案）

- **填充槽位**：无 — 纯 UI 层
- **工作内容**：多个 ChatPanel 实例绑定不同 sessionKey，布局选型（标签页/分屏/浮动窗口）
- **前置依赖**：提案 1
- **是否需要头脑风暴**：轻量级讨论
- **预估复杂度**：中

### 依赖关系

```
提案 1 (本提案)
  ├── 提案 2 (Tool Progress)     ← 可并行
  ├── 提案 3 (Approval)          ← 可并行
  ├── 提案 4 (A2UI Canvas)       ← 可并行，需独立头脑风暴
  └── 提案 5 (多窗格 UI)         ← 建议最后做，依赖 2-4 的 UI 组件成熟
```

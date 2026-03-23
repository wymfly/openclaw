# Deck Chat Store 重构 + ModelsPanel 导航设计

## 概述

对 openclaw-deck Dashboard 执行 3 个架构改进：

1. **Dispatcher 抽取** — 将 `useChatSSE.ts` 中的事件分发逻辑抽为纯函数，解锁可测试性
2. **Session 隔离 + ContentBlock 迁移** — ChatStore 从扁平 `messages[]` 重构为 `Map<string, SessionState>`，消息内容从 `content: string` 迁移到 `content: ContentBlock[]`
3. **ModelsPanel Tab 导航** — 将两列布局改为 4-tab 布局，整合已有的 Fallbacks/Usage 组件

## 背景

功能测试 16 轮（351 用例，91% 通过率）暴露以下结构性问题：

- 切换 session 时消息丢失（扁平 store 无 session 隔离）
- SSE dispatcher 嵌在 React hook 内无法独立测试（85 个测试 TS 错误）
- `extractTextFromMessage` 将结构化 ContentBlock[] 有损压缩为 string
- ModelsPanel 的 Fallbacks/Usage tab 组件已存在但未组装
- 301 个测试 TS 错误全部因为测试是按 SST 提案编写但 store 未实现

先前 SST 设计文档：`docs/superpowers/specs/2026-03-21-session-scoped-state-design.md`。本文档基于 brainstorming 讨论确定最终方案，是该设计的精炼版本。

## 约束

- Gateway SSE 端点无需修改（所有事件已携带 `sessionKey`）
- 改动范围限制在 `dashboard/src/`
- 现有 API routes 不变
- 阶段 1 和 2 严格串行（2 依赖 1 的产出），阶段 3 独立

---

## 阶段 1：Dispatcher 抽取

### 目标

将 `useChatSSE.ts`（362 行）拆为纯函数模块 + 瘦 hook wrapper，实现事件分发逻辑的独立单元测试。

### 新建文件：`stores/chat-dispatchers.ts`

#### DispatcherContext

替代 React ref 的可变状态容器，跟踪流式传输中间状态：

```typescript
export interface DispatcherContext {
  streamingRunId: string | null;
  prevThinking: string;
  prevToolCount: number;
}

export function createDispatcherContext(): DispatcherContext {
  return { streamingRunId: null, prevThinking: "", prevToolCount: 0 };
}
```

#### ChatStoreAPI

Dispatcher 通过此接口操作 store，与 Zustand 实现解耦：

```typescript
export interface ChatStoreAPI {
  addMessage: (msg: ChatMessage) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  finalizeStreamingMessage: (id: string) => void;
  appendThinking: (id: string, text: string) => void;
  appendToolUse: (id: string, tool: ToolUseBlock) => void;
  updateToolUseResult: (
    msgId: string,
    toolCallId: string,
    result: string,
    isError?: boolean,
  ) => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  setRunMetadata: (id: string, metadata: ChatMessage["runMetadata"]) => void;
  getMessages: () => ChatMessage[];
}
```

#### 纯函数 dispatchers

```typescript
export function dispatchChatEvent(
  payload: ChatEventPayload,
  store: ChatStoreAPI,
  ctx: DispatcherContext,
): void;

export function dispatchAgentEvent(
  payload: AgentEventPayload,
  store: ChatStoreAPI,
  ctx: DispatcherContext,
): void;
```

逻辑从 `useChatSSE.ts` 的 `es.addEventListener("chat", ...)` 和 `es.addEventListener("agent", ...)` 原样迁移。

#### Helper 函数迁移

以下函数从 useChatSSE.ts 移至 chat-dispatchers.ts：

- `extractTextFromMessage(message) → string`
- `extractThinking(message) → string`
- `extractToolUse(message) → ToolUseInfo[]`

### 修改文件：`components/panels/chat/useChatSSE.ts`

变为 ~25 行瘦 wrapper：

```typescript
export function useChatSSE() {
  const store = useChatStore();
  const ctxRef = useRef(createDispatcherContext());

  useEffect(() => {
    const api: ChatStoreAPI = {
      addMessage: store.addMessage,
      updateStreamingMessage: store.updateStreamingMessage,
      // ... 映射 store 方法
      getMessages: () => useChatStore.getState().messages,
    };
    const es = new EventSource("/api/stream");
    es.addEventListener("chat", (e) => dispatchChatEvent(JSON.parse(e.data), api, ctxRef.current));
    es.addEventListener("agent", (e) =>
      dispatchAgentEvent(JSON.parse(e.data), api, ctxRef.current),
    );
    return () => es.close();
  }, [store]);
}
```

### 关键约束

- **Phase 1 不改任何数据结构**。ChatMessage 仍为 `content: string`
- **行为完全等价**。纯重构，逻辑零变化
- 预期修复测试错误：dispatcher.test.ts (85) + tool-progress-dispatcher.test.ts (9) = **94 个**

---

## 阶段 2：Session 隔离 + ContentBlock 迁移

### 目标

1. ChatStore 从扁平结构重构为 `Map<string, SessionState>`，实现 session 级状态隔离
2. 消息内容从 `content: string` 迁移到 `content: ContentBlock[]`（无损存储）

### 数据模型

#### ContentBlock（已定义在 chat-types.ts）

```typescript
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; fileName?: string }
  | { type: "file"; data: string; mimeType: string; fileName: string; size?: number }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string | ContentBlock[]; isError?: boolean }
  | { type: "thinking"; text: string };
```

#### ChatMessage（重新定义）

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[]; // 从 string 改为 ContentBlock[]
  timestamp: number;
  streaming?: boolean;
  error?: string;
  runMetadata?: RunMetadata;
  // 移除: thinking?: string（现在是 ContentBlock）
  // 移除: toolUse?: ToolUseBlock[]（现在是 ContentBlock）
}
```

#### SessionState（最终版本）

```typescript
export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  runMetadata: Record<string, RunMetadata>;
  a2uiState: A2UIState | null;
  lastAccessedAt: number;
}
```

设计决策：

- **a2uiState 包含** — 天然 per-session，当前已实现为 `_a2uiState: Map`
- **subagentRuns 不包含** — 数据源不存在（需 Gateway SSE 扩展），YAGNI，待 Gateway 支持后加入

#### ChatState（store 顶层）

```typescript
export interface ChatState {
  sessions: Map<string, SessionState>;
  sessionMetas: SessionMeta[]; // 侧边栏列表（轻量）
  activeSessionKey: string | null;
  activeAgentId: string | null;

  // Session 管理
  ensureSession: (key: string) => SessionState;
  setActiveSession: (key: string | null) => void;

  // Session-scoped 操作（全部带 sessionKey 参数）
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  finalizeMessage: (sessionKey: string, msgId: string) => void;
  setSessionStreaming: (sessionKey: string, streaming: boolean) => void;
  setSessionError: (sessionKey: string, error: string | null) => void;
  setRunMetadata: (sessionKey: string, msgId: string, metadata: RunMetadata) => void;

  // A2UI (session-scoped)
  updateA2UIBridgeStatus: (sessionKey: string, status: "connecting" | "ready" | "error") => void;
  appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
  setA2UIState: (sessionKey: string, patch: Partial<A2UIState>) => void;

  // Tool progress (session-scoped)
  updateToolProgress: (sessionKey: string, toolUseId: string, progress: ToolProgress) => void;

  // Approval (session-scoped)
  setActiveApproval: (sessionKey: string, approval: ApprovalRequest | null) => void;

  // Session list
  setSessionMetas: (metas: SessionMeta[]) => void;
}
```

### ContentBlock 流式处理

当前流程（有损）：

```
SSE payload.message.content: ContentBlock[]
  → extractTextFromMessage → string (丢失 block 边界)
  → 存储为 content: string
```

新流程（无损）：

```
SSE payload.message.content: ContentBlock[]
  → 直接存储为 content: ContentBlock[]
  → delta: 替换整个 content 数组（Gateway 发送累积内容）
  → final: 同上 + 标记 streaming: false
```

### 渲染层辅助函数

```typescript
// chat-types.ts
export function getTextContent(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function getThinkingContent(msg: ChatMessage): string {
  return msg.content
    .filter((b): b is Extract<ContentBlock, { type: "thinking" }> => b.type === "thinking")
    .map((b) => b.text)
    .join("");
}

export function getToolUseBlocks(msg: ChatMessage): Extract<ContentBlock, { type: "tool_use" }>[] {
  return msg.content.filter(
    (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use",
  );
}
```

### Dispatcher 适配（Phase 1 → Phase 2）

#### ChatStoreAPI 变为 session-scoped

```typescript
export interface ChatStoreAPI {
  ensureSession: (key: string) => void;
  addMessage: (sessionKey: string, msg: ChatMessage) => void;
  updateStreamingContent: (sessionKey: string, msgId: string, content: ContentBlock[]) => void;
  finalizeMessage: (sessionKey: string, msgId: string) => void;
  setSessionStreaming: (sessionKey: string, streaming: boolean) => void;
  setSessionError: (sessionKey: string, error: string | null) => void;
  setRunMetadata: (sessionKey: string, msgId: string, metadata: RunMetadata) => void;
  getSessionMessages: (sessionKey: string) => ChatMessage[];
}
```

#### DispatcherContext → per-session

多 session 可同时流式传输，因此：

- `streamingRunId` 移入 `SessionState.streamingRunId`（消费者需要）
- `prevThinking` / `prevToolCount` 保留为 dispatcher 内部状态，变为 per-session Map：

```typescript
interface StreamingTracker {
  prevThinking: string;
  prevToolCount: number;
}

// hook 内维护
const trackersRef = useRef(new Map<string, StreamingTracker>());
```

#### 事件路由

所有 SSE 事件通过 `payload.sessionKey` 路由到对应 session：

```typescript
export function dispatchChatEvent(
  payload: ChatEventPayload,
  store: ChatStoreAPI,
  trackers: Map<string, StreamingTracker>,
): void {
  const sessionKey = payload.sessionKey;
  store.ensureSession(sessionKey);
  // ... 路由到 session-scoped 操作
}
```

### chat-hooks.ts 变更

从兼容层 stub 变为真正的 session selector：

```typescript
export function useSessionMessages(sessionKey?: string): ChatMessage[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.messages ?? []) : [];
  });
}

export function useSessionStreaming(sessionKey?: string): {
  isStreaming: boolean;
  runId: string | null;
} {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    const session = key ? s.sessions.get(key) : undefined;
    return {
      isStreaming: session?.isStreaming ?? false,
      runId: session?.streamingRunId ?? null,
    };
  });
}

// useSessionToolProgress, useSessionApproval, useSessionA2UI 等同理
```

### Session 切换 UX

```
用户点击 session X:
  1. setActiveSession(X)
  2. sessions.has(X)?
     YES → 立即显示缓存数据（零延迟）
     NO  → ensureSession(X)，SSE 自动填充
  3. SSE 连接不中断，持续为所有 session 路由事件
```

核心 UX 提升：切换 session 不再丢失消息，后台 session 的流式进度也会保留。

### LRU 淘汰

```typescript
MAX_CACHED_SESSIONS = 20;

// ensureSession 内部触发
if (sessions.size >= MAX_CACHED_SESSIONS) {
  // 按 lastAccessedAt 排序，淘汰最旧的非活跃、非流式 session
  // sessionMetas 不受影响（侧边栏始终显示全量）
}
```

### 渲染组件影响清单

| 组件              | 当前用法                        | 变更                                |
| ----------------- | ------------------------------- | ----------------------------------- |
| MessageBubble     | `msg.content` (string)          | `getTextContent(msg)`               |
| ThinkingAccordion | `msg.thinking` (string)         | `getThinkingContent(msg)`           |
| ToolUseCard       | `msg.toolUse[]`                 | `getToolUseBlocks(msg)`             |
| detectArtifact    | 接收 content string             | 接收 `getTextContent(msg)`          |
| RunStatusBar      | `msg.runMetadata`               | 不变（字段仍在 ChatMessage 上）     |
| ToolProgressBar   | `useSessionToolProgress()`      | 从 stub → 真实 selector             |
| CanvasPanel       | `useSessionA2UI()`              | 从 stub → 真实 selector             |
| SessionSidebar    | `useChatStore(s => s.sessions)` | `useChatStore(s => s.sessionMetas)` |

### 测试修复预期

预期解决 287 / 301 个测试 TS 错误：

| 测试文件                         | 错误数 | 修复阶段                 |
| -------------------------------- | ------ | ------------------------ |
| dispatcher.test.ts               | 85     | 阶段 1                   |
| tool-progress-dispatcher.test.ts | 9      | 阶段 1                   |
| chat-store.test.ts               | 113    | 阶段 2                   |
| chat-hooks.test.ts               | 69     | 阶段 2                   |
| a2ui-store-actions.test.ts       | 11     | 阶段 2                   |
| models.test.ts                   | 14     | 单独修复（与本重构无关） |

---

## 阶段 3：ModelsPanel Tab 导航

### 目标

将 ModelsPanel 从固定两列布局（ModelCatalog + ProviderConfig）改为 4-tab 布局，整合已有但未组装的 Fallbacks 和 Usage 组件。

### Tab 结构

```
┌───────────────────────────────────────────────────┐
│  [Catalog]  [Provider Config]  [Fallbacks]  [Usage] │
├───────────────────────────────────────────────────┤
│                                                   │
│   当前 tab 内容                                    │
│                                                   │
└───────────────────────────────────────────────────┘
```

| Tab             | 组件                                                                          | Store 方法                                 |
| --------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| Catalog         | `CatalogTab` → ModelCatalog, ProviderList, ModelDetail                        | `fetchModels`                              |
| Provider Config | `ProviderConfigTab` → ProviderConfig, AuthHealthCard, ProbeButton, ConfigForm | `fetchProviderConfig`, `fetchAuthOverview` |
| Fallbacks       | `FallbacksTab` → FallbackChain, PrimaryModelCard, ModelCard, AddModelSelect   | `fetchFallbacks`                           |
| Usage           | `UsageTab` → SummaryCards, CostTrendChart, ProviderQuotaGrid                  | `fetchUsageSummary`                        |

### 实现要点

- 使用 shadcn Tabs 组件（已在项目中可用）
- 每个 tab 内部管理自己的 `useEffect` 数据加载（lazy load on first visit）
- 默认选中 Catalog tab
- 不使用 `unmountOnExit`（切换 tab 时保持已加载的数据）

### 文件变更

- **修改**：`ModelsPanel.tsx`（~42 行 → ~50 行，换为 Tabs 容器）
- **修改**：`zh.json` / `en.json`（添加 tab label keys）
- **不变**：4 个 Tab 组件 + 所有子组件（已存在）

### 独立性

阶段 3 不依赖阶段 1 和 2。改动仅限 `models/` 目录 + i18n。

---

## 改动清单

### 阶段 1 文件（2 个）

| 操作 | 文件                                                 |
| ---- | ---------------------------------------------------- |
| 新建 | `dashboard/src/stores/chat-dispatchers.ts`           |
| 修改 | `dashboard/src/components/panels/chat/useChatSSE.ts` |

### 阶段 2 文件（~12 个）

| 操作     | 文件                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 修改     | `dashboard/src/stores/chat-types.ts` — 添加辅助函数                                 |
| 重写     | `dashboard/src/stores/chat.ts` — Map-based store                                    |
| 修改     | `dashboard/src/stores/chat-hooks.ts` — 真实 session selector                        |
| 修改     | `dashboard/src/stores/chat-dispatchers.ts` — session-scoped API                     |
| 修改     | `dashboard/src/components/panels/chat/useChatSSE.ts` — per-session tracker          |
| 修改     | `dashboard/src/components/panels/chat/MessageList.tsx` — ContentBlock 渲染          |
| 修改     | `dashboard/src/components/panels/chat/MessageInput.tsx` — ContentBlock 构造         |
| 修改     | `dashboard/src/components/panels/chat/SessionSidebar.tsx` — sessionMetas            |
| 修改     | `dashboard/src/components/panels/chat/ChatPanel.tsx` — session key 传递             |
| 修改     | `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts` — getTextContent |
| 可能修改 | 其他消费 `ChatMessage.content` 或 `msg.thinking` 或 `msg.toolUse` 的组件            |

### 阶段 3 文件（3 个）

| 操作 | 文件                                                     |
| ---- | -------------------------------------------------------- |
| 修改 | `dashboard/src/components/panels/models/ModelsPanel.tsx` |
| 修改 | `dashboard/src/i18n/zh.json`                             |
| 修改 | `dashboard/src/i18n/en.json`                             |

---

## 执行顺序

```
阶段 1: Dispatcher 抽取
  → 纯重构，行为等价，零功能变化
  → 验证：dispatcher.test.ts + tool-progress-dispatcher.test.ts 通过
  → commit

阶段 2: Session 隔离 + ContentBlock
  → 在干净的 dispatcher 上做 session 路由
  → 验证：chat-store.test.ts + chat-hooks.test.ts + a2ui-store-actions.test.ts 通过
  → 验证：tsc --noEmit 零错误
  → 验证：浏览器功能回归（chat 基础、session 切换、tool 渲染）
  → commit

阶段 3: ModelsPanel Tabs
  → 独立于阶段 1/2
  → 验证：Models 面板 4 个 tab 可切换、数据正确加载
  → commit
```

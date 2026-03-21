# A2UI Canvas + 右侧面板统一架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 openclaw-deck 中实现 A2UI Canvas 渲染（iframe + postMessage bridge）、统一右侧面板（Canvas + Artifact）、Artifact 检测增强、消息 Block 过滤/折叠

**Architecture:** iframe 嵌入 Gateway 渲染引擎，A2UIBridge 通过 postMessage 双向通信，RightPanel 统一容器管理 Canvas 和 Artifact 面板的互斥显示。Gateway 仅需一行改动注入 sessionKey。

**Tech Stack:** React 18, Zustand, next-intl, CSS variables (Tailwind), postMessage API

**Spec:** `docs/superpowers/specs/2026-03-21-a2ui-canvas-design.md`

**Skills:** `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development`

---

## File Structure

### Group A: A2UI Canvas + RightPanel（核心，串行）

| Action | File                                                                         | Responsibility                                                             |
| ------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Modify | `src/gateway/server-methods/nodes.handlers.invoke-result.ts`                 | 注入 sessionKey 到 A2UI 广播                                               |
| Modify | `dashboard/server/event-bus.ts`                                              | DeckEventType 新增 `"a2ui"`                                                |
| Modify | `dashboard/server/runtime.ts`                                                | VALID_DECK_EVENTS 新增 `"a2ui"`                                            |
| Create | `dashboard/src/app/api/canvas/host/route.ts`                                 | Deck Server 代理端点（注入 bridge 脚本）                                   |
| Modify | `dashboard/src/stores/chat-types.ts`                                         | A2UIState 扩展 + A2UIEvent 类型                                            |
| Modify | `dashboard/src/stores/chat.ts`                                               | 新增 appendA2UIEvent / updateA2UIBridgeStatus / updateA2UISurfaces actions |
| Modify | `dashboard/src/stores/chat-hooks.ts`                                         | 新增 useSessionA2UIEvents / useSessionA2UIBridgeStatus hooks               |
| Modify | `dashboard/src/components/panels/chat/useChatSSE.ts`                         | dispatchA2UIEvent payload 修正 + eventLog 追加                             |
| Create | `dashboard/src/components/panels/chat/a2ui-bridge.ts`                        | A2UIBridge postMessage 双向通信层                                          |
| Create | `dashboard/src/components/panels/chat/a2ui-message-format.ts`                | sanitizeTagValue / extractActionName / formatA2UIAgentMessage              |
| Create | `dashboard/src/components/panels/chat/RightPanel.tsx`                        | 统一右侧面板容器（抽拉式 + 分割线）                                        |
| Create | `dashboard/src/components/panels/chat/CanvasPanel.tsx`                       | A2UI Canvas 渲染（iframe + 状态机）                                        |
| Create | `dashboard/src/components/panels/chat/CanvasDebugPanel.tsx`                  | Debug 面板（Messages + Tree tab）                                          |
| Modify | `dashboard/src/components/panels/chat/ChatPanel.tsx`                         | 集成 RightPanel 替换独立 ArtifactPanel                                     |
| Modify | `dashboard/src/i18n/zh.json`                                                 | Canvas + Debug i18n keys                                                   |
| Modify | `dashboard/src/i18n/en.json`                                                 | Canvas + Debug i18n keys                                                   |
| Create | `dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts`         | A2UIBridge 单元测试                                                        |
| Create | `dashboard/src/components/panels/chat/__tests__/a2ui-message-format.test.ts` | 消息格式化单元测试                                                         |
| Create | `dashboard/src/stores/__tests__/a2ui-store-actions.test.ts`                  | Store actions 单元测试                                                     |

### Group B: Artifact 增强（依赖 Group A 的 RightPanel）

| Action | File                                                                                       | Responsibility                          |
| ------ | ------------------------------------------------------------------------------------------ | --------------------------------------- |
| Modify | `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`                         | 新增 JSON/CSV/Markdown/Code 检测        |
| Modify | `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`                         | 重构到 RightPanel 容器中 + 新渲染器路由 |
| Create | `dashboard/src/components/panels/chat/artifacts/JsonTree.tsx`                              | JSON 可折叠树查看器                     |
| Create | `dashboard/src/components/panels/chat/artifacts/TableViewer.tsx`                           | CSV 表格渲染器                          |
| Create | `dashboard/src/components/panels/chat/artifacts/CodeViewer.tsx`                            | 代码语法高亮查看器                      |
| Create | `dashboard/src/components/panels/chat/artifacts/MarkdownViewer.tsx`                        | Markdown 渲染查看器                     |
| Create | `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts` | 增强检测测试                            |

### Group C: Block 过滤/折叠（完全独立）

| Action | File                                                                  | Responsibility                        |
| ------ | --------------------------------------------------------------------- | ------------------------------------- |
| Create | `dashboard/src/components/panels/chat/BlockFilterBar.tsx`             | 过滤工具栏组件                        |
| Create | `dashboard/src/stores/chat-preferences.ts`                            | ChatBlockPreferences 持久化           |
| Modify | `dashboard/src/components/panels/chat/MessageList.tsx`                | 集成 BlockFilterBar + 过滤逻辑        |
| Modify | `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`      | 改为 `<details>` 折叠，error 默认展开 |
| Modify | `dashboard/src/i18n/zh.json`                                          | Block 过滤 i18n keys                  |
| Modify | `dashboard/src/i18n/en.json`                                          | Block 过滤 i18n keys                  |
| Create | `dashboard/src/components/panels/chat/__tests__/block-filter.test.ts` | 过滤逻辑单元测试                      |

## 文件交叉矩阵

| 文件                 | Group A | Group B | Group C |
| -------------------- | :-----: | :-----: | :-----: |
| `chat-types.ts`      |   ✏️    |         |         |
| `chat.ts`            |   ✏️    |         |         |
| `chat-hooks.ts`      |   ✏️    |         |         |
| `useChatSSE.ts`      |   ✏️    |         |         |
| `ChatPanel.tsx`      |   ✏️    |         |         |
| `MessageList.tsx`    |         |         |   ✏️    |
| `ToolResultCard.tsx` |         |         |   ✏️    |
| `detectArtifact.ts`  |         |   ✏️    |         |
| `ArtifactPanel.tsx`  |         |   ✏️    |         |
| `zh.json`            |   ✏️    |         |   ✏️    |
| `en.json`            |   ✏️    |         |   ✏️    |

**交叉分析：**

- Group A 与 Group C 共享 `zh.json` / `en.json`，但修改不同 key 段，**不冲突**
- Group B 依赖 Group A 的 `RightPanel.tsx` 容器
- Group C 与 A/B **零文件冲突**，可完全并行

---

## Task 0: 共享接口定义（串行前置）

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-hooks.ts`
- Test: `dashboard/src/stores/__tests__/a2ui-store-actions.test.ts`

- [ ] **Step 1: 扩展 A2UIState 和新增 A2UIEvent 类型**

在 `dashboard/src/stores/chat-types.ts` 中，在现有 `A2UIState` 后追加新字段和类型：

```typescript
// 在现有 A2UIState 接口中新增可选字段
export interface A2UIState {
  url: string;
  visible: boolean;
  bridgeStatus?: "connecting" | "ready" | "error";
  eventLog?: A2UIEvent[];
  surfaces?: string[];
}

export interface A2UIEvent {
  timestamp: number;
  direction: "inbound" | "outbound";
  action: string;
  summary: string;
  raw: unknown;
}

export const MAX_A2UI_EVENT_LOG = 200;
```

- [ ] **Step 2: 新增 store actions**

在 `dashboard/src/stores/chat.ts` 的 ChatStore interface 和 create() 中新增：

```typescript
// Interface
appendA2UIEvent: (sessionKey: string, event: A2UIEvent) => void;
updateA2UIBridgeStatus: (sessionKey: string, status: "connecting" | "ready" | "error") => void;
updateA2UISurfaces: (sessionKey: string, surfaces: string[]) => void;

// Implementation
appendA2UIEvent(sessionKey: string, event: A2UIEvent) {
  const { sessions } = get();
  set({
    sessions: updateSession(sessions, sessionKey, (s) => {
      const log = [...(s.a2uiState?.eventLog ?? []), event];
      if (log.length > MAX_A2UI_EVENT_LOG) log.splice(0, log.length - MAX_A2UI_EVENT_LOG);
      return {
        ...s,
        a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), eventLog: log },
      };
    }),
  });
},
updateA2UIBridgeStatus(sessionKey: string, status: "connecting" | "ready" | "error") {
  const { sessions } = get();
  set({
    sessions: updateSession(sessions, sessionKey, (s) => ({
      ...s,
      a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), bridgeStatus: status },
    })),
  });
},
updateA2UISurfaces(sessionKey: string, surfaces: string[]) {
  const { sessions } = get();
  set({
    sessions: updateSession(sessions, sessionKey, (s) => ({
      ...s,
      a2uiState: { ...(s.a2uiState ?? { url: "", visible: false }), surfaces },
    })),
  });
},
```

- [ ] **Step 3: 新增 hooks**

在 `dashboard/src/stores/chat-hooks.ts` 中新增：

```typescript
export function useSessionA2UIEvents(sessionKey?: string): A2UIEvent[] {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? (s.sessions.get(key)?.a2uiState?.eventLog ?? []) : [];
  });
}

export function useSessionA2UIBridgeStatus(
  sessionKey?: string,
): "connecting" | "ready" | "error" | undefined {
  return useChatStore((s) => {
    const key = sessionKey ?? s.activeSessionKey;
    return key ? s.sessions.get(key)?.a2uiState?.bridgeStatus : undefined;
  });
}
```

- [ ] **Step 4: 编写测试**

创建 `dashboard/src/stores/__tests__/a2ui-store-actions.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../chat";

describe("A2UI store actions", () => {
  beforeEach(() => useChatStore.getState().ensureSession("s1"));

  it("appendA2UIEvent adds event to log", () => {
    useChatStore.getState().appendA2UIEvent("s1", {
      timestamp: 1,
      direction: "inbound",
      action: "surfaceUpdate",
      summary: "test",
      raw: {},
    });
    const log = useChatStore.getState().sessions.get("s1")?.a2uiState?.eventLog;
    expect(log).toHaveLength(1);
    expect(log![0].action).toBe("surfaceUpdate");
  });

  it("appendA2UIEvent respects ring buffer limit", () => {
    for (let i = 0; i < 210; i++) {
      useChatStore.getState().appendA2UIEvent("s1", {
        timestamp: i,
        direction: "inbound",
        action: "test",
        summary: `e${i}`,
        raw: {},
      });
    }
    const log = useChatStore.getState().sessions.get("s1")?.a2uiState?.eventLog;
    expect(log).toHaveLength(200);
    expect(log![0].summary).toBe("e10");
  });

  it("updateA2UIBridgeStatus sets status", () => {
    useChatStore.getState().updateA2UIBridgeStatus("s1", "ready");
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.bridgeStatus).toBe("ready");
  });

  it("updateA2UISurfaces sets surfaces list", () => {
    useChatStore.getState().updateA2UISurfaces("s1", ["main", "overlay"]);
    expect(useChatStore.getState().sessions.get("s1")?.a2uiState?.surfaces).toEqual([
      "main",
      "overlay",
    ]);
  });
});
```

- [ ] **Step 5: 运行测试**

Run: `cd dashboard && npx vitest run src/stores/__tests__/a2ui-store-actions.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/chat-types.ts dashboard/src/stores/chat.ts dashboard/src/stores/chat-hooks.ts dashboard/src/stores/__tests__/a2ui-store-actions.test.ts
git commit -m "[enhanced] feat(deck): extend A2UIState with eventLog, bridgeStatus, surfaces"
```

---

## Task 1: Gateway sessionKey 注入 + Deck Server 事件注册（Group A）

**Files:**

- Modify: `src/gateway/server-methods/nodes.handlers.invoke-result.ts:76-78`
- Modify: `dashboard/server/event-bus.ts:16-34`
- Modify: `dashboard/server/runtime.ts:74-92`

- [ ] **Step 1: 注入 sessionKey 到 Gateway A2UI 广播**

在 `src/gateway/server-methods/nodes.handlers.invoke-result.ts` 中修改 broadcast 调用（第 76-78 行）：

```typescript
// Before:
const scopedEvent =
  event && typeof event === "object" ? { ...event, __invokeId: p.id, __nodeId: p.nodeId } : event;

// After:
const scopedEvent =
  event && typeof event === "object"
    ? { ...event, __invokeId: p.id, __nodeId: p.nodeId, sessionKey: context.sessionKey }
    : event;
```

- [ ] **Step 2: DeckEventType 新增 `"a2ui"`**

在 `dashboard/server/event-bus.ts` 的 `DeckEventType` union 中，在 `"cron.run.complete"` 后追加：

```typescript
| "cron.run.complete"
// P4 additions (A2UI Canvas)
| "a2ui";
```

- [ ] **Step 3: VALID_DECK_EVENTS 新增 `"a2ui"`**

在 `dashboard/server/runtime.ts` 的 `VALID_DECK_EVENTS` set 中追加：

```typescript
"cron.run.complete",
// P4 additions (A2UI Canvas)
"a2ui",
```

- [ ] **Step 4: 运行类型检查**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add src/gateway/server-methods/nodes.handlers.invoke-result.ts dashboard/server/event-bus.ts dashboard/server/runtime.ts
git commit -m "[enhanced] feat(deck): register a2ui event type + inject sessionKey in Gateway broadcast"
```

---

## Task 2: dispatchA2UIEvent 修正 + A2UIBridge + 消息格式化（Group A）

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Create: `dashboard/src/components/panels/chat/a2ui-bridge.ts`
- Create: `dashboard/src/components/panels/chat/a2ui-message-format.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/a2ui-message-format.test.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts`

- [ ] **Step 1: 编写 a2ui-message-format 测试**

创建 `dashboard/src/components/panels/chat/__tests__/a2ui-message-format.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  sanitizeTagValue,
  extractActionName,
  formatA2UIAgentMessage,
} from "../a2ui-message-format";

describe("sanitizeTagValue", () => {
  it("replaces spaces with underscores", () => {
    expect(sanitizeTagValue("Hello World")).toBe("Hello_World");
  });
  it("replaces non-alphanumeric chars", () => {
    expect(sanitizeTagValue("test<>!")).toBe("test___");
  });
  it("returns dash for empty/whitespace", () => {
    expect(sanitizeTagValue("  ")).toBe("-");
  });
  it("allows dots, dashes, colons", () => {
    expect(sanitizeTagValue("macOS_26.2")).toBe("macOS_26.2");
  });
});

describe("extractActionName", () => {
  it("extracts from name field", () => {
    expect(extractActionName({ name: "Hello" })).toBe("Hello");
  });
  it("falls back to action field", () => {
    expect(extractActionName({ action: "Wave" })).toBe("Wave");
  });
  it("returns null for empty", () => {
    expect(extractActionName({ name: " " })).toBeNull();
  });
});

describe("formatA2UIAgentMessage", () => {
  it("formats matching native client output", () => {
    const msg = formatA2UIAgentMessage({
      actionName: "Buy",
      sessionKey: "main",
      surfaceId: "main",
      sourceComponentId: "btn1",
    });
    expect(msg).toBe(
      "CANVAS_A2UI action=Buy session=main surface=main component=btn1 host=Deck instance=deck default=update_canvas",
    );
  });
  it("includes context when provided", () => {
    const msg = formatA2UIAgentMessage({
      actionName: "Buy",
      sessionKey: "main",
      surfaceId: "main",
      sourceComponentId: "btn1",
      contextJson: '{"t":123}',
    });
    expect(msg).toContain('ctx={"t":123}');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/a2ui-message-format.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 a2ui-message-format.ts**

创建 `dashboard/src/components/panels/chat/a2ui-message-format.ts`：

```typescript
/**
 * A2UI agent message formatting utilities.
 * Ported from OpenClawCanvasA2UIAction (Swift/Kotlin) for Deck parity.
 */

export function sanitizeTagValue(value: string): string {
  const trimmed = value.trim() || "-";
  return trimmed.replace(/ /g, "_").replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

export function extractActionName(userAction: Record<string, unknown>): string | null {
  for (const key of ["name", "action"]) {
    const val = typeof userAction[key] === "string" ? (userAction[key] as string).trim() : "";
    if (val) return val;
  }
  return null;
}

export function formatA2UIAgentMessage(opts: {
  actionName: string;
  sessionKey: string;
  surfaceId: string;
  sourceComponentId: string;
  contextJson?: string;
}): string {
  const ctx = opts.contextJson ? ` ctx=${opts.contextJson}` : "";
  return [
    "CANVAS_A2UI",
    `action=${sanitizeTagValue(opts.actionName)}`,
    `session=${sanitizeTagValue(opts.sessionKey)}`,
    `surface=${sanitizeTagValue(opts.surfaceId)}`,
    `component=${sanitizeTagValue(opts.sourceComponentId)}`,
    "host=Deck",
    `instance=deck${ctx}`,
    "default=update_canvas",
  ].join(" ");
}

/** Extract the A2UI action type from a Gateway broadcast payload. */
export function extractA2UIActionType(payload: Record<string, unknown>): string {
  for (const key of ["surfaceUpdate", "beginRendering", "dataModelUpdate", "deleteSurface"]) {
    if (key in payload) return key;
  }
  return "unknown";
}

/** Generate a human-readable summary of an A2UI event payload. */
export function summarizeA2UIEvent(payload: Record<string, unknown>): string {
  const action = extractA2UIActionType(payload);
  if (action === "surfaceUpdate") {
    const update = payload.surfaceUpdate as Record<string, unknown> | undefined;
    const surfaceId = (update?.surfaceId as string) ?? "?";
    const components = Array.isArray(update?.components) ? update.components.length : 0;
    return `surface=${surfaceId}, ${components} components`;
  }
  if (action === "beginRendering") {
    const data = payload.beginRendering as Record<string, unknown> | undefined;
    return `surface=${(data?.surfaceId as string) ?? "?"}, root=${(data?.root as string) ?? "?"}`;
  }
  if (action === "deleteSurface") {
    const data = payload.deleteSurface as Record<string, unknown> | undefined;
    return `surface=${(data?.surfaceId as string) ?? "?"}`;
  }
  return JSON.stringify(payload).slice(0, 80);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/a2ui-message-format.test.ts`
Expected: PASS

- [ ] **Step 5: 修正 dispatchA2UIEvent**

在 `dashboard/src/components/panels/chat/useChatSSE.ts` 中修改 `A2UIEventPayload` 类型和 `dispatchA2UIEvent` 函数：

```typescript
// 替换现有 A2UIEventPayload
export type A2UIEventPayload = {
  sessionKey?: string;
  __invokeId?: string;
  __nodeId?: string;
  surfaceUpdate?: unknown;
  beginRendering?: unknown;
  dataModelUpdate?: unknown;
  deleteSurface?: unknown;
};

// 替换现有 dispatchA2UIEvent
export function dispatchA2UIEvent(payload: A2UIEventPayload): void {
  const sessionKey = payload.sessionKey ?? useChatStore.getState().activeSessionKey;
  if (!sessionKey) return;

  useChatStore.getState().ensureSession(sessionKey);

  const event: A2UIEvent = {
    timestamp: Date.now(),
    direction: "inbound",
    action: extractA2UIActionType(payload as Record<string, unknown>),
    summary: summarizeA2UIEvent(payload as Record<string, unknown>),
    raw: payload,
  };

  useChatStore.getState().appendA2UIEvent(sessionKey, event);

  const current = useChatStore.getState().sessions.get(sessionKey)?.a2uiState;
  if (!current?.visible) {
    useChatStore.getState().setA2UIState(sessionKey, {
      url: current?.url ?? "",
      visible: true,
    });
  }
}
```

新增 import：`import type { A2UIEvent } from "@/stores/chat-types";` 和 `import { extractA2UIActionType, summarizeA2UIEvent } from "./a2ui-message-format";`

- [ ] **Step 6: 实现 A2UIBridge**

创建 `dashboard/src/components/panels/chat/a2ui-bridge.ts`：

```typescript
"use client";

import type { A2UIEvent } from "@/stores/chat-types";
import { extractActionName, formatA2UIAgentMessage } from "./a2ui-message-format";

export interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

export interface A2UIBridgeCallbacks {
  onReady: () => void;
  onUserAction: (action: UserAction) => void;
  onSurfacesChanged: (surfaces: string[]) => void;
  onTreeData?: (tree: unknown) => void;
}

export class A2UIBridge {
  private iframe: HTMLIFrameElement | null = null;
  private listener: ((e: MessageEvent) => void) | null = null;
  private iframeOrigin = "";

  constructor(private callbacks: A2UIBridgeCallbacks) {}

  attach(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    try {
      this.iframeOrigin = new URL(iframe.src).origin;
    } catch {
      this.iframeOrigin = window.location.origin;
    }
    this.listener = (e: MessageEvent) => {
      if (e.origin !== this.iframeOrigin) return;
      switch (e.data?.type) {
        case "a2ui:ready":
          this.callbacks.onReady();
          break;
        case "a2ui:action":
          if (e.data.userAction) this.callbacks.onUserAction(e.data.userAction as UserAction);
          break;
        case "a2ui:surfaces-changed":
          if (Array.isArray(e.data.surfaces)) this.callbacks.onSurfacesChanged(e.data.surfaces);
          break;
        case "a2ui:tree-data":
          this.callbacks.onTreeData?.(e.data.tree);
          break;
      }
    };
    window.addEventListener("message", this.listener);
  }

  detach(): void {
    if (this.listener) {
      window.removeEventListener("message", this.listener);
      this.listener = null;
    }
    this.iframe = null;
  }

  pushMessages(messages: unknown[]): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:push", messages }, this.iframeOrigin);
  }

  reset(): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:reset" }, this.iframeOrigin);
  }

  sendActionStatus(id: string, ok: boolean, error?: string): void {
    this.iframe?.contentWindow?.postMessage(
      { type: "a2ui:action-status", id, ok, error: error ?? "" },
      this.iframeOrigin,
    );
  }

  requestTree(): void {
    this.iframe?.contentWindow?.postMessage({ type: "a2ui:get-tree" }, this.iframeOrigin);
  }
}

/**
 * Send a userAction as a chat message to the agent.
 * Matches the format used by iOS/Android/macOS native clients.
 */
export async function sendUserActionToAgent(
  action: UserAction,
  sessionKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const name = extractActionName(action as unknown as Record<string, unknown>);
  if (!name) return { ok: false, error: "no action name" };

  const message = formatA2UIAgentMessage({
    actionName: name,
    sessionKey,
    surfaceId: action.surfaceId ?? "main",
    sourceComponentId: action.sourceComponentId ?? "-",
    contextJson: action.context ? JSON.stringify(action.context) : undefined,
  });

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionKey }),
    });
    return { ok: res.ok };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
```

- [ ] **Step 7: 编写 A2UIBridge 测试**

创建 `dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { A2UIBridge } from "../a2ui-bridge";

describe("A2UIBridge", () => {
  let bridge: A2UIBridge;
  const onReady = vi.fn();
  const onUserAction = vi.fn();
  const onSurfacesChanged = vi.fn();

  beforeEach(() => {
    bridge = new A2UIBridge({ onReady, onUserAction, onSurfacesChanged });
  });

  afterEach(() => {
    bridge.detach();
    vi.clearAllMocks();
  });

  it("calls onReady when receiving a2ui:ready message", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "a2ui:ready" },
        origin: "http://localhost:18789",
      }),
    );
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("ignores messages from wrong origin", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "a2ui:ready" },
        origin: "http://evil.com",
      }),
    );
    expect(onReady).not.toHaveBeenCalled();
  });

  it("extracts userAction from a2ui:action message", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    const action = {
      id: "a1",
      name: "Buy",
      surfaceId: "main",
      sourceComponentId: "btn1",
      timestamp: "2026-03-21",
    };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "a2ui:action", userAction: action },
        origin: "http://localhost:18789",
      }),
    );
    expect(onUserAction).toHaveBeenCalledWith(action);
  });

  it("detach removes listener", () => {
    const iframe = { src: "http://localhost:18789/__openclaw__/a2ui/" } as HTMLIFrameElement;
    bridge.attach(iframe);
    bridge.detach();
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "a2ui:ready" },
        origin: "http://localhost:18789",
      }),
    );
    expect(onReady).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: 运行测试**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/a2ui-bridge.test.ts src/components/panels/chat/__tests__/a2ui-message-format.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/components/panels/chat/a2ui-message-format.ts dashboard/src/components/panels/chat/a2ui-bridge.ts dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/components/panels/chat/__tests__/a2ui-message-format.test.ts dashboard/src/components/panels/chat/__tests__/a2ui-bridge.test.ts
git commit -m "[enhanced] feat(deck): implement A2UIBridge + message formatting + dispatchA2UIEvent fix"
```

---

## Task 3: Canvas Host 代理端点（Group A）

**Files:**

- Create: `dashboard/src/app/api/canvas/host/route.ts`

- [ ] **Step 1: 实现代理端点**

创建 `dashboard/src/app/api/canvas/host/route.ts`：

```typescript
import { NextResponse } from "next/server";
import { getGatewayBaseUrl } from "@/lib/gateway";

const BRIDGE_SCRIPT = `
<script>
(() => {
  const DECK_ORIGIN = window.location.ancestorOrigins?.[0] ?? "*";
  window.addEventListener("message", (e) => {
    if (DECK_ORIGIN !== "*" && e.origin !== DECK_ORIGIN) return;
    if (e.data?.type === "a2ui:push") {
      globalThis.openclawA2UI?.applyMessages(e.data.messages);
      window.parent.postMessage(
        { type: "a2ui:surfaces-changed", surfaces: globalThis.openclawA2UI?.getSurfaces?.() ?? [] },
        DECK_ORIGIN,
      );
    } else if (e.data?.type === "a2ui:reset") {
      globalThis.openclawA2UI?.reset();
    } else if (e.data?.type === "a2ui:action-status") {
      window.dispatchEvent(new CustomEvent("openclaw:a2ui-action-status", {
        detail: { id: e.data.id, ok: e.data.ok, error: e.data.error },
      }));
    } else if (e.data?.type === "a2ui:get-tree") {
      const host = document.querySelector("openclaw-a2ui-host");
      let tree = null;
      try {
        const surfaces = host?.shadowRoot?.querySelector("#surfaces");
        if (surfaces) {
          tree = Array.from(surfaces.querySelectorAll("a2ui-surface")).map((el) => ({
            surfaceId: el.surfaceId ?? "unknown",
            componentCount: el.shadowRoot?.querySelectorAll("[data-component-id]")?.length ?? 0,
          }));
        }
      } catch {}
      window.parent.postMessage({ type: "a2ui:tree-data", tree }, DECK_ORIGIN);
    }
  });
  window.openclawCanvasA2UIAction = {
    postMessage: (payload) => {
      const parsed = JSON.parse(payload);
      window.parent.postMessage(
        { type: "a2ui:action", userAction: parsed.userAction ?? parsed },
        DECK_ORIGIN,
      );
    },
  };
  window.parent.postMessage({ type: "a2ui:ready" }, DECK_ORIGIN);
})();
</script>`;

export async function GET() {
  try {
    const base = getGatewayBaseUrl();
    const res = await fetch(\`\${base}/__openclaw__/a2ui/\`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Gateway canvas host unavailable" }, { status: 502 });
    }
    let html = await res.text();
    // Inject bridge script before </body>
    const idx = html.toLowerCase().lastIndexOf("</body>");
    if (idx >= 0) {
      html = html.slice(0, idx) + BRIDGE_SCRIPT + html.slice(idx);
    } else {
      html += BRIDGE_SCRIPT;
    }
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch canvas host" }, { status: 502 });
  }
}
```

注意：需要确认 `getGatewayBaseUrl` 的实际导入路径——如果不存在，在 task 中查找 Gateway URL 的获取方式并对应调整。

- [ ] **Step 2: 验证端点**

Run: `cd dashboard && npm run dev`（手动验证 `http://localhost:3000/api/canvas/host` 返回 HTML）

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/api/canvas/host/route.ts
git commit -m "[enhanced] feat(deck): add canvas host proxy endpoint with bridge script injection"
```

---

## Task 4: RightPanel 统一容器 + CanvasPanel + CanvasDebugPanel（Group A）

**Files:**

- Create: `dashboard/src/components/panels/chat/RightPanel.tsx`
- Create: `dashboard/src/components/panels/chat/CanvasPanel.tsx`
- Create: `dashboard/src/components/panels/chat/CanvasDebugPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

这是最大的 task，包含 UI 组件实现。由于涉及大量 JSX，此处列出组件骨架和关键逻辑，实现时需调用 `frontend-design` 和 `ui-ux-pro-max` skill 确保 UI 质量。

- [ ] **Step 1: 添加 i18n keys（Canvas + Debug）**

在 `dashboard/src/i18n/zh.json` 的 `"chat"` 命名空间追加：

```json
"canvasTitle": "Canvas",
"canvasLoading": "加载 Canvas...",
"canvasEmpty": "等待 Agent 推送内容...",
"canvasError": "Canvas 加载失败",
"canvasRetry": "重试",
"canvasCollapse": "收起",
"canvasExpand": "展开",
"debugTitle": "调试",
"debugMessages": "消息",
"debugTree": "组件树",
"debugClear": "清除",
"debugEvents": "{count} 个事件",
"debugSurfaces": "{count} 个 Surface",
"debugNodes": "{count} 个节点",
"debugTreeUnavailable": "组件树不可用"
```

在 `dashboard/src/i18n/en.json` 的 `"chat"` 命名空间追加对应英文版。

- [ ] **Step 2: 实现 RightPanel.tsx**

创建 `dashboard/src/components/panels/chat/RightPanel.tsx`：

骨架结构：

- 接收 `mode: "hidden" | "canvas" | "artifact"` prop
- 抽拉式动画（CSS transition on width）
- 可拖拽分割线（mousedown → mousemove tracking → localStorage 保存宽度）
- 收起态显示竖条 + ‹ 展开按钮
- 响应式：≥1024px 左右分栏 / 768-1023px 叠加层 / <768px 全屏
- 内部切换渲染 CanvasPanel 或 ArtifactPanel

- [ ] **Step 3: 实现 CanvasPanel.tsx**

创建 `dashboard/src/components/panels/chat/CanvasPanel.tsx`：

骨架结构：

- CanvasHeader：surface 名称 + Debug 按钮 + 收起按钮
- CanvasViewport：`<iframe src="/api/canvas/host">` + loading 骨架屏 / error 重试 / empty 引导
- 状态机：hidden → loading → ready → error
- useEffect：创建 A2UIBridge，attach 到 iframe ref
- useEffect：监听 store eventLog 变化，pushMessages 到 iframe
- useEffect：5s 加载超时，3s bridge ready 超时
- Debug 按钮切换 CanvasDebugPanel 显示

- [ ] **Step 4: 实现 CanvasDebugPanel.tsx**

创建 `dashboard/src/components/panels/chat/CanvasDebugPanel.tsx`：

骨架结构：

- Tab 切换：Messages / Tree
- Messages tab：列表渲染 `useSessionA2UIEvents()` 的每个 A2UIEvent（时间 + 方向 + action + summary），点击展开 raw JSON
- Tree tab：显示从 iframe 获取的 surfaces 数据，遍历失败时降级为 "组件树不可用"
- 右上角事件计数 + Clear 按钮

- [ ] **Step 5: 修改 ChatPanel.tsx**

将现有的独立 `ArtifactPanel` 引用替换为 `RightPanel`：

- 移除直接渲染的 `<ArtifactPanel>`
- 添加 `<RightPanel>` 包含 CanvasPanel 和 ArtifactPanel
- 连接 `ArtifactContext.onOpenArtifact` → RightPanel mode="artifact"
- 连接 `useSessionA2UI()` → RightPanel mode="canvas"

- [ ] **Step 6: 运行类型检查和构建**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/panels/chat/RightPanel.tsx dashboard/src/components/panels/chat/CanvasPanel.tsx dashboard/src/components/panels/chat/CanvasDebugPanel.tsx dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add RightPanel + CanvasPanel + CanvasDebugPanel"
```

---

## Task 5: Artifact 系统增强（Group B — 依赖 Task 4 RightPanel）

**Files:**

- Modify: `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`
- Modify: `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`
- Create: `dashboard/src/components/panels/chat/artifacts/JsonTree.tsx`
- Create: `dashboard/src/components/panels/chat/artifacts/TableViewer.tsx`
- Create: `dashboard/src/components/panels/chat/artifacts/CodeViewer.tsx`
- Create: `dashboard/src/components/panels/chat/artifacts/MarkdownViewer.tsx`
- Test: `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: 编写 detectArtifact 增强测试**

创建 `dashboard/src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { detectArtifact } from "../detectArtifact";

describe("detectArtifact enhanced", () => {
  // 现有类型
  it("detects HTML", () => {
    expect(detectArtifact("<!DOCTYPE html><html><body>hi</body></html>")?.language).toBe("html");
  });
  it("detects SVG", () => {
    expect(
      detectArtifact('<svg xmlns="http://www.w3.org/2000/svg" width="100"></svg>')?.language,
    ).toBe("svg");
  });

  // 新增类型
  it("detects JSON object", () => {
    const json = JSON.stringify({ name: "test", items: [1, 2, 3], nested: { a: 1 } });
    expect(detectArtifact(json)?.language).toBe("json");
  });
  it("ignores short JSON", () => {
    expect(detectArtifact('{"a":1}')).toBeNull();
  });
  it("detects CSV", () => {
    const csv = "name,age,city\nAlice,28,Beijing\nBob,32,Shanghai\nCharlie,25,Shenzhen";
    expect(detectArtifact(csv)?.language).toBe("csv");
  });
  it("detects Markdown", () => {
    const md = "# Title\n\nThis is a **bold** paragraph.\n\n- Item 1\n- Item 2";
    expect(detectArtifact(md)?.language).toBe("markdown");
  });
  it("keeps text type for backward compat", () => {
    // buildSrcdoc default case handles "text"
    expect(detectArtifact("short")).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd dashboard && npx vitest run src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
Expected: FAIL — 新类型未实现

- [ ] **Step 3: 扩展 detectArtifact.ts**

修改 `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`：

````typescript
export interface ArtifactInfo {
  id: string;
  title: string;
  language: "html" | "mermaid" | "svg" | "json" | "markdown" | "csv" | "code" | "text";
  content: string;
  codeLang?: string;
  source?: { toolName?: string; fileName?: string };
}

let artifactCounter = 0;

export function detectArtifact(
  content: string,
  toolContext?: { toolName?: string; filePath?: string },
): ArtifactInfo | null {
  if (typeof content !== "string" || content.length < 20) return null;

  // 1. HTML
  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return {
      id: `artifact-${++artifactCounter}`,
      title: titleMatch?.[1] ?? "HTML",
      language: "html",
      content,
    };
  }
  // 2. SVG
  if (content.trimStart().startsWith("<svg")) {
    return { id: `artifact-${++artifactCounter}`, title: "SVG", language: "svg", content };
  }
  // 3. Mermaid
  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Diagram",
      language: "mermaid",
      content: mermaidMatch[1],
    };
  }
  // 4. JSON
  if (content.length > 50) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        return { id: `artifact-${++artifactCounter}`, title: "JSON", language: "json", content };
      }
    } catch {
      /* not JSON */
    }
  }
  // 5. CSV
  if (isLikelyCSV(content)) {
    return { id: `artifact-${++artifactCounter}`, title: "Table", language: "csv", content };
  }
  // 6. Markdown
  if (isLikelyMarkdown(content)) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Document",
      language: "markdown",
      content,
    };
  }
  // 7. Code (contextual)
  if (toolContext?.toolName && /write|create|edit/i.test(toolContext.toolName)) {
    const ext = toolContext.filePath?.split(".").pop() ?? "";
    return {
      id: `artifact-${++artifactCounter}`,
      title: toolContext.filePath ?? "Code",
      language: "code",
      content,
      codeLang: ext,
      source: { toolName: toolContext.toolName, fileName: toolContext.filePath },
    };
  }
  return null;
}

function isLikelyCSV(content: string): boolean {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 3) return false;
  const counts = lines.slice(0, 5).map((l) => (l.match(/,/g) || []).length);
  return counts[0] > 0 && counts.every((c) => c === counts[0]);
}

function isLikelyMarkdown(content: string): boolean {
  const trimmed = content.trimStart();
  if (/^#{1,3}\s/.test(trimmed)) return true;
  const mdPatterns = /\*\*|__|\[.*\]\(.*\)|- \[[ x]\]/;
  return mdPatterns.test(content) && content.length > 80;
}
````

- [ ] **Step 4: 运行测试确认通过**

Run: `cd dashboard && npx vitest run src/components/panels/chat/artifacts/__tests__/detectArtifact-enhanced.test.ts`
Expected: PASS

- [ ] **Step 5: 实现 JsonTree.tsx / TableViewer.tsx / CodeViewer.tsx / MarkdownViewer.tsx**

四个新渲染组件，各自独立文件。实现时调用 `frontend-design` 和 `ui-ux-pro-max` skill 确保 UI 质量。

- [ ] **Step 6: 修改 ArtifactPanel.tsx**

重构 `buildSrcdoc` 函数为按 language 路由到对应渲染器：

```typescript
// 新增 language → 组件映射
switch (artifact.language) {
  case "html": case "svg": case "mermaid": case "text":
    return <iframe srcDoc={buildSrcdoc(artifact)} ... />;
  case "json":
    return <JsonTree content={artifact.content} />;
  case "csv":
    return <TableViewer content={artifact.content} />;
  case "markdown":
    return <MarkdownViewer content={artifact.content} />;
  case "code":
    return <CodeViewer content={artifact.content} language={artifact.codeLang} />;
}
```

- [ ] **Step 7: 添加 Artifact i18n keys**

在 `zh.json`/`en.json` 的 `"chat"` 命名空间追加 `artifactJson`, `artifactCsv`, `artifactMarkdown`, `artifactCode`, `artifactLoadMore`。

- [ ] **Step 8: 运行类型检查**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/components/panels/chat/artifacts/
git commit -m "[enhanced] feat(deck): enhance artifact detection + add JSON/CSV/Markdown/Code viewers"
```

---

## Task 6: Block 过滤/折叠（Group C — 完全独立）

**Files:**

- Create: `dashboard/src/stores/chat-preferences.ts`
- Create: `dashboard/src/components/panels/chat/BlockFilterBar.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx`
- Modify: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`
- Test: `dashboard/src/components/panels/chat/__tests__/block-filter.test.ts`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: 实现 chat-preferences.ts**

创建 `dashboard/src/stores/chat-preferences.ts`：

```typescript
const STORAGE_KEY = "deck:blockFilters";

export interface ChatBlockPreferences {
  showThinking: boolean;
  showToolUse: boolean;
  showToolResult: boolean;
}

const DEFAULTS: ChatBlockPreferences = {
  showThinking: true,
  showToolUse: true,
  showToolResult: true,
};

export function loadBlockPreferences(): ChatBlockPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveBlockPreferences(prefs: ChatBlockPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: 添加 Block 过滤 i18n keys**

在 `zh.json`/`en.json` 的 `"chat"` 命名空间追加：`filterThinking`, `filterTools`, `filterResults`。

- [ ] **Step 3: 实现 BlockFilterBar.tsx**

创建 `dashboard/src/components/panels/chat/BlockFilterBar.tsx`：

```typescript
"use client";

import { Brain, Wrench, ClipboardList } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ChatBlockPreferences } from "@/stores/chat-preferences";

interface BlockFilterBarProps {
  preferences: ChatBlockPreferences;
  onChange: (prefs: ChatBlockPreferences) => void;
}

export function BlockFilterBar({ preferences, onChange }: BlockFilterBarProps) {
  const t = useTranslations("chat");

  const toggles = [
    { key: "showThinking" as const, icon: Brain, label: t("filterThinking") },
    { key: "showToolUse" as const, icon: Wrench, label: t("filterTools") },
    { key: "showToolResult" as const, icon: ClipboardList, label: t("filterResults") },
  ];

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      {toggles.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...preferences, [key]: !preferences[key] })}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-colors cursor-pointer",
            preferences[key]
              ? "bg-[var(--accent-muted)] text-[var(--accent)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] opacity-50",
          )}
        >
          <Icon size={10} />
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: 修改 MessageList.tsx**

在 `MessageList` 组件中：

1. 导入 `BlockFilterBar`, `loadBlockPreferences`, `saveBlockPreferences`
2. 添加 `useState` 管理 preferences
3. 在消息列表上方渲染 `<BlockFilterBar>`
4. 在 `MessageBubble` 中根据 preferences 过滤 blocks

```typescript
// 在 MessageBubble 中，过滤阶段：
const filteredContent = message.content.filter((b) => {
  if (b.type === "thinking" && !preferences.showThinking) return false;
  if (b.type === "tool_use" && !preferences.showToolUse) return false;
  if (b.type === "tool_result" && !preferences.showToolResult) return false;
  return true;
});
```

- [ ] **Step 5: 修改 ToolResultCard.tsx**

将现有的 always-open 行为改为 `<details>` 折叠，error 时默认展开：

```typescript
export function ToolResultCard({ content, isError }: ToolResultCardProps) {
  // ... existing code ...
  return (
    <>
      <details className="my-1.5 text-xs rounded-lg border ..." open={isError}>
        <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer ...">
          {isError ? <X size={12} /> : <Check size={12} />}
          <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
        </summary>
        <pre className="px-2.5 py-2 ...">{displayContent}</pre>
        {/* ... fold button ... */}
      </details>
      {artifact && <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />}
    </>
  );
}
```

- [ ] **Step 6: 编写测试**

创建 `dashboard/src/components/panels/chat/__tests__/block-filter.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { loadBlockPreferences, saveBlockPreferences } from "@/stores/chat-preferences";

describe("ChatBlockPreferences", () => {
  it("returns defaults when no localStorage", () => {
    localStorage.clear();
    const prefs = loadBlockPreferences();
    expect(prefs.showThinking).toBe(true);
    expect(prefs.showToolUse).toBe(true);
    expect(prefs.showToolResult).toBe(true);
  });

  it("round-trips through localStorage", () => {
    const prefs = { showThinking: false, showToolUse: true, showToolResult: false };
    saveBlockPreferences(prefs);
    expect(loadBlockPreferences()).toEqual(prefs);
  });
});
```

- [ ] **Step 7: 运行测试**

Run: `cd dashboard && npx vitest run src/components/panels/chat/__tests__/block-filter.test.ts`
Expected: PASS

- [ ] **Step 8: 运行类型检查**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/stores/chat-preferences.ts dashboard/src/components/panels/chat/BlockFilterBar.tsx dashboard/src/components/panels/chat/MessageList.tsx dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx dashboard/src/components/panels/chat/__tests__/block-filter.test.ts dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add Block filter toolbar + tool_result collapsible"
```

---

## Task N: 集成验证

**Files:** 无新文件

- [ ] **Step 1: 全量类型检查**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: 全量测试**

Run: `cd dashboard && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 3: 验证 i18n 完整性**

检查 `zh.json` 和 `en.json` 中所有新增 key 一一对应，无遗漏。

- [ ] **Step 4: 运行 lint**

Run: `cd dashboard && npx oxlint .`
Expected: 零错误

- [ ] **Step 5: Commit（如有修复）**

```bash
git commit -m "[enhanced] fix(deck): integration fixes for A2UI Canvas"
```

---

## 并行执行建议

```
Phase 0（串行）：Task 0 — 共享接口定义
    ↓
Phase 1（串行）：Task 1 — Gateway + Deck Server 事件注册
    ↓
Phase 2（可并行）：
    ├── Task 2 — A2UIBridge + 消息格式化
    └── Task 6 — Block 过滤/折叠（Group C，完全独立）
    ↓
Phase 3（串行）：Task 3 — Canvas Host 代理端点
    ↓
Phase 4（串行）：Task 4 — RightPanel + CanvasPanel + CanvasDebugPanel
    ↓
Phase 5（串行）：Task 5 — Artifact 增强（依赖 Task 4 RightPanel）
    ↓
Phase 6（串行）：Task N — 集成验证
```

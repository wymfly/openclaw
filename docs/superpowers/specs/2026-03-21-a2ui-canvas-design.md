# A2UI Canvas + 右侧面板统一架构设计规范

## 概述

为 openclaw-deck Dashboard 实现 A2UI Canvas 渲染能力，成为继 macOS / iOS / Android 之后第四个支持 A2UI 交互的客户端。同时统一右侧面板架构，整合 Canvas 实时渲染和 Artifact 文件产物预览，并增加开发者调试工具和消息 Block 过滤/折叠功能。

## 背景与动机

### 现有基础设施

Session-Scoped State（提案 1-3）已为 A2UI 预留了完整插槽：

- `A2UIState` 类型（`chat-types.ts`）
- `setA2UIState()` store action
- `useSessionA2UI()` selector hook
- `dispatchA2UIEvent()` SSE dispatcher
- `useSessionIndicator()` 返回 `"canvas"` 状态

Gateway 端 A2UI 渲染引擎完整：

- `a2ui.bundle.js`（17,815 行 Lit Web Components）—— 支持 10 种组件类型
- `<openclaw-a2ui-host>` 自定义元素 —— surface 管理、增量更新、action 处理
- `/__openclaw__/a2ui/` HTTP 端点 —— 提供渲染引擎页面
- JSONL 组件协议 —— `surfaceUpdate` / `beginRendering` / `dataModelUpdate` / `deleteSurface`

### 缺口

1. `"a2ui"` 不在 `DeckEventType` 和 `VALID_DECK_EVENTS` 中 —— Gateway 广播的 A2UI 事件无法到达 Deck
2. 无渲染组件 —— 无 UI 实际显示 A2UI 内容
3. 无 action 桥接 —— 用户操作无法回传给 Agent
4. `dispatchA2UIEvent` payload 类型与 Gateway 实际广播不匹配
5. ArtifactPanel 和未来的 CanvasPanel 位置冲突
6. Artifact 检测仅支持 HTML/SVG/Mermaid，缺少 JSON/CSV/Markdown/Code
7. 消息 Block（thinking/tool_use/tool_result）无过滤/折叠配置

## 设计原则

1. **iframe 隔离** —— A2UI 内容在沙箱 iframe 中渲染，与 Deck 主应用完全隔离
2. **与原生客户端对齐** —— 复用同一个渲染引擎，行为与 macOS/iOS/Android 一致
3. **Gateway 零改动** —— 所有变更限制在 Deck 前端（`dashboard/`）
4. **统一面板** —— Canvas 和 Artifact 共用右侧抽拉面板，互斥显示

## 约束

- A2UI 内容是实时短暂的（ephemeral）—— 历史 session 不重建 Canvas
- Gateway 不存储 A2UI 事件历史 —— Debug eventLog 仅在当前 session 生命周期内有效
- iframe 天然限制 —— 无法跨 iframe 拖放、文本选中、共享 React 状态
- A2UI 组件扩展由上游 bundle 决定 —— Deck 不自行添加组件类型

---

## 一、整体架构

### 数据流

```
Agent → canvas tool: a2ui_push(jsonl)
  → Gateway node.invoke → broadcast("a2ui", {事件, __invokeId, __nodeId})
  → Deck Server EventBus (新增 "a2ui" 类型) → SSE
  → dispatchA2UIEvent() → store.setA2UIState() + appendA2UIEvent()
  → CanvasPanel 检测 visible=true → 面板滑出
  → A2UIBridge.pushMessages() → iframe postMessage → openclawA2UI.applyMessages()
  → 渲染完成

用户点击 Canvas Button
  → iframe a2ui.bundle.js 构建 userAction
  → iframe postMessage({type:"a2ui:action", userAction}) → Deck
  → A2UIBridge.onUserAction → formatA2UIAgentMessage()
  → fetch("/api/chat/send") 发送格式化文本（与原生客户端格式一致）
  → postMessage 回传 action-status 到 iframe
```

### Deck Server 改动

```typescript
// event-bus.ts: DeckEventType 新增
| "a2ui"

// runtime.ts: VALID_DECK_EVENTS 新增
"a2ui",
```

---

## 二、A2UIBridge —— iframe 双向通信层

### 接口定义

```typescript
interface A2UIBridge {
  // Deck → iframe
  pushMessages(messages: unknown[]): void;
  reset(): void;
  setTheme(theme: "light" | "dark"): void;

  // iframe → Deck (回调)
  onUserAction: (action: UserAction) => void;
  onReady: () => void;
  onSurfacesChanged: (surfaces: string[]) => void;

  // 生命周期
  attach(iframe: HTMLIFrameElement): void;
  detach(): void;
}

interface UserAction {
  id: string;
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  context?: Record<string, unknown>;
  timestamp: string;
}
```

### postMessage 协议

```
Deck → iframe:
  { type: "a2ui:push", messages: [...] }
  { type: "a2ui:reset" }
  { type: "a2ui:theme", theme: "dark" }
  { type: "a2ui:action-status", id, ok, error }

iframe → Deck:
  { type: "a2ui:ready" }
  { type: "a2ui:action", userAction: {...} }
  { type: "a2ui:surfaces-changed", surfaces: ["main"] }
```

### iframe 端桥接脚本

iframe 加载 `/__openclaw__/a2ui/?bridge=postMessage` 时，注入桥接脚本替代原生 WebView bridge：

```javascript
// 监听来自 Deck 的消息
window.addEventListener("message", (e) => {
  if (e.data?.type === "a2ui:push") {
    openclawA2UI.applyMessages(e.data.messages);
    // 推送 surfaces 变更
    window.parent.postMessage(
      {
        type: "a2ui:surfaces-changed",
        surfaces: openclawA2UI.getSurfaces(),
      },
      "*",
    );
  } else if (e.data?.type === "a2ui:reset") {
    openclawA2UI.reset();
  } else if (e.data?.type === "a2ui:action-status") {
    window.dispatchEvent(
      new CustomEvent("openclaw:a2ui-action-status", {
        detail: { id: e.data.id, ok: e.data.ok, error: e.data.error },
      }),
    );
  }
});

// 替代原生 bridge，用 postMessage 回传 userAction
window.openclawCanvasA2UIAction = {
  postMessage: (payload) => {
    window.parent.postMessage({ type: "a2ui:action", ...JSON.parse(payload) }, "*");
  },
};

window.parent.postMessage({ type: "a2ui:ready" }, "*");
```

### userAction 回传（移植自原生客户端）

从 `OpenClawCanvasA2UIAction`（Swift/Kotlin）移植到 TypeScript：

```typescript
function sanitizeTagValue(value: string): string {
  const trimmed = value.trim() || "-";
  return trimmed.replace(/ /g, "_").replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

function extractActionName(userAction: Record<string, unknown>): string | null {
  for (const key of ["name", "action"]) {
    const val = typeof userAction[key] === "string" ? (userAction[key] as string).trim() : "";
    if (val) return val;
  }
  return null;
}

function formatA2UIAgentMessage(opts: {
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
```

---

## 三、右侧面板统一架构

### 组件树

```
ChatPanel.tsx (已有)
├── SessionSidebar (已有)
├── MessageList (已有，增强：Block 过滤 + 折叠)
├── ToolProgressBar (已有)
├── MessageInput (已有)
└── RightPanel.tsx (新建，统一容器)
    ├── 状态：hidden | canvas | artifact
    ├── 共享：抽拉动画、拖拽分割线、收起按钮
    │
    ├── CanvasPanel.tsx (A2UI 实时渲染)
    │   ├── CanvasHeader (surface 名称 + Debug 按钮 + 收起)
    │   ├── CanvasViewport (iframe + loading/error/empty 状态)
    │   └── CanvasDebugPanel (底部可折叠)
    │       ├── MessagesTab (JSONL 消息流)
    │       └── TreeTab (组件树检查器)
    │
    └── ArtifactPanel.tsx (增强版文件产物预览)
        ├── ArtifactHeader (标题 + 类型 + 复制 + 全屏 + 关闭)
        └── ArtifactViewport (按类型选择渲染器)
            ├── IframeRenderer — HTML / SVG / Mermaid
            ├── CodeViewer — 代码文件（语法高亮 + 行号）
            ├── MarkdownViewer — Markdown 渲染
            ├── JsonTree — JSON 树形查看器（可折叠）
            └── TableViewer — CSV/TSV 表格
```

### 面板优先级与切换

| 场景                            | 行为                                        |
| ------------------------------- | ------------------------------------------- |
| Canvas 活跃 + 用户点击 Artifact | Artifact 替换显示，Canvas 暂停但保持 iframe |
| 用户关闭 Artifact               | 回到 Canvas（如果仍活跃）                   |
| Canvas 活跃 + 新 A2UI 推送      | 如果当前显示 Artifact，自动切回 Canvas      |
| 两者都不活跃                    | 面板收起                                    |

### 面板状态

```typescript
type RightPanelMode = "hidden" | "canvas" | "artifact";

interface RightPanelState {
  mode: RightPanelMode;
  activeArtifact: ArtifactInfo | null;
  canvasActive: boolean;
}
```

### 交互行为

- **自动展开** —— Agent 推送 A2UI 内容时面板自动滑出
- **手动收起** —— 点击 › 按钮收起，Chat 恢复全宽
- **手动展开** —— 点击收起态的 ‹ 按钮重新展开
- **可拖拽分割线** —— 自由调节 Chat / Panel 宽度比例，localStorage 记忆
- **自动隐藏** —— Agent 发送 `canvas.hide` 或 reset 时面板自动收起

### 响应式断点

| 断点       | 行为                              |
| ---------- | --------------------------------- |
| ≥1024px    | Chat + RightPanel 左右分栏        |
| 768-1023px | RightPanel 叠加层覆盖 Chat        |
| <768px     | RightPanel 全屏覆盖，顶部返回按钮 |

---

## 四、A2UIState 扩展与 dispatchA2UIEvent 修正

### A2UIState 扩展

```typescript
interface A2UIState {
  url: string;
  visible: boolean;
  bridgeStatus: "connecting" | "ready" | "error";
  eventLog: A2UIEvent[]; // 环形缓冲区，最多 200 条
  surfaces: string[]; // 当前 surface 列表
}

interface A2UIEvent {
  timestamp: number;
  direction: "inbound" | "outbound";
  action: string; // surfaceUpdate / beginRendering / userAction 等
  summary: string; // 人类可读摘要
  raw: unknown; // 原始 payload，Debug 面板可展开查看
}
```

### dispatchA2UIEvent payload 修正

当前 payload 类型（`{url, visible}`）与 Gateway 实际广播不匹配。修正为：

```typescript
export type A2UIEventPayload = {
  sessionKey?: string;
  // Gateway 广播的原始 A2UI JSONL 事件字段
  __invokeId?: string;
  __nodeId?: string;
  // 以下为 JSONL action —— 恰好有一个
  surfaceUpdate?: unknown;
  beginRendering?: unknown;
  dataModelUpdate?: unknown;
  deleteSurface?: unknown;
};
```

### dispatchA2UIEvent 增强逻辑

```typescript
export function dispatchA2UIEvent(payload: A2UIEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) return;

  useChatStore.getState().ensureSession(sessionKey);

  // 1. 解析事件类型和摘要
  const event: A2UIEvent = {
    timestamp: Date.now(),
    direction: "inbound",
    action: extractA2UIActionType(payload),
    summary: summarizeA2UIEvent(payload),
    raw: payload,
  };

  // 2. 追加到 eventLog（环形缓冲区）
  useChatStore.getState().appendA2UIEvent(sessionKey, event);

  // 3. 设置 visible=true（自动展开面板）
  const current = useChatStore.getState().sessions.get(sessionKey)?.a2uiState;
  useChatStore.getState().setA2UIState(sessionKey, {
    url: current?.url ?? "",
    visible: true,
    bridgeStatus: current?.bridgeStatus ?? "connecting",
    eventLog: current?.eventLog ?? [],
    surfaces: current?.surfaces ?? [],
  });

  // 4. A2UIBridge 推送由 CanvasPanel 组件通过 React effect 完成
  //    store 更新 → 组件检测新事件 → postMessage 到 iframe
}
```

### 新增 store actions

```typescript
appendA2UIEvent(sessionKey: string, event: A2UIEvent): void;
updateA2UIBridgeStatus(sessionKey: string, status: "connecting" | "ready" | "error"): void;
updateA2UISurfaces(sessionKey: string, surfaces: string[]): void;
```

---

## 五、Canvas 面板状态机

```
     ┌──────────┐
     │  hidden  │ ← 默认 / canvas.hide / reset / 用户手动收起
     └────┬─────┘
          │ Agent a2ui_push 或用户手动展开
          ▼
     ┌──────────┐
     │ loading  │ ← iframe 加载中，显示骨架屏
     └────┬─────┘
          │ iframe postMessage("a2ui:ready")
          ▼
     ┌──────────┐
     │  ready   │ ← 正常渲染，接收 A2UI 事件
     └────┬─────┘
          │ iframe 加载失败 / bridge 超时（5s）
          ▼
     ┌──────────┐
     │  error   │ ← 错误信息 + 重试按钮
     └──────────┘
```

### 状态 UI

| 状态                       | 显示内容                                        |
| -------------------------- | ----------------------------------------------- |
| loading                    | 骨架屏动画 + "Loading Canvas..." 文字           |
| ready                      | iframe 渲染的 A2UI 内容                         |
| error                      | 错误图标 + 错误消息 + "Retry" 按钮              |
| empty (ready 但无 surface) | 引导提示 "Waiting for agent to push content..." |

### 错误处理

| 场景                                            | 处理                                                            |
| ----------------------------------------------- | --------------------------------------------------------------- |
| iframe 加载超时（5s）                           | bridgeStatus → error，显示重试                                  |
| bridge ready 超时（load 后 3s 内无 ready 消息） | bridgeStatus → error                                            |
| userAction 发送失败                             | 通过 postMessage 回传 `{ok:false}` 给 iframe，bundle 自带 toast |
| iframe 意外卸载                                 | bridgeStatus 回退到 connecting，自动重载                        |
| Session 切换                                    | 保持 iframe 实例，发送 reset + 新 session 缓存事件              |

---

## 六、Debug 面板

Canvas 底部可折叠区域，点击 "Debug" 按钮切换显示。

### Messages Tab —— JSONL 消息流

每行一个事件：

```
时间戳  方向  action类型       摘要
12:34:01 ⬇️  surfaceUpdate   surface=main, 3 components
12:34:05 ⬆️  userAction      action=Book, component=btn1
12:34:05 ✅  action-status   ok=true
```

- 方向箭头：⬇️ inbound（Gateway → Deck）/ ⬆️ outbound（用户操作）
- 类型颜色编码：`surfaceUpdate` 蓝 / `beginRendering` 绿 / `userAction` 橙 / `action-status` 绿勾
- 点击任一行展开 Raw Payload（格式化 JSON）
- 右上角事件计数 + Clear 按钮
- 支持按 action 类型筛选

### Tree Tab —— Surface 组件树

实时显示 iframe 中 surfaces 的组件层级：

```
▼ 🎨 main (root: root)
  ▼ Column  id=root
    ▼ Card  id=form
      · Text       id=title     "预约表单"
      · TextField  id=name      placeholder="姓名"
      · Button     id=btn1      label="Book"  action=Book
      · Button     id=btn2      label="Cancel"
```

- 组件类型颜色编码：布局蓝 / 容器紫 / 文本黄 / 交互红橙
- 点击节点在底部显示完整属性
- 数据来源：每次 `applyMessages` 后 iframe 推送 surfaces 状态

### 数据来源

Tree tab 需要从 iframe 获取组件树信息。通过扩展 postMessage 协议实现：

- 每次 `applyMessages` 后，iframe 端 postMessage `surfaces-changed`
- Deck 可主动请求 `{ type: "a2ui:get-tree" }` → iframe 回复完整组件树

---

## 七、Artifact 系统增强

### detectArtifact 扩展

在现有 HTML/SVG/Mermaid 基础上新增检测：

| 优先级 | 类型     | 检测规则                                            | 渲染器                      |
| :----: | -------- | --------------------------------------------------- | --------------------------- |
|   1    | html     | `<html` / `<body` / `<!doctype`                     | IframeRenderer (srcdoc)     |
|   2    | svg      | `<svg` 开头                                         | IframeRenderer (srcdoc)     |
|   3    | mermaid  | ` ```mermaid ` 代码块                               | IframeRenderer (mermaid.js) |
|   4    | json     | `JSON.parse()` 成功 + 对象/数组 + 长度 > 50         | JsonTree                    |
|   5    | csv      | ≥3 行 + 逗号数一致 + 首行似表头                     | TableViewer                 |
|   6    | markdown | `# ` 开头 或含 `**` / `- [ ]` 等 Markdown 标记      | MarkdownViewer              |
|   7    | code     | tool_use.name 含 `write`/`create`/`edit` + 代码特征 | CodeViewer                  |

### ArtifactInfo 扩展

```typescript
interface ArtifactInfo {
  id: string;
  title: string;
  language: "html" | "mermaid" | "svg" | "json" | "markdown" | "csv" | "code";
  content: string;
  codeLang?: string; // language=code 时的语言标识
  source?: {
    toolName?: string; // 产生此 artifact 的工具名
    fileName?: string; // 文件名（从 tool_use input 推断）
  };
}
```

### 新增渲染器

**JsonTree** —— 可折叠树形结构，类型颜色编码（string 绿 / number 蓝 / boolean 橙 / null 灰），大对象/数组显示计数。

**TableViewer** —— 自动推断表头，大数据集分页加载，列可排序。

**CodeViewer** —— 语法高亮（轻量库），行号显示，复制按钮，语言从文件扩展名推断。

**MarkdownViewer** —— 复用现有 `ReactMarkdown + remarkGfm`，包裹在面板背景中。

---

## 八、消息 Block 过滤与折叠

### 过滤工具栏

在 MessageList 顶部增加 toggle 按钮：

```
[🧠 Thinking ✓] [🔧 Tools ✓] [📋 Results ✓]
```

- Text / Image / File 始终显示（核心内容，不可过滤）
- Thinking / Tool Use / Tool Result 三个独立 toggle
- 默认全部开启（开发者面板定位）
- 偏好存 localStorage（key: `deck:blockFilters`）

### 折叠行为

| Block 类型  | 默认状态                        | 折叠交互                                  |
| ----------- | ------------------------------- | ----------------------------------------- |
| thinking    | 已有 `<details>` 折叠，默认收起 | 保持不变                                  |
| tool_use    | 已有 `<details>` 折叠           | 保持不变                                  |
| tool_result | 当前始终展开 → 改为默认收起     | 点击展开显示内容，isError=true 时默认展开 |

### 偏好持久化

```typescript
interface ChatBlockPreferences {
  showThinking: boolean; // default: true
  showToolUse: boolean; // default: true
  showToolResult: boolean; // default: true
}
```

---

## 九、A2UI 生命周期澄清

### 实时 vs 历史

| 方面          | 实时 session             | 历史 session                                             |
| ------------- | ------------------------ | -------------------------------------------------------- |
| A2UI 事件来源 | SSE 实时推送             | 无事件源                                                 |
| Canvas 面板   | 自动展开，实时渲染       | 隐藏，无内容                                             |
| Chat 历史痕迹 | —                        | tool_use 显示 `canvas: a2ui_push`，userAction 显示为文本 |
| eventLog      | session 级别，随会话存在 | 不持久化                                                 |

### 与原生客户端的一致性

三个原生客户端（macOS/iOS/Android）的 A2UI 行为也是实时的 —— 重启 app 或切回历史 session 时 Canvas 为空。Deck 保持一致。

---

## 十、测试策略

| 层                     | 测试内容                                                          | 方式                                   |
| ---------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| a2ui-bridge.ts         | postMessage 协议、消息格式化、sanitizeTagValue、extractActionName | 单元测试                               |
| dispatchA2UIEvent      | eventLog 追加、环形缓冲区溢出、bridgeStatus 更新、payload 解析    | 单元测试                               |
| CanvasPanel 状态机     | hidden→loading→ready→error 转换、session 切换重置                 | 组件测试                               |
| CanvasDebugPanel       | Messages tab 渲染/过滤、Tree tab 渲染                             | 组件测试                               |
| RightPanel 切换        | Canvas/Artifact 互斥、优先级、自动切换                            | 组件测试                               |
| detectArtifact         | 7 种类型检测准确性、边界情况                                      | 单元测试                               |
| BlockFilterBar         | toggle 状态持久化、过滤效果                                       | 组件测试                               |
| Deck Server            | `"a2ui"` 事件通过 SSE 转发                                        | 集成测试                               |
| formatA2UIAgentMessage | 输出格式与原生客户端一致                                          | 单元测试（对照 Swift/Kotlin 测试用例） |

---

## 十一、P0/P1 划分

### P0（首版必须有）

1. Deck Server `"a2ui"` 事件注册（DeckEventType + VALID_DECK_EVENTS）
2. A2UIBridge postMessage 双向通信
3. RightPanel 统一容器（抽拉式、拖拽分割线、响应式）
4. CanvasPanel（iframe 渲染 + loading/error/empty 状态 + 展开动画）
5. userAction 回传（formatA2UIAgentMessage + /api/chat/send）
6. dispatchA2UIEvent payload 修正 + eventLog
7. Debug Messages Tab
8. Debug Tree Tab
9. ArtifactPanel 重构到 RightPanel 容器中
10. detectArtifact 增强（JSON + CSV + Markdown + Code）
11. 消息 Block 过滤工具栏 + tool_result 默认折叠

### P1（后续迭代）

1. 主题同步 —— Deck light/dark → iframe
2. 收起态指示 —— 收起条显示绿点 + surface 数量
3. 键盘快捷键 —— `Cmd+\` 开合 Canvas
4. userAction 失败增强 —— 显示原因 + 重试选项
5. eventLog 历史持久化 —— session 切换后可回看

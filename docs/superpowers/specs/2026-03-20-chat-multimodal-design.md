# Chat Multimodal & Artifacts Design Spec

## 概述

为 openclaw-deck Dashboard 的 Web 聊天面板补全多模态能力。Gateway 和 Pi SDK 已完整支持多模态（base64 图像/文件附件、视觉模型、内容块数组），但 Dashboard UI 层完全断开。本设计覆盖三个子系统：上传管线、全内容块渲染、Artifacts 交互面板。

## 现状分析

| 层级                | 多模态支持                                                              | 现状                                  |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| Gateway `chat.send` | `attachments[]`（base64 图像/文件）                                     | 已有，但只处理 image 附件             |
| Pi SDK 视觉         | Claude/GPT VLM 图像分析                                                 | 已有                                  |
| SSE 消息流          | `emitChatDelta`/`emitChatFinal` 只发 `[{type:"text"}]`                  | **仅文本块**                          |
| `chat.history`      | 返回完整 Anthropic 格式消息（text/image/tool_use/tool_result/thinking） | 已有                                  |
| MessageInput        | 拖放+选择文件 UI                                                        | UI 已做，`sendMessage()` 未发送 files |
| MessageList         | 只渲染 text 块                                                          | 不渲染 image/file/tool_use            |
| SSE Hook            | 只过滤 `type === "text"`                                                | 仅处理文本                            |
| Canvas/Artifacts    | macOS 专有 WKWebView + A2UI                                             | Dashboard 未集成                      |

### 关键约束：两条数据路径

Gateway 的 chat 消息有两条路径，支持的内容块类型不同：

1. **SSE 实时流**（`emitChatDelta` / `emitChatFinal` in `server-chat.ts`）— 只发送 `[{ type: "text", text }]` 块。用于流式打字效果。
2. **历史加载**（`chat.history` → Pi session transcript）— 返回完整的 Anthropic 格式内容块数组（text, image, tool_use, tool_result, thinking）。

本设计基于此约束：

- **流式阶段**：SSE 只处理 text 块，实现打字效果
- **完成阶段**：收到 `final` 事件后，调用 `chat.history` 重新加载该消息的完整内容块（含 tool_use、tool_result、thinking 等）
- **历史加载**：直接映射 Anthropic 格式为 `ContentBlock[]`

## 参考实现

macOS app (`apps/shared/OpenClawKit/Sources/OpenClawChatUI/`) 的关键设计：

- **消息模型**：`OpenClawChatMessageContent` 扁平结构，所有字段 optional
- **渲染策略**：按类别分组提取（primaryText / inlineAttachments / toolCalls / toolResults / thinking），各自独立渲染组件
- **附件发送**：base64 编码后作为 content block 加入 `content[]`
- **Canvas**：WKWebView + A2UI bridge JavaScript，支持双向交互
- **工具展示**：`ToolDisplayRegistry` 映射工具名到 emoji + 友好名称

Dashboard 采用 TypeScript discriminated union 替代扁平结构，类型更安全。

---

## 一、数据模型

### ContentBlock 类型体系

```typescript
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; fileName?: string }
  | { type: "file"; data: string; mimeType: string; fileName: string; size?: number }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean }
  | { type: "thinking"; text: string };
```

注：不包含 `artifact` 块类型 — Artifacts 是前端从 `tool_result` 中识别的渲染策略，不是 Gateway 的内容块类型（见第五节）。

### ChatMessage 重构

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[]; // 替代原来的 content: string
  timestamp: number;
  streaming?: boolean;
  error?: string;
}
```

### 用户消息构造示例

纯文本：

```typescript
{
  content: [{ type: "text", text: "你好" }];
}
```

文字 + 图片：

```typescript
{
  content: [
    { type: "image", data: "base64...", mimeType: "image/jpeg", fileName: "photo.jpg" },
    { type: "text", text: "这张图里有什么？" },
  ];
}
```

### 与 Gateway 数据的映射

**来源 1：chat.history（完整内容块）**

| Anthropic 格式                                    | → ContentBlock                                |
| ------------------------------------------------- | --------------------------------------------- |
| `{ type: "text", text }`                          | `{ type: "text", text }`                      |
| `{ type: "image", source: { data, media_type } }` | `{ type: "image", data, mimeType }`           |
| `{ type: "tool_use", id, name, input }`           | `{ type: "tool_use", id, name, input }`       |
| `{ type: "tool_result", tool_use_id, content }`   | `{ type: "tool_result", toolUseId, content }` |
| `{ type: "thinking", thinking }`                  | `{ type: "thinking", text: thinking }`        |

**来源 2：SSE 实时流（仅文本）**

| SSE 事件块               | → ContentBlock           |
| ------------------------ | ------------------------ |
| `{ type: "text", text }` | `{ type: "text", text }` |

---

## 二、组件架构

### MessageBubble 渲染策略

参考 macOS app 分组渲染，按类别提取并渲染内容块：

```
MessageBubble
 ├── ThinkingBlock[]      ← type: "thinking"
 ├── AttachmentStrip[]    ← type: "image" | "file" (用户消息的附件缩略图/文件标签)
 ├── TextContent          ← type: "text" (合并所有 text 块，Markdown 渲染)
 ├── ToolUseCard[]        ← type: "tool_use" (工具调用卡片，含 emoji + 工具名)
 ├── ToolResultCard[]     ← type: "tool_result" (工具结果，可展开，长结果折叠)
 └── ArtifactCard[]       ← 从 tool_result 中识别（见第五节）
```

### 新增/重构组件

| 组件                     | 职责                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| `ImageBlock`             | 渲染 inline 图片，缩略图 + 点击放大 lightbox                                  |
| `FileBlock`              | 文件附件标签（图标 + 文件名 + 大小），可下载                                  |
| `ToolUseCard`（重构）    | 从现有组件重构，接受 `ContentBlock & {type:"tool_use"}` 而非旧 `ToolUseBlock` |
| `ToolResultCard`（新增） | 工具结果展示，短结果直接显示，长结果 8 行折叠+展开按钮（参考 macOS app）      |
| `ArtifactCard`           | 从特定 tool_result 识别的 artifact 卡片，点击打开 Artifacts 面板              |
| `ArtifactPanel`          | 聊天面板右侧的独立面板，iframe 渲染交互式内容                                 |

### 布局

正常模式：

```
┌──────────────────────────────────────────────┐
│  ChatPanel                                    │
│  ┌───────────────┬──────────────────────────┐ │
│  │ SessionSidebar│  ┌─ MessageList ───────┐ │ │
│  │               │  │  MessageBubble...    │ │ │
│  │               │  └─────────────────────┘ │ │
│  │               │  ┌─ MessageInput ──────┐ │ │
│  │               │  │ [📎] [textarea] [▶] │ │ │
│  │               │  │ [img1] [img2] [doc] │ │ │
│  │               │  └─────────────────────┘ │ │
│  └───────────────┴──────────────────────────┘ │
└──────────────────────────────────────────────┘
```

有 Artifact 时（SessionSidebar 自动收起）：

```
┌───────────────────────────────────────────────────────┐
│  ┌─ Chat (50%) ──────────┬─ ArtifactPanel (50%) ────┐ │
│  │  MessageList           │  [标题栏: title + 关闭]   │ │
│  │  ...                   │  ┌─ iframe ────────────┐ │ │
│  │  [ArtifactCard] ←click→│  │  交互式 HTML/JS     │ │ │
│  │  ...                   │  └─────────────────────┘ │ │
│  │  MessageInput          │                          │ │
│  └────────────────────────┴──────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

窄屏（< 1024px）：ArtifactPanel 以 overlay 全屏显示，覆盖聊天区域。

---

## 三、上传管线

### 前端文件处理流程

```
用户选择/拖放文件
  → 校验大小（≤5MB）和数量（≤10），失败时 toast 提示
  → 生成预览（图片: URL.createObjectURL, 文件: 图标+名称+大小）
  → 存入 MessageInput 本地 state: PendingAttachment[]
  → 显示在附件预览条

点击发送（允许纯附件无文本，也允许纯文本无附件）
  → 每个文件读取为 base64 (FileReader.readAsDataURL)
  → 构造用户消息 content: ContentBlock[]
      图片 → {type:"image", data, mimeType, fileName}
      其他 → {type:"file", data, mimeType, fileName, size}
      文本 → {type:"text", text}（如果有输入文本）
  → 本地立即显示用户消息（乐观更新，含附件缩略图）
  → POST /api/chat/send { sessionKey, message, attachments, idempotencyKey }
  → 清空 files 和 input state
```

### PendingAttachment 类型

```typescript
interface PendingAttachment {
  id: string; // crypto.randomUUID()
  file: File;
  preview?: string; // URL.createObjectURL (图片) 或 undefined (文件)
  type: "image" | "file"; // 由 file.type.startsWith("image/") 判断
}
```

### API 路由修改

`/api/chat/send`：

- 放宽 `message` 必填限制：有 `message` 或 `attachments` 之一即可
- 透传 `attachments` 给 Gateway `chat.send`
- **配置 Next.js body size limit**：附件 base64 编码后约大 33%，5MB 文件 ≈ 6.67MB base64，10 个文件最大 ~67MB。需在 route config 中设置 `export const config = { api: { bodyParser: { sizeLimit: '70mb' } } }` 或使用 App Router 的 `export const maxDuration` + `bodyParser` 配置

```typescript
// 请求体
{
  sessionKey: string;
  message?: string;          // 改为 optional
  attachments?: Array<{
    type: "image" | "file";
    mimeType: string;
    fileName: string;
    content: string;         // base64
  }>;
  idempotencyKey?: string;   // 前端生成，防重复提交
}
```

### Gateway 改动

`src/gateway/chat-attachments.ts` 的 `parseMessageWithAttachments()`：

- 当前行为：非图像附件被 MIME 嗅探检测到后丢弃 + warn
- 改为：图像附件 → 照旧转为 `ChatImageContent`；非图像附件 → 转为新类型 `ChatFileContent`，注入消息上下文（文件名+内容摘要）供模型参考
- 新增 `ChatFileContent` 类型：`{ type: "file"; data: string; mimeType: string; fileName: string }`

### 限制

| 类型       | 限制              | 说明                           |
| ---------- | ----------------- | ------------------------------ |
| 单文件     | 5MB（解码后）     | 沿用 Gateway 现有限制          |
| 单次附件数 | 最多 10 个        | 前端校验，超出 toast 提示      |
| 图片格式   | jpeg/png/gif/webp | Gateway MIME 嗅探已支持        |
| 文件格式   | 不限              | 前端不过滤，Gateway 按能力处理 |

---

## 四、SSE 处理 + Store 重构

### 双路径数据流

```
┌─ 实时路径 ──────────────────────────────────────────┐
│ SSE delta → text 块 → 流式打字效果                    │
│ SSE final → 标记完成 → 触发历史重载                    │
└─────────────────────────────────────────────────────┘
              ↓ final 触发
┌─ 完成路径 ──────────────────────────────────────────┐
│ chat.history → 获取最后一条完整消息                    │
│ → 映射为 ContentBlock[]（含 tool_use/result/thinking）│
│ → 替换 store 中的流式消息                              │
└─────────────────────────────────────────────────────┘
```

### useChatSSE 改造

```
SSE delta 事件:
  → 提取 content[].text（仅 text 块）
  → 调用 store.updateStreamingBlocks(id, [{ type: "text", text }])
  → 实时打字效果

SSE final 事件:
  → 标记 streaming: false
  → 调用 reloadLastMessage(sessionKey) 从 chat.history 获取完整内容
  → 映射 Anthropic 格式为 ContentBlock[]
  → 替换 store 中该消息的 content
```

### Store 重构

```typescript
// 旧 actions（移除）
updateStreamingMessage(id: string, content: string)
appendThinking(id: string, text: string)
appendToolUse(id: string, tool: ToolUseBlock)

// 新 actions
updateStreamingBlocks(id: string, blocks: ContentBlock[])   // SSE delta 用
replaceMessageContent(id: string, blocks: ContentBlock[])   // history reload 用
```

移除旧的 `ToolUseBlock` 类型，统一使用 `ContentBlock`。

### 历史消息加载

`chat.history` API 返回 Anthropic 格式消息。`toUiMessage()` 改造：

```typescript
function toUiMessage(raw: RawMessage): ChatMessage {
  const blocks: ContentBlock[] = raw.content.map(block => {
    switch (block.type) {
      case "text":        return { type: "text", text: block.text };
      case "image":       return { type: "image", data: block.source.data, mimeType: block.source.media_type };
      case "tool_use":    return { type: "tool_use", id: block.id, name: block.name, input: block.input };
      case "tool_result": return { type: "tool_result", toolUseId: block.tool_use_id, content: ... };
      case "thinking":    return { type: "thinking", text: block.thinking };
      default:            return { type: "text", text: JSON.stringify(block) };
    }
  });
  return { id: raw.id, role: raw.role, content: blocks, timestamp: raw.timestamp };
}
```

---

## 五、Artifacts 面板

### 设计原则

Gateway 不存在 `type: "artifact"` 内容块。Artifacts 是 **Dashboard 前端的渲染策略** — 从 `tool_result` 块中识别可交互内容，在独立面板中渲染。

### 识别规则

从 `tool_result` 块中检测 artifact 的启发式规则：

````typescript
function detectArtifact(block: ToolResultBlock): ArtifactInfo | null {
  const content = block.content;
  // 1. HTML 内容（含 <html> 或 <body> 或 <!DOCTYPE）
  if (/<html|<body|<!doctype/i.test(content)) {
    return { language: "html", title: guessTitle(content), content };
  }
  // 2. SVG 内容
  if (content.trimStart().startsWith("<svg")) {
    return { language: "svg", title: "SVG", content };
  }
  // 3. Mermaid 图表（```mermaid 代码块）
  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return { language: "mermaid", title: "Diagram", content: mermaidMatch[1] };
  }
  return null;
}
````

### 数据流

```
chat.history 返回 tool_result 块
  → toUiMessage() 映射为 ContentBlock
  → MessageBubble 渲染 ToolResultCard
  → ToolResultCard 内调用 detectArtifact()
  → 如果识别到 artifact → 显示 ArtifactCard（带预览 + "打开"按钮）
  → 用户点击 → 设置 activeArtifact state
  → ArtifactPanel 展开，iframe 渲染内容
```

### ArtifactPanel 状态

```typescript
interface ArtifactState {
  activeArtifact: {
    id: string;
    title: string;
    language: string; // "html" | "mermaid" | "svg" | "text"
    content: string;
  } | null;
}
```

### 渲染策略

所有类型统一在 iframe 内渲染（含 SVG），避免主页面 XSS 风险：

| language      | iframe 内渲染方式              |
| ------------- | ------------------------------ |
| `html`        | srcdoc 直接渲染                |
| `mermaid`     | 注入 Mermaid.js CDN + 渲染脚本 |
| `svg`         | 包裹在 HTML body 中渲染        |
| `text` / 其他 | `<pre>` 代码展示（只读）       |

注：不支持 `react` 类型 — Babel standalone 约 3MB 且有 CSP 限制，性价比低。如需 React artifact，由工具端编译为纯 HTML 后输出。

### iframe 安全

```html
<iframe srcdoc="..." sandbox="allow-scripts" />
```

- `allow-scripts`：允许 JS 执行
- 不加 `allow-same-origin`：阻止访问主页面 DOM/cookie
- 不加 `allow-top-navigation`：阻止跳转主页面

### 面板交互

- **多 artifact 切换** — 标题栏显示当前 title，下拉切换同会话内其他 artifacts
- **复制代码** — 标题栏按钮，一键复制原始代码
- **全屏** — 切换面板全宽显示
- **响应式** — 默认占右侧 50% 宽度，窄屏（< 1024px）以 overlay 全屏显示

### 与 Gateway A2UI 的关系

初期不依赖 Gateway 的 `/__openclaw__/a2ui/` 端点。后续如需双向交互（artifact 发送用户操作回 Gateway），再接入 A2UI WebSocket 消息协议。

---

## 任务拆分

| 任务                       | 子系统 | 改动范围                                                                                   | 依赖   |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------ | ------ |
| T0: Next.js body size 配置 | 基础   | `/api/chat/send/route.ts` body parser limit                                                | 无     |
| T1: 数据模型重构           | 基础   | chat store（ContentBlock 类型 + ChatMessage 重构 + 新 actions）                            | 无     |
| T2: SSE + 历史加载改造     | 基础   | useChatSSE（双路径）+ toUiMessage() 映射 + ChatPanel 加载                                  | T1     |
| T3: 上传管线               | 输入   | MessageInput（base64 编码 + 发送）+ /api/chat/send（放宽 message 限制 + 透传 attachments） | T1     |
| T4: 内容块渲染             | 输出   | MessageBubble 重构 + ImageBlock + FileBlock + ToolUseCard 重构 + ToolResultCard            | T1, T2 |
| T5: Artifacts 面板         | 交互   | detectArtifact() + ArtifactCard + ArtifactPanel + ChatPanel 布局                           | T4     |
| T6: Gateway 文件支持       | 后端   | chat-attachments.ts 解除 image-only 限制，新增 ChatFileContent 类型                        | 无     |

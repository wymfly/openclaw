# Chat Multimodal & Artifacts Design Spec

## 概述

为 openclaw-deck Dashboard 的 Web 聊天面板补全多模态能力。Gateway 和 Pi SDK 已完整支持多模态（base64 图像/文件附件、视觉模型、内容块数组），但 Dashboard UI 层完全断开。本设计覆盖三个子系统：上传管线、全内容块渲染、Artifacts 交互面板。

## 现状分析

| 层级                | 多模态支持                          | 现状                                  |
| ------------------- | ----------------------------------- | ------------------------------------- |
| Gateway `chat.send` | `attachments[]`（base64 图像/文件） | 已有，但只处理 image 附件             |
| Pi SDK 视觉         | Claude/GPT VLM 图像分析             | 已有                                  |
| SSE 消息流          | 返回 image/file/tool_use 内容块     | 已有                                  |
| MessageInput        | 拖放+选择文件 UI                    | UI 已做，`sendMessage()` 未发送 files |
| MessageList         | 只渲染 text 块                      | 不渲染 image/file/tool_use            |
| SSE Hook            | 只过滤 `type === "text"`            | 丢弃所有非文本块                      |
| Canvas/Artifacts    | macOS 专有 WKWebView                | Dashboard 未集成                      |

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
  | { type: "thinking"; text: string }
  | { type: "artifact"; id: string; title: string; language: string; content: string };
```

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

### 与 Gateway 的映射

| Gateway SSE 块                                    | → ContentBlock                                |
| ------------------------------------------------- | --------------------------------------------- |
| `{ type: "text", text }`                          | `{ type: "text", text }`                      |
| `{ type: "image", source: { data, media_type } }` | `{ type: "image", data, mimeType }`           |
| `{ type: "tool_use", id, name, input }`           | `{ type: "tool_use", id, name, input }`       |
| `{ type: "tool_result", tool_use_id, content }`   | `{ type: "tool_result", toolUseId, content }` |
| `{ type: "thinking", thinking }`                  | `{ type: "thinking", text }`                  |

---

## 二、组件架构

### MessageBubble 渲染策略

参考 macOS app 分组渲染，按类别提取并渲染内容块：

```
MessageBubble
 ├── ThinkingBlock[]      ← type: "thinking"
 ├── AttachmentStrip[]    ← type: "image" | "file" (用户消息的附件缩略图/文件标签)
 ├── TextContent          ← type: "text" (合并所有 text 块，Markdown 渲染)
 ├── ToolUseCard[]        ← type: "tool_use" (工具调用卡片)
 ├── ToolResultCard[]     ← type: "tool_result" (工具结果，可展开)
 └── ArtifactCard[]       ← type: "artifact" (点击打开 Artifacts 面板)
```

### 新增组件

| 组件             | 职责                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `ImageBlock`     | 渲染 inline 图片，缩略图 + 点击放大 lightbox                       |
| `FileBlock`      | 文件附件标签（图标 + 文件名 + 大小），可下载                       |
| `ToolResultCard` | 工具结果展示，短结果直接显示，长结果折叠，含图片结果时 inline 渲染 |
| `ArtifactCard`   | artifact 卡片，显示标题 + 语言标签，点击打开 Artifacts 面板        |
| `ArtifactPanel`  | 聊天面板右侧的独立面板，iframe 渲染交互式内容                      |

### 布局

正常模式：

```
┌──────────────────────────────────────────────┐
│  ChatPanel                                    │
│  ┌───────────────┬──────────────────────────┐ │
│  │ SessionSidebar│  ┌─ MessageList ───────┐ │ │
│  │               │  │  MessageBubble...    │ │ │
│  │               │  └────────────────────-─┘ │ │
│  │               │  ┌─ MessageInput ──────┐ │ │
│  │               │  │ [📎] [textarea] [▶] │ │ │
│  │               │  │ [img1] [img2] [doc] │ │ │
│  │               │  └─────────────────────┘ │ │
│  └───────────────┴──────────────────────────┘ │
└──────────────────────────────────────────────┘
```

有 Artifact 时：

```
┌───────────────────────────────────────────────────────┐
│  ┌─ Chat ────────────────┬─ ArtifactPanel ──────────┐ │
│  │  MessageList           │  [标题栏: title + 关闭]   │ │
│  │  ...                   │  ┌─ iframe ────────────┐ │ │
│  │  [ArtifactCard] ←click→│  │  交互式 HTML/JS     │ │ │
│  │  ...                   │  └─────────────────────┘ │ │
│  │  MessageInput          │                          │ │
│  └────────────────────────┴──────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

---

## 三、上传管线

### 前端文件处理流程

```
用户选择/拖放文件
  → 校验大小（≤5MB）和数量（≤10）
  → 生成预览（图片: URL.createObjectURL, 文件: 图标+名称+大小）
  → 存入 MessageInput 本地 state: PendingAttachment[]
  → 显示在附件预览条

点击发送
  → 每个文件读取为 base64 (FileReader.readAsDataURL)
  → 构造 ContentBlock[]: 图片→{type:"image"}, 其他→{type:"file"}
  → 文本→{type:"text"}
  → 合并为 content: ContentBlock[]
  → 本地立即显示用户消息（乐观更新，含附件缩略图）
  → POST /api/chat/send { sessionKey, message, attachments, idempotencyKey }
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

`/api/chat/send` 请求体扩展：

```typescript
// 请求体
{
  sessionKey: string;
  message: string;
  attachments?: Array<{
    type: "image" | "file";
    mimeType: string;
    fileName: string;
    content: string;         // base64
  }>;
  idempotencyKey?: string;
}
```

直接透传 `attachments` 给 Gateway `chat.send`。

### Gateway 改动

`src/gateway/chat-attachments.ts` 的 `parseMessageWithAttachments()`：

- 当前行为：非图像附件被丢弃 + warn
- 改为：图像附件 → 照旧转为 `ChatImageContent`；非图像附件 → 转为 `ChatFileContent`，通过文件分析工具处理
- 新增 `ChatFileContent` 类型：`{ type: "file"; data: string; mimeType: string; fileName: string }`

### 限制

| 类型       | 限制              | 说明                           |
| ---------- | ----------------- | ------------------------------ |
| 单文件     | 5MB（解码后）     | 沿用 Gateway 现有限制          |
| 单次附件数 | 最多 10 个        | 前端限制                       |
| 图片格式   | jpeg/png/gif/webp | Gateway MIME 嗅探已支持        |
| 文件格式   | 不限              | 前端不过滤，Gateway 按能力处理 |

---

## 四、SSE 多模态处理 + Store 重构

### useChatSSE 改造

处理所有内容块类型：

```typescript
// 当前（丢弃非文本）
const text = blocks
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("");

// 改为（保留所有块，映射为 ContentBlock）
const contentBlocks: ContentBlock[] = blocks.map((block) => {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "image":
      return { type: "image", data: block.source?.data, mimeType: block.source?.media_type };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input };
    case "tool_result":
      return { type: "tool_result", toolUseId: block.tool_use_id, content: block.content };
    case "thinking":
      return { type: "thinking", text: block.thinking };
    default:
      return { type: "text", text: JSON.stringify(block) };
  }
});
```

### Store 重构

```typescript
// 旧 actions（面向 string content）
updateStreamingMessage(id: string, content: string)
appendThinking(id: string, text: string)
appendToolUse(id: string, tool: ToolUseBlock)

// 新 actions（面向 ContentBlock[]）
updateStreamingBlocks(id: string, blocks: ContentBlock[])
appendBlock(id: string, block: ContentBlock)
updateBlock(id: string, blockIndex: number, patch: Partial<ContentBlock>)
```

移除旧的 `ToolUseBlock` 类型，统一使用 `ContentBlock`。

### 流式渲染策略

SSE delta 事件中，助手消息的 text 块是增量的（每次 delta 带完整累积文本）。其他块类型在 final 时一次性到达。

```
delta 1: content: [{ type: "text", text: "让我" }]
delta 2: content: [{ type: "text", text: "让我分析" }]
delta 3: content: [{ type: "text", text: "让我分析这张图" }]
...
final:   content: [
           { type: "text", text: "让我分析这张图..." },
           { type: "tool_use", id: "t1", name: "image", input: {...} },
           { type: "tool_result", toolUseId: "t1", content: "图中包含..." }
         ]
```

处理逻辑：

- **delta 状态**：替换整个 `content` 数组（Gateway 每次发累积文本）
- **final 状态**：替换为最终完整的 `content` 数组，标记 `streaming: false`

### 历史消息加载

`sessions.history` API 返回的消息已是 Anthropic 格式的块数组，加载时直接映射为 `ContentBlock[]`。

---

## 五、Artifacts 面板

### 触发方式

1. **工具产出触发** — 助手消息中出现 `type: "artifact"` 块时，MessageList 渲染 ArtifactCard，用户点击打开面板
2. **自动打开** — SSE 流中出现新 artifact 块，面板自动展开
3. **手动关闭** — 面板标题栏有关闭按钮

### Artifact 数据流

```
Gateway Canvas Tool (present action)
  → SSE event 携带 artifact 内容
  → useChatSSE 解析为 { type: "artifact", id, title, language, content }
  → ChatStore 存储 artifact 块
  → ArtifactCard 渲染在消息气泡中
  → 用户点击 / 自动展开 ArtifactPanel
  → iframe 加载 artifact 内容
```

### ArtifactPanel 状态

```typescript
interface ArtifactState {
  activeArtifact: {
    id: string;
    title: string;
    language: string; // "html" | "react" | "mermaid" | "svg" | "text"
    content: string;
  } | null;
}
```

### 渲染策略

| language      | 渲染方式                                       |
| ------------- | ---------------------------------------------- |
| `html`        | iframe srcdoc 直接渲染                         |
| `react`       | iframe 内注入 React + Babel standalone 运行时  |
| `mermaid`     | iframe 内注入 Mermaid.js 渲染                  |
| `svg`         | dangerouslySetInnerHTML（经过 DOMPurify 消毒） |
| `text` / 其他 | 代码高亮展示（只读）                           |

### iframe 安全

```html
<iframe srcdoc="..." sandbox="allow-scripts" style="width:100%; height:100%; border:none;" />
```

- `allow-scripts`：允许 JS 执行
- 不加 `allow-same-origin`：阻止访问主页面 DOM/cookie
- 不加 `allow-top-navigation`：阻止跳转主页面

### 面板交互

- **多 artifact 切换** — 标题栏显示当前 title，下拉切换同会话内其他 artifacts
- **复制代码** — 标题栏按钮，一键复制原始代码
- **全屏** — 切换面板全宽显示
- **响应式** — 默认占右侧 50% 宽度，窄屏时 overlay 全屏

### 与 Gateway A2UI 的关系

Dashboard 的 ArtifactPanel 初期不依赖 Gateway 的 `/__openclaw__/a2ui/` 端点，直接用 iframe srcdoc 渲染 artifact content。后续如需双向交互（artifact 发送用户操作回 Gateway），再接入 A2UI 消息协议。

---

## 任务拆分

| 任务                 | 子系统 | 改动范围                                                 | 依赖   |
| -------------------- | ------ | -------------------------------------------------------- | ------ |
| T1: 数据模型重构     | 基础   | chat store + ChatMessage 类型 + SSE hook                 | 无     |
| T2: 上传管线         | 输入   | MessageInput + /api/chat/send + Gateway chat-attachments | T1     |
| T3: 内容块渲染       | 输出   | MessageList + ImageBlock + FileBlock + ToolResultCard    | T1     |
| T4: Artifacts 面板   | 交互   | ArtifactPanel + ArtifactCard + ChatPanel 布局            | T1, T3 |
| T5: Gateway 文件支持 | 后端   | chat-attachments.ts 解除 image-only 限制                 | 无     |

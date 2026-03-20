# Multimodal Pipeline Enhancement Design Spec

## 概述

增强 openclaw 的多模态管线，使 Web 端（Dashboard chat）获得与渠道一致的多模态体验。核心策略：将 WeCom 已验证的增强能力上推到核心管线，然后让 chat.send RPC 接入渠道级管线，Web 端作为 RPC 消费者自动获得完整能力。

## 设计原则

1. **管线统一**：Web 端和渠道走同一条核心管线，不搞两套
2. **Agent 自主**：管线只负责"文件到达 Agent 可访问的位置"，不预设处理方式。Agent 用模型原生能力、工具、Skill 自主决定如何处理
3. **RPC 一致**：Dashboard 所有 API 走 RPC 通道，不引入 OpenResponses HTTP API

## 现状与目标

### 管线三层结构

```
┌─ 渠道适配层 ─────────────────────────────────┐
│ Telegram / WeCom / Discord / Web(chat.send)   │
│ 职责：接收消息 → 下载媒体 → 构建 MsgContext   │
└─────────────────────┬─────────────────────────┘
                      ↓
┌─ 核心管线层 ─────────────────────────────────┐
│ applyMediaUnderstanding()                     │
│ 职责：视觉描述 / STT / 文件文本提取          │
└─────────────────────┬─────────────────────────┘
                      ↓
┌─ Agent 层 ──────────────────────────────────┐
│ dispatchInboundMessage()                     │
│ 职责：Agent 自主处理（模型/工具/Skill）      │
└──────────────────────────────────────────────┘
```

### 现状 vs 目标

| 能力                      | 渠道(Telegram等) | WeCom(增强fork) | chat.send(现状) | chat.send(目标) |
| ------------------------- | ---------------- | --------------- | --------------- | --------------- |
| 媒体下载到磁盘            | ✅               | ✅              | ❌              | ✅              |
| MsgContext 填充 MediaPath | ✅               | ✅              | ❌              | ✅              |
| applyMediaUnderstanding   | ✅               | ✅              | ❌              | ✅              |
| Office 文件文本预览       | ❌               | ✅ WeCom 私有   | ❌              | ✅ 核心能力     |
| 媒体失败用户通知          | ❌ 静默丢弃      | ✅ WeCom 私有   | ❌              | ✅ 核心能力     |
| MIME 归一化               | ⚠️ 基础          | ✅ 增强映射     | ❌              | ✅ 核心能力     |
| 工具事件广播              | ✅               | ✅              | ❌ 被过滤       | ✅              |
| 审批事件                  | ✅               | ✅              | ❌ scope 挡住   | ✅              |
| ChatEvent 媒体字段        | N/A              | N/A             | ❌              | ✅              |
| A2UI 事件                 | ❌               | ❌              | ❌              | ⚠️ Phase 1      |

---

## 一、核心管线增强（WeCom → Core 上推）

### 1.1 文本启发式预览

**来源**：`extensions/wecom/src/agent/handler.ts:80-123`

**上推位置**：`src/media-understanding/apply.ts`

在 `isBinaryMediaMime()` 返回 true 时，增加二次检测：采样文件前 4096 字节，如果非可打印字符占比 ≤ 2%，判定为文本文件，提取最多 12KB 预览注入消息。

```typescript
function looksLikeTextFile(buffer: Buffer, sampleSize = 4096): boolean {
  const sample = buffer.subarray(0, Math.min(sampleSize, buffer.length));
  let badChars = 0;
  for (const byte of sample) {
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) badChars++;
    if (byte === 0x7f) badChars++;
  }
  return badChars / sample.length <= 0.02;
}
```

**影响**：

- `.docx` 等 Office 文件仍为二进制，不会误判（它们的非可打印字符远超 2%）
- `.md`/`.csv`/`.log` 等被 MIME 误分类为 `application/octet-stream` 的文本文件能被正确处理
- WeCom 删除自有实现（~40 行），改调核心函数

### 1.2 媒体失败用户通知

**来源**：`extensions/wecom/src/agent/handler.ts:570-591`

**上推位置**：`src/media-understanding/apply.ts` 的 catch 块（当前第 440-444 行仅 verbose 日志）

改为：将错误信息注入 `ctx.Body`，用户在对话中能看到"媒体处理失败"提示。

```typescript
// 当前（静默跳过）
catch (err) {
  if (shouldLogVerbose()) logVerbose(`media: file attachment skipped: ${err}`);
  continue;
}

// 改为（用户可见）
catch (err) {
  const errMsg = `[媒体处理失败: ${att.path ?? att.url ?? "unknown"}] ${String(err)}`;
  ctx.Body = (ctx.Body ?? "") + "\n" + errMsg;
  log?.warn?.(errMsg);
  continue;
}
```

**影响**：

- 所有渠道 + chat.send 受益
- 用户知道文件为什么没被处理
- WeCom 删除自有的错误通知代码（~20 行）

### 1.3 MIME 归一化增强

**来源**：`extensions/wecom/src/agent/handler.ts:493-509` + `extensions/wecom/src/outbound.ts:256-362`

**上推位置**：`src/media/mime.ts`

验证并补漏现有 `EXT_BY_MIME` / `MIME_BY_EXT` 映射表。核心 `src/media/mime.ts` 已包含 `doc/docx/xls/xlsx/ppt/pptx` 和 `audio/ogg` 映射（`mime.ts:13,26-31`），可能只需补充少量缺失类型（如 `audio/amr`、`audio/speex`、`audio/opus`）。

**影响**：WeCom 删除自有 extMap（~15 行），改用核心映射。实际改动量可能很小（验证 + 补漏）。

---

## 二、chat.send RPC 多模态增强

### 2.1 文件上传机制

**两阶段策略**：

**Phase 1（立即可用）**：chat.send 的 `attachments` 参数（base64 inline）

- 已有基础设施：`ChatSendParamsSchema` 已声明 `attachments` 字段
- 限制：`parseMessageWithAttachments` 单附件上限 5MB 解码后（`chat-attachments.ts:115`）
- 适用：图片、小文件（≤ 5MB 解码后）

**Phase 2（后续）**：HTTP multipart 上传端点

- 新增 `POST /gateway/api/upload`，multipart/form-data
- 返回 `{ mediaPath, mediaUrl, mimeType, fileName }`
- chat.send 通过 `mediaPath` 引用，不再内联 base64
- 适用：大文件、流式上传

**本次设计聚焦 Phase 1**，Phase 2 作为后续增强预留接口。

### 2.2 chat.send → MsgContext 填充 MediaPath

**改动文件**：`src/gateway/server-methods/chat.ts`

在 `chat.send` handler 中，`parseMessageWithAttachments()` 之后，将解析出的附件写入磁盘并填充 MsgContext：

```typescript
// 现状：void parsedFiles;
// 改为：

// 1. 图片附件 → saveMediaBuffer → MediaPath
// 2. 文件附件 → saveMediaBuffer → MediaPath
const mediaPaths: string[] = [];
const mediaTypes: string[] = [];

for (const img of parsedImages) {
  const saved = await saveMediaBuffer(Buffer.from(img.data, "base64"), img.mimeType, "inbound");
  mediaPaths.push(saved.path);
  mediaTypes.push(saved.contentType);
}
for (const file of parsedFiles) {
  const saved = await saveMediaBuffer(
    Buffer.from(file.data, "base64"),
    file.mimeType,
    "inbound",
    undefined,
    file.fileName,
  );
  mediaPaths.push(saved.path);
  mediaTypes.push(saved.contentType);
}

// 3. 填充 MsgContext（字段已存在于类型定义中）
ctxPayload.MediaPath = mediaPaths[0];
ctxPayload.MediaUrl = mediaPaths[0];
ctxPayload.MediaType = mediaTypes[0];
ctxPayload.MediaPaths = mediaPaths.length > 0 ? mediaPaths : undefined;
ctxPayload.MediaUrls = mediaPaths.length > 0 ? mediaPaths : undefined;
ctxPayload.MediaTypes = mediaTypes.length > 0 ? mediaTypes : undefined;
```

### 2.3 chat.send 接入 applyMediaUnderstanding

**无需额外调用。** `applyMediaUnderstanding()` 已在 `getReplyFromConfig()`（`src/auto-reply/reply/get-reply.ts:127-133`）中统一调用，chat.send 必经该链路。

chat.send 只需确保 MsgContext 的 `MediaPath/MediaPaths/MediaTypes` 字段已填充（§2.2），统一链路会自动处理媒体理解。**不在 RPC handler 层额外调用 apply**，避免重复执行和 transcript echo 重复。

同时，移除现有的 `replyOptions.images` 直传路径（`chat.ts:974`），统一走 MediaPath → apply → detectAndLoadPromptImages 的渠道路径，消除"路径理解 + 原图直传"双通道冲突。

```typescript
// 现状（移除）：
// images: parsedImages.length > 0 ? parsedImages : undefined,

// 改为：不传 images，让 MediaPath 走统一管线
// images 由 detectAndLoadPromptImages 从 MediaPath 加载
```

### 2.4 工具事件广播

**改动文件**：Dashboard WebSocket 连接配置

现有代码要求客户端声明 `tool-events` capability 才注册到 `toolEventRecipients`（`chat.ts:978-983`）。**不绕过这个协议约束**，而是让 Dashboard 的 WebSocket 连接在握手时声明 `tool-events` capability：

```typescript
// Dashboard 的 Gateway adapter 连接配置
connect({ caps: ["tool-events"] });
```

这样 Dashboard 通过正规协议获得工具事件广播，无需修改 `server-chat.ts` 的过滤逻辑。

### 2.5 审批事件

**改动文件**：Dashboard Gateway adapter 连接配置

**不创建新 scope。** 直接给 Dashboard 的 WebSocket 连接分配 `operator.approvals` scope。原因：

1. `exec.approval.resolve` RPC 要求 `operator.approvals`（`method-scopes.ts:30-34`）
2. 审批客户端判定也只看 `operator.approvals|operator.admin`（`server.impl.ts:793-800`）
3. 如果用新 scope，WebChat 能收到事件但**无法响应**，且请求会被自动过期

Dashboard 作为 operator 级客户端，使用 `operator.approvals` scope 是合理的：

```typescript
// Dashboard Gateway adapter 连接
connect({
  scopes: ["operator.read", "operator.write", "operator.approvals"],
  caps: ["tool-events"],
});
```

审批响应走现有 RPC `exec.approval.resolve`，无需新增任何服务端代码。

### 2.6 ChatEvent 媒体字段

**改动文件**：`src/gateway/protocol/schema/logs-chat.ts`

```typescript
export const ChatEventSchema = Type.Object(
  {
    // ...existing fields...
    mediaUrl: Type.Optional(Type.String()),
    mediaUrls: Type.Optional(Type.Array(Type.String())),
    mediaType: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
```

需在**两条** final 发射路径中都填充媒体字段：

1. `src/gateway/server-chat.ts:342-425`（emitChatFinal）
2. `src/gateway/server-methods/chat.ts:550-569`（chat.send 内部 final）

同时需在 dispatcher 回调中采集媒体引用（当前只累积文本），以便 final 时有数据可填。

### 2.7 A2UI 事件（Phase 1）

**改动文件**：`src/gateway/server-methods/nodes.handlers.invoke-result.ts`（不是 `server-node-events.ts`，后者处理 `node.event` 分支）

Phase 1：canvas 命令结果中携带事件数组，Gateway 在 `handleNodeInvokeResult`（`nodes.handlers.invoke-result.ts:25-71`，由 `nodes.ts:791` 注册）处理 `node.invoke.result` 返回时广播给相关客户端。

```typescript
// handleNodeInvokeResult 中
if (result.events && Array.isArray(result.events)) {
  for (const event of result.events) {
    broadcastToConnIds("a2ui", event, relatedConnIds);
  }
}
```

Dashboard 前端监听 `a2ui` SSE 事件类型，更新 ArtifactPanel。

**Phase 2（后续）**：Node 推送通道，支持异步实时 A2UI 交互。

---

## 三、Web 端（Dashboard）集成

### 3.1 文件上传流程

```
用户选择/拖放文件
  → 前端 base64 编码（Phase 1）或 multipart 上传（Phase 2）
  → POST /api/chat/send { message, attachments: [{type, mimeType, fileName, content}] }
  → API route 透传给 Gateway chat.send RPC
  → Gateway：
    1. parseMessageWithAttachments() — 解析附件
    2. saveMediaBuffer() — 写磁盘
    3. 填充 MsgContext.MediaPath/MediaPaths
    4. applyMediaUnderstanding() — 视觉/STT/文本提取
    5. dispatchInboundMessage() — Agent 自主处理
  → SSE 广播 agent 事件（含工具调用、审批请求）
  → SSE 广播 chat 事件（含文本回复 + mediaUrl）
```

### 3.2 事件消费

Dashboard 的 SSE hook（`useChatSSE.ts`）除了现有的 `chat` 事件，还需监听：

| 事件类型                  | 用途                    | Dashboard UI                 |
| ------------------------- | ----------------------- | ---------------------------- |
| `chat` (delta/final)      | 文本流式回复 + 媒体 URL | MessageList                  |
| `agent` (tool events)     | 工具调用状态/结果       | ToolUseCard / ToolResultCard |
| `exec.approval.requested` | Agent 请求用户审批      | ApprovalDialog（新组件）     |
| `a2ui` (Phase 1)          | Canvas 交互事件         | ArtifactPanel                |

### 3.3 已完成的前端工作

之前实现的多模态 UI 组件（ContentBlock 模型、MessageInput 文件上传、ImageBlock/FileBlock/ToolUseCard/ToolResultCard/ArtifactPanel）**全部复用**，不需要重写。只需：

1. `useChatSSE.ts` — 增加 `agent` 和 `exec.approval.*` 事件监听
2. `MessageInput.tsx` — 已有文件上传 UI，无需改动
3. ChatPanel — 增加 ApprovalDialog 组件

---

## 四、WeCom 渠道瘦身

核心管线增强后，WeCom 删除以下重复代码：

| 删除位置                              | 行范围  | 替换为                              |
| ------------------------------------- | ------- | ----------------------------------- |
| `handler.ts` `looksLikeTextFile()`    | 80-92   | 核心 `media-understanding/apply.ts` |
| `handler.ts` `analyzeTextHeuristic()` | 94-109  | 同上                                |
| `handler.ts` `buildTextFilePreview()` | 117-123 | 同上                                |
| `handler.ts` MIME extMap              | 493-509 | 核心 `media/mime.ts`                |
| `handler.ts` 媒体错误通知 catch 块    | 570-591 | 核心管线自动处理                    |

**保留 WeCom 专有能力**（不上推）：

- AES-256-CBC 媒体解密
- PendingReplyManager 重试队列
- QuotaTracker 配额追踪
- 企微文档 MCP 集成

**净效果**：WeCom handler.ts 减少 ~80 行，功能不变，后续核心增强自动受益。

---

## 五、静默失败修复

### 全局错误通知策略

所有媒体处理失败（下载失败、MIME 不支持、大小超限、提取异常）统一向用户报告：

```
ctx.Body += "\n[⚠️ 媒体处理: {fileName} — {错误原因}]"
```

**受影响的 catch 块**：

| 文件                                    | 行      | 现状         | 改为              |
| --------------------------------------- | ------- | ------------ | ----------------- |
| `media-understanding/apply.ts`          | 440-444 | verbose 日志 | 注入 ctx.Body     |
| `media-understanding/apply.ts`          | 553-558 | verbose 日志 | 注入 ctx.Body     |
| `media-understanding/runner.entries.ts` | 627-640 | 决策树记录   | 决策树 + ctx.Body |

### Vision 模型回退通知

当用户发送图片但 Agent 模型不支持 vision 时：

```typescript
// src/agents/pi-embedded-runner/run/images.ts
// modelSupportsImages() 返回 false 时
if (!modelSupportsImages(params.model) && existingImages.length > 0) {
  // 不再静默丢弃，而是注入提示
  return {
    images: [],
    warning:
      "当前模型不支持图片分析，图片已忽略。可切换到支持 vision 的模型（如 claude-sonnet-4）。",
  };
}
```

---

## 六、任务拆分

| 任务                                                          | 子系统    | 改动文件                                         | 依赖       |
| ------------------------------------------------------------- | --------- | ------------------------------------------------ | ---------- |
| T1: 核心管线 — 文本预览 + 错误通知 + MIME 增强                | 核心      | `media-understanding/apply.ts`, `media/mime.ts`  | 无         |
| T2: chat.send — MediaPath 填充 + applyMediaUnderstanding 接入 | Gateway   | `server-methods/chat.ts`                         | T1         |
| T3: chat.send — 工具事件广播                                  | Gateway   | `server-chat.ts`                                 | 无         |
| T4: chat.send — 审批事件 scope                                | Gateway   | `server-broadcast.ts`, `message-handler.ts`      | 无         |
| T5: ChatEvent schema + emitChatFinal 媒体字段                 | Gateway   | `protocol/schema/logs-chat.ts`, `server-chat.ts` | 无         |
| T6: A2UI Phase 1 — command result events                      | Gateway   | `server-node-events.ts`                          | 无         |
| T7: Vision 模型回退通知                                       | Agent     | `pi-embedded-runner/run/images.ts`               | 无         |
| T8: WeCom 瘦身 — 删除已上推的代码                             | WeCom     | `extensions/wecom/src/agent/handler.ts`          | T1         |
| T9: Dashboard SSE — 监听 agent/approval/a2ui 事件             | Dashboard | `useChatSSE.ts`, `ChatPanel.tsx`                 | T3, T4, T6 |
| T10: Dashboard — ApprovalDialog 组件                          | Dashboard | 新文件                                           | T4, T9     |

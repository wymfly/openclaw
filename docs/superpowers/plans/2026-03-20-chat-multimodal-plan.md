# Chat Multimodal & Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up multimodal capabilities in the openclaw-deck chat panel — file upload, full content block rendering (image/file/tool_use/tool_result/thinking), and an Artifacts interactive panel for HTML/SVG/Mermaid content.

**Architecture:** Two data paths — SSE stream delivers text-only blocks for real-time typing effect; on `final`, reload from `chat.history` to get full content blocks (tool_use, tool_result, thinking, image). User attachments are base64-encoded and sent via Gateway's existing `chat.send` attachments parameter. Artifacts are detected from `tool_result` content via heuristic matching, rendered in a sandboxed iframe.

**Tech Stack:** React 19, Next.js 15 (App Router), Zustand, next-intl, react-markdown + remark-gfm, Tailwind CSS variables, Base UI components.

**Design Spec:** `docs/superpowers/specs/2026-03-20-chat-multimodal-design.md`

---

## File Structure

| File                                                               | Responsibility                                        | Action                            |
| ------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------- |
| `dashboard/src/stores/chat.ts`                                     | ContentBlock types + ChatMessage + store actions      | Rewrite                           |
| `dashboard/src/components/panels/chat/useChatSSE.ts`               | SSE event → store dispatch + history reload on final  | Rewrite                           |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`               | Panel layout + toUiMessage() + Artifact panel slot    | Modify                            |
| `dashboard/src/components/panels/chat/MessageInput.tsx`            | File selection, base64 encode, send with attachments  | Rewrite                           |
| `dashboard/src/components/panels/chat/MessageList.tsx`             | MessageBubble renders ContentBlock[] by type          | Rewrite                           |
| `dashboard/src/components/panels/chat/blocks/ImageBlock.tsx`       | Inline image thumbnail + lightbox                     | Create                            |
| `dashboard/src/components/panels/chat/blocks/FileBlock.tsx`        | File attachment label (icon + name + size)            | Create                            |
| `dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx`      | Tool call card (emoji + name + collapsed input)       | Create                            |
| `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`   | Tool result (expandable, 8-line fold)                 | Create                            |
| `dashboard/src/components/panels/chat/blocks/ThinkingBlock.tsx`    | Collapsible thinking trace                            | Create (extract from MessageList) |
| `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts` | Heuristic detection from tool_result content          | Create                            |
| `dashboard/src/components/panels/chat/artifacts/ArtifactCard.tsx`  | Artifact preview card in message bubble               | Create                            |
| `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx` | Right-side panel with sandboxed iframe                | Create                            |
| `dashboard/src/app/api/chat/send/route.ts`                         | Accept attachments, relax message required, body size | Modify                            |
| `dashboard/src/i18n/zh.json`                                       | Chinese translations for new UI elements              | Modify                            |
| `dashboard/src/i18n/en.json`                                       | English translations for new UI elements              | Modify                            |
| `src/gateway/chat-attachments.ts`                                  | Remove image-only filter, add ChatFileContent         | Modify                            |

---

### Task 0: Next.js body size + API route attachments

**Context:** Next.js App Router defaults to ~1MB body limit. With 10 files × 5MB × 1.33 (base64 overhead) = ~67MB max. The API route also currently requires `message` to be non-empty, blocking image-only messages.

**Files:**

- Modify: `dashboard/src/app/api/chat/send/route.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Read current route**

Read `dashboard/src/app/api/chat/send/route.ts` to understand the current structure.

- [ ] **Step 2: Add body size config and relax validation**

At the top of the file, after imports, add the Next.js App Router body size configuration:

```typescript
// Next.js App Router: increase body size limit for file attachments
// 10 files × 5MB × 1.33 (base64) ≈ 67MB max
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "70mb",
    },
  },
};
```

Note: In Next.js App Router (not Pages Router), the body parsing is handled differently. If the above doesn't work, the alternative is to use `export const maxDuration = 60;` and handle size in middleware.

Update the request body type to accept `attachments` and make `message` optional:

```typescript
const body = (await request.json()) as {
  message?: string;
  sessionKey?: string;
  thinking?: string;
  idempotencyKey?: string;
  attachments?: Array<{
    type: string;
    mimeType: string;
    fileName: string;
    content: string;
  }>;
};
```

Change the validation from requiring `message` to requiring `message` OR `attachments`:

```typescript
const hasMessage = !!body.message?.trim();
const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0;

if (!hasMessage && !hasAttachments) {
  return Response.json({ error: "message or attachments required" }, { status: 400 });
}
if (!body.sessionKey?.trim()) {
  return Response.json({ error: "sessionKey is required" }, { status: 400 });
}
```

Pass `attachments` through to Gateway:

```typescript
return gatewayRequest("chat.send", {
  sessionKey: body.sessionKey,
  message: body.message ?? "",
  thinking: body.thinking ?? undefined,
  attachments: body.attachments ?? undefined,
  idempotencyKey,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/api/chat/send/route.ts
git commit -m "[enhanced] feat(deck): support attachments in chat send API route"
```

---

### Task 1: Data model rewrite — ContentBlock + ChatMessage + store actions

**Context:** Current `ChatMessage.content` is `string` with separate `toolUse?: ToolUseBlock[]` and `thinking?: string` fields. Rewrite to `content: ContentBlock[]` discriminated union. This is the foundation — all other tasks depend on it.

**Files:**

- Rewrite: `dashboard/src/stores/chat.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Define ContentBlock type**

Replace the existing `ToolUseBlock` type and add `ContentBlock`:

```typescript
// ---------------------------------------------------------------------------
// Content block types (Anthropic-compatible discriminated union)
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; fileName?: string }
  | { type: "file"; data: string; mimeType: string; fileName: string; size?: number }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string | ContentBlock[]; isError?: boolean }
  | { type: "thinking"; text: string };
```

- [ ] **Step 2: Rewrite ChatMessage interface**

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
  timestamp: number;
  streaming?: boolean;
  error?: string;
}
```

- [ ] **Step 3: Rewrite ChatState interface and store**

Replace old actions with new ones. Key changes:

- Remove: `updateStreamingMessage`, `appendThinking`, `appendToolUse`
- Add: `updateStreamingBlocks`, `replaceMessageContent`
- Keep: `addMessage`, `finalizeStreamingMessage`, `setActiveSession`, `setActiveAgent`, `setSessions`, `setMessages`, `clearMessages`, `setIsStreaming`, `setError`

```typescript
interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  activeSessionId: string | null;
  activeAgentId: string | null;
  sessions: SessionInfo[];
  error: string | null;

  addMessage: (message: ChatMessage) => void;
  updateStreamingBlocks: (id: string, blocks: ContentBlock[]) => void;
  replaceMessageContent: (id: string, blocks: ContentBlock[]) => void;
  finalizeStreamingMessage: (id: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  setActiveAgent: (agentId: string | null) => void;
  setSessions: (sessions: SessionInfo[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
}
```

Store implementation for the new actions:

```typescript
updateStreamingBlocks: (id, blocks) =>
  set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, content: blocks } : m)),
  })),

replaceMessageContent: (id, blocks) =>
  set((state) => ({
    messages: state.messages.map((m) => (m.id === id ? { ...m, content: blocks, streaming: false } : m)),
  })),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`

Expected: errors in files that consume the old `content: string` API (MessageList, useChatSSE, ChatPanel, MessageInput). This is expected — those files are rewritten in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/stores/chat.ts
git commit -m "[enhanced] feat(deck): rewrite ChatMessage to ContentBlock[] model"
```

---

### Task 2: SSE hook + history loader rewrite

**Context:** Current `useChatSSE` only extracts text from SSE events. Need to: (1) use `updateStreamingBlocks` instead of `updateStreamingMessage`, (2) on `final` event, call `chat.history` to reload the complete message with all content block types, (3) rewrite `toUiMessage()` in ChatPanel to map all Anthropic block types.

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Rewrite useChatSSE.ts**

The SSE hook has two key changes:

1. Use `updateStreamingBlocks` (pass `[{ type: "text", text }]` instead of plain string)
2. On `final` event, call `reloadLastMessage()` to fetch complete content blocks from history

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useChatStore, type ContentBlock } from "@/stores/chat";

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "error" | "aborted";
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
    timestamp?: number;
  };
  errorMessage?: string;
  stopReason?: string;
};

function extractTextFromMessage(message?: ChatEventPayload["message"]): string {
  if (!message?.content) return "";
  return message.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text!)
    .join("");
}

/** Reload the last assistant message from chat.history to get full content blocks. */
async function reloadLastMessage(
  sessionKey: string,
  messageId: string,
  replaceMessageContent: (id: string, blocks: ContentBlock[]) => void,
) {
  const mapBlock = (block: Record<string, unknown>): ContentBlock => {
    const type = ((block.type as string) ?? "text").toLowerCase();
    if (type === "text") return { type: "text", text: (block.text as string) ?? "" };
    if (type === "image") {
      const source = block.source as Record<string, unknown> | undefined;
      return {
        type: "image",
        data: (source?.data as string) ?? "",
        mimeType: (source?.media_type as string) ?? "",
      };
    }
    if (["tool_use", "toolcall", "tool_call"].includes(type)) {
      return {
        type: "tool_use",
        id: (block.id as string) ?? "",
        name: (block.name as string) ?? "",
        input: (block.input ?? block.arguments ?? {}) as Record<string, unknown>,
      };
    }
    if (["tool_result", "tool_result_error"].includes(type)) {
      return {
        type: "tool_result",
        toolUseId: ((block.tool_use_id ?? block.toolUseId) as string) ?? "",
        content: ((block.content ?? block.output) as string) ?? "",
        isError: block.is_error === true || type === "tool_result_error",
      };
    }
    if (type === "thinking")
      return { type: "thinking", text: ((block.thinking ?? block.text) as string) ?? "" };
    return { type: "text", text: JSON.stringify(block) };
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const params = new URLSearchParams({ sessionKey, limit: "5" });
      const res = await fetch(`/api/chat/history?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { messages?: Array<Record<string, unknown>> };
      const messages = Array.isArray(data) ? data : (data.messages ?? []);
      // Find the last assistant message
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (lastAssistant && Array.isArray(lastAssistant.content)) {
        const blocks = (lastAssistant.content as Record<string, unknown>[]).map(mapBlock);
        replaceMessageContent(messageId, blocks);
      }
      return;
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  // If both attempts fail, keep the streaming text — don't lose content
}

export function useChatSSE() {
  const {
    addMessage,
    updateStreamingBlocks,
    replaceMessageContent,
    finalizeStreamingMessage,
    setIsStreaming,
    setError,
  } = useChatStore();
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const streamingRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("chat", (e) => {
      const payload = JSON.parse(e.data) as ChatEventPayload;

      if (payload.state === "delta") {
        const text = extractTextFromMessage(payload.message);
        if (!streamingRunIdRef.current && payload.runId) {
          streamingRunIdRef.current = payload.runId;
          setIsStreaming(true);
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: payload.message?.timestamp ?? Date.now(),
            streaming: true,
          });
        } else if (streamingRunIdRef.current) {
          updateStreamingBlocks(streamingRunIdRef.current, [{ type: "text", text }]);
        }
        return;
      }

      if (payload.state === "final") {
        const text = extractTextFromMessage(payload.message);
        const runId = streamingRunIdRef.current;
        if (runId) {
          if (text) updateStreamingBlocks(runId, [{ type: "text", text }]);
          finalizeStreamingMessage(runId);
          streamingRunIdRef.current = null;
          // Reload full content blocks from history
          const sessionKey = payload.sessionKey || activeSessionId;
          if (sessionKey) {
            void reloadLastMessage(sessionKey, runId, replaceMessageContent);
          }
        } else if (text && payload.runId) {
          addMessage({
            id: payload.runId,
            role: "assistant",
            content: [{ type: "text", text }],
            timestamp: payload.message?.timestamp ?? Date.now(),
          });
        }
        setIsStreaming(false);
        return;
      }

      if (payload.state === "error") {
        setError(payload.errorMessage ?? "Unknown error");
        if (streamingRunIdRef.current) {
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
        }
        setIsStreaming(false);
        return;
      }

      if (payload.state === "aborted") {
        if (streamingRunIdRef.current) {
          finalizeStreamingMessage(streamingRunIdRef.current);
          streamingRunIdRef.current = null;
        }
        setIsStreaming(false);
      }
    });

    return () => es.close();
  }, [
    addMessage,
    updateStreamingBlocks,
    replaceMessageContent,
    finalizeStreamingMessage,
    setIsStreaming,
    setError,
    activeSessionId,
  ]);
}
```

- [ ] **Step 2: Rewrite toUiMessage() in ChatPanel.tsx**

Replace the existing `GatewayContentBlock`, `GatewayMessage`, and `toUiMessage` function in `ChatPanel.tsx` with the full block mapping:

```typescript
import { type ChatMessage, type ContentBlock } from "@/stores/chat";

// Tool call type aliases (Gateway transcript uses multiple variants)
const TOOL_USE_TYPES = new Set(["tool_use", "toolcall", "tool_call"]);
const TOOL_RESULT_TYPES = new Set(["tool_result", "tool_result_error"]);

type GatewayMessage = { role: string; content: Record<string, unknown>[]; timestamp?: number };

function toUiMessage(msg: GatewayMessage, index: number): ChatMessage {
  const blocks: ContentBlock[] = (msg.content ?? []).map((block) => {
    const type = ((block.type as string) ?? "text").toLowerCase();
    if (type === "text") return { type: "text" as const, text: (block.text as string) ?? "" };
    if (type === "image") {
      const source = block.source as Record<string, unknown> | undefined;
      return {
        type: "image" as const,
        data: (source?.data as string) ?? "",
        mimeType: (source?.media_type as string) ?? "",
      };
    }
    if (TOOL_USE_TYPES.has(type)) {
      return {
        type: "tool_use" as const,
        id: (block.id as string) ?? "",
        name: (block.name as string) ?? "",
        input: (block.input ?? block.arguments ?? {}) as Record<string, unknown>,
      };
    }
    if (TOOL_RESULT_TYPES.has(type)) {
      return {
        type: "tool_result" as const,
        toolUseId: ((block.tool_use_id ?? block.toolUseId) as string) ?? "",
        content: ((block.content ?? block.output) as string) ?? "",
        isError: block.is_error === true || type === "tool_result_error",
      };
    }
    if (type === "thinking")
      return { type: "thinking" as const, text: ((block.thinking ?? block.text) as string) ?? "" };
    return { type: "text" as const, text: JSON.stringify(block) };
  });
  return {
    id: `hist-${index}`,
    role: msg.role as ChatMessage["role"],
    content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
    timestamp: msg.timestamp ?? Date.now(),
  };
}
```

Also update the import to use the new types:

```typescript
import { useChatStore, type ChatMessage, type ContentBlock, type SessionInfo } from "@/stores/chat";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`

Expected: MessageList.tsx and MessageInput.tsx may still error (they still reference `content: string`). This is expected.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/useChatSSE.ts dashboard/src/components/panels/chat/ChatPanel.tsx
git commit -m "[enhanced] feat(deck): SSE dual-path + full content block history mapping"
```

---

### Task 3: Upload pipeline — MessageInput rewrite

**Context:** Current MessageInput has file selection UI (drag/drop + file picker) but `sendMessage()` ignores the `files` state. Rewrite to: (1) validate file size/count, (2) encode files to base64, (3) construct ContentBlock[] for the user message, (4) send attachments via the API.

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace in both locale files:

**zh.json:**

```json
"fileTooLarge": "文件 {name} 超过 5MB 限制",
"tooManyFiles": "最多只能添加 10 个文件",
"uploadFailed": "文件上传失败"
```

**en.json:**

```json
"fileTooLarge": "File {name} exceeds 5MB limit",
"tooManyFiles": "Maximum 10 files allowed",
"uploadFailed": "Upload failed"
```

- [ ] **Step 2: Rewrite MessageInput.tsx**

Key changes:

1. Use `PendingAttachment` type (with id, file, preview, type)
2. Validate file size (≤5MB) and count (≤10) with toast feedback
3. Allow sending when either text or files are present (not just text)
4. On send: encode files to base64, build ContentBlock[], post to API with attachments
5. Show image thumbnails in attachment preview (using `URL.createObjectURL`)

The `sendMessage` function becomes async and does base64 encoding:

```typescript
const sendMessage = useCallback(async () => {
  const text = input.trim();
  if (!text && files.length === 0) return;
  if (isStreaming) return;

  // Build content blocks for local display
  const userContent: ContentBlock[] = [];

  // Encode files to base64 and build attachment payload
  const attachments: Array<{ type: string; mimeType: string; fileName: string; content: string }> =
    [];
  for (const pending of files) {
    const base64 = await fileToBase64(pending.file);
    const mimeType = pending.file.type || "application/octet-stream";
    if (pending.type === "image") {
      userContent.push({ type: "image", data: base64, mimeType, fileName: pending.file.name });
    } else {
      userContent.push({
        type: "file",
        data: base64,
        mimeType,
        fileName: pending.file.name,
        size: pending.file.size,
      });
    }
    attachments.push({
      type: pending.type,
      mimeType,
      fileName: pending.file.name,
      content: base64,
    });
  }
  if (text) {
    userContent.push({ type: "text", text });
  }

  // Optimistic local display
  addMessage({
    id: `user-${Date.now()}`,
    role: "user",
    content: userContent,
    timestamp: Date.now(),
  });
  setInput("");
  setFiles([]);
  // Revoke object URLs
  files.forEach((f) => {
    if (f.preview) URL.revokeObjectURL(f.preview);
  });

  setIsStreaming(true);
  setError(null);

  try {
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text || undefined,
        sessionKey: activeSessionId ?? "agent:main:main",
        agentId: activeAgentId ?? undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("error"));
      setIsStreaming(false);
    }
  } catch {
    setError(t("error"));
    setIsStreaming(false);
  }
}, [
  input,
  files,
  isStreaming,
  activeSessionId,
  activeAgentId,
  addMessage,
  setIsStreaming,
  setError,
  t,
]);
```

Helper function for base64 encoding:

```typescript
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/jpeg;base64,XXXX" → "XXXX"
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

File validation in `handleDrop` and file input `onChange`:

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_COUNT = 10;

const addFiles = (newFiles: File[]) => {
  for (const f of newFiles) {
    if (f.size > MAX_FILE_SIZE) {
      addToast("error", t("fileTooLarge", { name: f.name }));
      return;
    }
  }
  if (files.length + newFiles.length > MAX_FILE_COUNT) {
    addToast("error", t("tooManyFiles"));
    return;
  }
  const pending: PendingAttachment[] = newFiles.map((file) => ({
    id: crypto.randomUUID(),
    file,
    type: file.type.startsWith("image/") ? ("image" as const) : ("file" as const),
    preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
  }));
  setFiles((prev) => [...prev, ...pending]);
};
```

Attachment preview strip — show image thumbnails and file labels:

```typescript
{files.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-2">
    {files.map((f) => (
      <span key={f.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">
        {f.preview && (
          <img src={f.preview} alt={f.file.name} className="w-5 h-5 rounded object-cover" />
        )}
        <span className="truncate max-w-[100px]">{f.file.name}</span>
        <button onClick={() => removeFile(f.id)} className="hover:text-[var(--danger)] transition-colors cursor-pointer" aria-label={`Remove ${f.file.name}`}>
          <X size={10} />
        </button>
      </span>
    ))}
  </div>
)}
```

Update the send button disabled condition:

```typescript
disabled={!input.trim() && files.length === 0}
```

Import `useNotificationsStore` for toast:

```typescript
import { useNotificationsStore } from "@/stores/notifications";
// Inside component:
const addToast = useNotificationsStore((s) => s.addToast);
```

Import `ContentBlock` type:

```typescript
import { useChatStore, type ContentBlock } from "@/stores/chat";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/MessageInput.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): file upload pipeline with base64 encoding and validation"
```

---

### Task 4: Content block rendering — MessageList rewrite

**Context:** Current MessageList renders `message.content` as a string via ReactMarkdown, with separate ThinkingBlock and ToolUseCard sub-components. Rewrite MessageBubble to render `ContentBlock[]` by type, extracting sub-components into `blocks/` directory.

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/MessageList.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ThinkingBlock.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ImageBlock.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/FileBlock.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace in both locale files:

**zh.json:**

```json
"toolCall": "工具调用",
"toolResult": "工具结果",
"toolError": "工具错误",
"showMore": "展开全部",
"showLess": "收起",
"imagePreview": "图片预览",
"download": "下载",
"artifact": "交互内容",
"openArtifact": "打开"
```

**en.json:**

```json
"toolCall": "Tool Call",
"toolResult": "Tool Result",
"toolError": "Tool Error",
"showMore": "Show more",
"showLess": "Show less",
"imagePreview": "Image preview",
"download": "Download",
"artifact": "Interactive Content",
"openArtifact": "Open"
```

- [ ] **Step 2: Create blocks/ThinkingBlock.tsx**

Extract from current MessageList.tsx (lines 15-28), keeping the same design:

```tsx
"use client";
import { Brain } from "lucide-react";
import { useTranslations } from "next-intl";

export function ThinkingBlock({ text }: { text: string }) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs group/thinking">
      <summary className="flex items-center gap-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        <Brain size={12} />
        <span>{t("thinking")}</span>
      </summary>
      <pre className="mt-1.5 p-2.5 rounded-lg text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
        {text}
      </pre>
    </details>
  );
}
```

- [ ] **Step 3: Create blocks/ImageBlock.tsx**

Inline image with click-to-enlarge lightbox:

```tsx
"use client";
import { useState } from "react";

interface ImageBlockProps {
  data: string;
  mimeType: string;
  fileName?: string;
}

export function ImageBlock({ data, mimeType, fileName }: ImageBlockProps) {
  const [enlarged, setEnlarged] = useState(false);
  const src = `data:${mimeType};base64,${data}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        className="block rounded-lg overflow-hidden ring-1 ring-[var(--border-subtle)] hover:ring-[var(--accent)]/30 transition-all cursor-pointer max-w-[240px]"
      >
        <img
          src={src}
          alt={fileName ?? "image"}
          className="max-h-[200px] object-contain"
          loading="lazy"
        />
      </button>

      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 cursor-pointer"
          onClick={() => setEnlarged(false)}
        >
          <img
            src={src}
            alt={fileName ?? "image"}
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Create blocks/FileBlock.tsx**

File attachment label with download:

```tsx
"use client";
import { File as FileIcon, Download } from "lucide-react";
import { useTranslations } from "next-intl";

interface FileBlockProps {
  data: string;
  mimeType: string;
  fileName: string;
  size?: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBlock({ data, mimeType, fileName, size }: FileBlockProps) {
  const t = useTranslations("chat");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${data}`;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)] text-xs">
      <FileIcon size={14} className="text-[var(--text-secondary)] shrink-0" />
      <div className="min-w-0">
        <span className="font-medium text-[var(--text-primary)] truncate block">{fileName}</span>
        {size != null && <span className="text-[var(--text-secondary)]">{formatSize(size)}</span>}
      </div>
      <button
        onClick={handleDownload}
        className="shrink-0 text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors cursor-pointer"
        title={t("download")}
      >
        <Download size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create blocks/ToolUseCard.tsx**

```tsx
"use client";
import { Wrench } from "lucide-react";
import { useTranslations } from "next-intl";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
}

export function ToolUseCard({ name, input }: ToolUseCardProps) {
  const t = useTranslations("chat");
  return (
    <details className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
        <Wrench size={12} className="shrink-0" />
        <span className="font-medium">{t("toolCall")}:</span>
        <code className="font-mono text-[var(--accent)]">{name}</code>
      </summary>
      <div className="px-2.5 pb-2.5 border-t border-[var(--border-subtle)]">
        <pre className="mt-1.5 p-2 rounded-lg text-xs overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {JSON.stringify(input, null, 2)}
        </pre>
      </div>
    </details>
  );
}
```

- [ ] **Step 6: Create blocks/ToolResultCard.tsx**

Tool result with 8-line fold (matches macOS app pattern):

```tsx
"use client";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToolResultCardProps {
  content: string;
  isError?: boolean;
}

const MAX_PREVIEW_LINES = 8;

export function ToolResultCard({ content, isError }: ToolResultCardProps) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);

  const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const lines = contentStr.split("\n");
  const needsFold = lines.length > MAX_PREVIEW_LINES;
  const displayContent =
    needsFold && !expanded ? lines.slice(0, MAX_PREVIEW_LINES).join("\n") + "\n..." : contentStr;

  return (
    <div
      className={cn(
        "my-1.5 text-xs rounded-lg border overflow-hidden",
        isError ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5",
          isError
            ? "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
        )}
      >
        {isError ? <X size={12} /> : <Check size={12} />}
        <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
      </div>
      <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] max-h-[300px]">
        {displayContent}
      </pre>
      {needsFold && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full px-2.5 py-1 text-xs text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer border-t border-[var(--border-subtle)]"
        >
          {expanded ? t("showLess") : t("showMore")}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Rewrite MessageList.tsx**

The `MessageBubble` component now groups ContentBlocks by type:

```tsx
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  // Group content blocks by type
  const thinkingBlocks = message.content.filter((b): b is ContentBlock & { type: "thinking" } => b.type === "thinking");
  const imageBlocks = message.content.filter((b): b is ContentBlock & { type: "image" } => b.type === "image");
  const fileBlocks = message.content.filter((b): b is ContentBlock & { type: "file" } => b.type === "file");
  const textBlocks = message.content.filter((b): b is ContentBlock & { type: "text" } => b.type === "text");
  const toolUseBlocks = message.content.filter((b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use");
  const toolResultBlocks = message.content.filter((b): b is ContentBlock & { type: "tool_result" } => b.type === "tool_result");

  const combinedText = textBlocks.map((b) => b.text).join("\n");

  return (
    <div className={cn("flex gap-3 mb-5", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      ...same as current...

      {/* Content column */}
      <div className={cn("flex flex-col max-w-[75%] min-w-0", isUser ? "items-end" : "items-start")}>
        {/* Thinking */}
        {thinkingBlocks.map((b, i) => <ThinkingBlock key={`think-${i}`} text={b.text} />)}

        {/* Attachments (images + files) */}
        {(imageBlocks.length > 0 || fileBlocks.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-1.5">
            {imageBlocks.map((b, i) => <ImageBlock key={`img-${i}`} data={b.data} mimeType={b.mimeType} fileName={b.fileName} />)}
            {fileBlocks.map((b, i) => <FileBlock key={`file-${i}`} data={b.data} mimeType={b.mimeType} fileName={b.fileName} size={b.size} />)}
          </div>
        )}

        {/* Text bubble */}
        {combinedText && (
          <div className={cn("px-3.5 py-2.5 text-sm leading-relaxed", ...same bubble styles...)}>
            {isUser ? (
              <p className="whitespace-pre-wrap">{combinedText}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none ...">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{combinedText}</ReactMarkdown>
              </div>
            )}
            {message.streaming && <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm bg-current opacity-70" />}
          </div>
        )}

        {/* Tool use cards */}
        {toolUseBlocks.map((b, i) => <ToolUseCard key={`tool-${i}`} name={b.name} input={b.input} />)}

        {/* Tool result cards */}
        {toolResultBlocks.map((b, i) => <ToolResultCard key={`result-${i}`} content={typeof b.content === "string" ? b.content : JSON.stringify(b.content)} isError={b.isError} />)}

        {/* Error + Timestamp ... same as current */}
      </div>
    </div>
  );
}
```

Import the new block components:

```typescript
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ImageBlock } from "./blocks/ImageBlock";
import { FileBlock } from "./blocks/FileBlock";
import { ToolUseCard } from "./blocks/ToolUseCard";
import { ToolResultCard } from "./blocks/ToolResultCard";
```

Update imports from store:

```typescript
import { useChatStore, type ChatMessage, type ContentBlock } from "@/stores/chat";
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/components/panels/chat/MessageList.tsx dashboard/src/components/panels/chat/blocks/ dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): content block rendering — image, file, tool use/result, thinking"
```

---

### Task 5: Artifacts panel

**Context:** Detect HTML/SVG/Mermaid content from tool_result blocks and render in a sandboxed iframe panel beside the chat.

**Files:**

- Create: `dashboard/src/components/panels/chat/artifacts/detectArtifact.ts`
- Create: `dashboard/src/components/panels/chat/artifacts/ArtifactCard.tsx`
- Create: `dashboard/src/components/panels/chat/artifacts/ArtifactPanel.tsx`
- Modify: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx` (add artifact detection)
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx` (add ArtifactPanel slot)
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace:

**zh.json:**

```json
"artifactClose": "关闭",
"artifactCopy": "复制代码",
"artifactCopied": "已复制",
"artifactFullscreen": "全屏",
"artifactTitle": "交互内容"
```

**en.json:**

```json
"artifactClose": "Close",
"artifactCopy": "Copy Code",
"artifactCopied": "Copied",
"artifactFullscreen": "Fullscreen",
"artifactTitle": "Interactive Content"
```

- [ ] **Step 2: Create detectArtifact.ts**

````typescript
export interface ArtifactInfo {
  id: string;
  title: string;
  language: "html" | "mermaid" | "svg" | "text";
  content: string;
}

let artifactCounter = 0;

export function detectArtifact(content: string): ArtifactInfo | null {
  if (typeof content !== "string" || content.length < 20) return null;

  // 1. HTML content
  if (/<html|<body|<!doctype/i.test(content)) {
    const titleMatch = /<title>(.*?)<\/title>/i.exec(content);
    return {
      id: `artifact-${++artifactCounter}`,
      title: titleMatch?.[1] ?? "HTML",
      language: "html",
      content,
    };
  }

  // 2. SVG content
  if (content.trimStart().startsWith("<svg")) {
    return { id: `artifact-${++artifactCounter}`, title: "SVG", language: "svg", content };
  }

  // 3. Mermaid diagram
  const mermaidMatch = /```mermaid\n([\s\S]+?)```/.exec(content);
  if (mermaidMatch) {
    return {
      id: `artifact-${++artifactCounter}`,
      title: "Diagram",
      language: "mermaid",
      content: mermaidMatch[1],
    };
  }

  return null;
}
````

- [ ] **Step 3: Create ArtifactCard.tsx**

```tsx
"use client";
import { Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactCardProps {
  artifact: ArtifactInfo;
  onOpen: (artifact: ArtifactInfo) => void;
}

export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
  const t = useTranslations("chat");
  return (
    <div className="my-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/20 text-xs">
      <Play size={14} className="text-[var(--accent)] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-[var(--text-primary)]">{artifact.title}</span>
        <span className="ml-2 text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">
          {artifact.language}
        </span>
      </div>
      <Button
        size="xs"
        variant="outline"
        className="shrink-0 cursor-pointer"
        onClick={() => onOpen(artifact)}
      >
        {t("openArtifact")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Create ArtifactPanel.tsx**

The right-side panel that renders artifact content in a sandboxed iframe:

```tsx
"use client";
import { Copy, Check, X, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ArtifactInfo } from "./detectArtifact";

interface ArtifactPanelProps {
  artifact: ArtifactInfo;
  onClose: () => void;
}

function buildSrcdoc(artifact: ArtifactInfo): string {
  switch (artifact.language) {
    case "html":
      return artifact.content;
    case "svg":
      return `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${artifact.content}</body></html>`;
    case "mermaid":
      return `<!DOCTYPE html><html><head><script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script></head><body><pre class="mermaid">${artifact.content.replace(/</g, "&lt;")}</pre><script>mermaid.initialize({startOnLoad:true,theme:'default'});</script></body></html>`;
    default:
      return `<!DOCTYPE html><html><body><pre style="margin:16px;font-family:monospace;white-space:pre-wrap">${artifact.content.replace(/</g, "&lt;")}</pre></body></html>`;
  }
}

export function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const srcdoc = useMemo(() => buildSrcdoc(artifact), [artifact]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex flex-col border-l border-[var(--border)] bg-[var(--bg-secondary)]",
        fullscreen ? "fixed inset-0 z-50" : "w-1/2",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0">
        <span className="flex-1 text-xs font-medium text-[var(--text-primary)] truncate">
          {artifact.title}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
          {artifact.language}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={handleCopy}
          title={t("artifactCopy")}
          className="cursor-pointer"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setFullscreen(!fullscreen)}
          title={t("artifactFullscreen")}
          className="cursor-pointer"
        >
          <Maximize2 size={12} />
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onClose}
          title={t("artifactClose")}
          className="cursor-pointer"
        >
          <X size={12} />
        </Button>
      </div>

      {/* Sandboxed iframe */}
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="flex-1 w-full border-0"
        title={artifact.title}
      />
    </div>
  );
}
```

Import `cn`:

```typescript
import { cn } from "@/lib/utils";
```

- [ ] **Step 5: Update ToolResultCard to detect and show ArtifactCard**

Add artifact detection to `ToolResultCard`:

```typescript
import { detectArtifact } from "../artifacts/detectArtifact";
import { ArtifactCard } from "../artifacts/ArtifactCard";

// Add onOpenArtifact prop
interface ToolResultCardProps {
  content: string;
  isError?: boolean;
  onOpenArtifact?: (artifact: ArtifactInfo) => void;
}

// Inside the component, after existing rendering:
const artifact = !isError ? detectArtifact(contentStr) : null;

// Render ArtifactCard if detected:
{artifact && onOpenArtifact && (
  <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />
)}
```

- [ ] **Step 6: Update ChatPanel layout for ArtifactPanel**

Add artifact state and ArtifactPanel to ChatPanel:

```typescript
import { useState } from "react";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";

// Inside ChatPanel:
const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);

// Pass artifact handler down through MessageList → ToolResultCard
// (via React context or prop drilling — prop drilling is simpler for MVP)

// Layout changes:
<div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
  {/* Sidebar — hide when artifact is open */}
  {!isCompact && !activeArtifact && <SessionSidebar />}

  {/* Chat area */}
  <div className="flex flex-col flex-1 min-w-0">
    ...existing content...
  </div>

  {/* Artifact panel */}
  {activeArtifact && (
    <ArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
  )}
</div>
```

To pass `onOpenArtifact` down, add it as a prop on MessageList and MessageBubble, or use a simple React context. For MVP, context is cleanest:

```typescript
// In ChatPanel or a new file:
export const ArtifactContext = React.createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
}>({ onOpenArtifact: () => {} });

// Wrap MessageList with provider:
<ArtifactContext.Provider value={{ onOpenArtifact: setActiveArtifact }}>
  <MessageList />
</ArtifactContext.Provider>

// In ToolResultCard, consume:
const { onOpenArtifact } = useContext(ArtifactContext);
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/panels/chat/artifacts/ dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): Artifacts panel with HTML/SVG/Mermaid iframe rendering"
```

---

### Task 6: Gateway file support

**Context:** `src/gateway/chat-attachments.ts` currently drops non-image attachments with a warning. Remove this restriction to allow file attachments (PDF, text, etc.) through to the model.

**Files:**

- Modify: `src/gateway/chat-attachments.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Read current implementation**

Read `src/gateway/chat-attachments.ts` lines 97-145 — the `parseMessageWithAttachments()` function.

- [ ] **Step 2: Add ChatFileContent type**

After the existing `ChatImageContent` type:

```typescript
export type ChatFileContent = {
  type: "file";
  data: string;
  mimeType: string;
  fileName: string;
};
```

Update the return type:

```typescript
export type ParsedMessageWithAttachments = {
  message: string;
  images: ChatImageContent[];
  files: ChatFileContent[];
};
```

- [ ] **Step 3: Modify parseMessageWithAttachments**

Instead of dropping non-image attachments, collect them as `ChatFileContent`:

In the loop where `sniffedMime` is checked:

- If it IS an image → push to `images[]` (same as current)
- If it is NOT an image → push to `files[]` with `{ type: "file", data: b64, mimeType, fileName }`
- Add the file name to the message text as context: `\n[Attached file: ${fileName} (${mimeType})]`

```typescript
if (sniffedMime && isImageMime(sniffedMime)) {
  images.push({ type: "image", data: b64, mimeType: sniffedMime ?? providedMime ?? mime });
} else {
  // Non-image file: keep it for model context
  const fileName = att.fileName ?? label;
  files.push({ type: "file", data: b64, mimeType: sniffedMime ?? providedMime ?? mime, fileName });
  // Append file reference to message for model awareness
  message += `\n[Attached file: ${fileName} (${sniffedMime ?? providedMime ?? mime})]`;
}
```

- [ ] **Step 4: Update callers**

In `src/gateway/server-methods/chat.ts`, the call to `parseMessageWithAttachments` currently destructures `{ message, images }`. Update to also capture `files`:

```typescript
const { message: parsedMessage, images: parsedImages, files: parsedFiles } = await parseMessageWithAttachments(...);
```

The `files` array is informational for now — it goes into the message text. Future work can pass `files` to tool dispatchers.

- [ ] **Step 5: Update tests**

In `src/gateway/chat-attachments.test.ts`, add a test for non-image file pass-through:

```typescript
it("keeps non-image attachments as files instead of dropping", async () => {
  const result = await parseMessageWithAttachments("hello", [
    { mimeType: "application/pdf", fileName: "doc.pdf", content: validBase64 },
  ]);
  expect(result.files).toHaveLength(1);
  expect(result.files[0].fileName).toBe("doc.pdf");
  expect(result.message).toContain("[Attached file: doc.pdf");
});
```

- [ ] **Step 6: Verify tests pass**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test src/gateway/chat-attachments.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/gateway/chat-attachments.ts src/gateway/server-methods/chat.ts src/gateway/chat-attachments.test.ts
git commit -m "[enhanced] feat(gateway): support non-image file attachments in chat"
```

---

## Verification

After all tasks, verify:

1. `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit` — zero errors
2. `cd /Users/wangym/workspace/agents/openclaw && pnpm test src/gateway/chat-attachments.test.ts` — pass
3. Browser test: open Chat panel, verify:
   - Drag/drop or select image → shows thumbnail in attachment strip → send → image appears in user bubble
   - Select non-image file → shows file label → send → file block appears in user bubble
   - Assistant response with tool_use/tool_result → shows ToolUseCard + ToolResultCard
   - Tool result with HTML content → shows ArtifactCard → click opens ArtifactPanel with iframe
   - History messages load with all content block types
   - Streaming text works as before (typing effect)

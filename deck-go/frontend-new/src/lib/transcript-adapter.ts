import type {
  SessionMessageEventPayload,
  TranscriptMessage,
} from "@/generated/gateway-protocol.generated";
import { extractCanvasShortcodes } from "@/lib/embed-parser";
import type { ChatMessage, ContentBlock } from "@/stores/chat-types";

type TranscriptRecord = TranscriptMessage | Record<string, unknown>;
type SessionMessagePayloadRecord =
  | SessionMessageEventPayload
  | {
      sessionKey: string;
      message?: Record<string, unknown>;
      messageId?: string;
      messageSeq?: number;
      [key: string]: unknown;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeToolInput(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isRecord(parsed)) {
        return parsed;
      }
      return { value: parsed };
    } catch {
      return { raw: value };
    }
  }
  if (isRecord(value)) {
    return value;
  }
  if (value === undefined) {
    return {};
  }
  return { value };
}

function summarizeUnknownValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }
  if (isRecord(value)) {
    return "[object]";
  }
  return JSON.stringify(value) ?? "unknown";
}

function normalizeUnknownBlock(
  raw: Record<string, unknown>,
): Extract<ContentBlock, { type: "unknown" }> {
  if (raw.type === "unknown" && typeof raw.rawType === "string" && isRecord(raw.summary)) {
    return {
      type: "unknown",
      rawType: raw.rawType,
      summary: raw.summary,
    };
  }
  const summary = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, summarizeUnknownValue(value)]),
  );
  return {
    type: "unknown",
    rawType: typeof raw.type === "string" ? raw.type : "unknown",
    summary,
  };
}

function normalizeCanvasBlock(
  raw: Record<string, unknown>,
): Extract<ContentBlock, { type: "canvas" }> | null {
  const preview = isRecord(raw.preview) ? raw.preview : undefined;
  const url =
    typeof raw.url === "string" ? raw.url : typeof preview?.url === "string" ? preview.url : null;
  const render = raw.render === "url" || preview?.render === "url" || url ? "url" : undefined;
  const surface =
    raw.surface === "assistant_message" || preview?.surface === "assistant_message"
      ? "assistant_message"
      : undefined;
  if (!url || render !== "url") {
    return null;
  }
  return {
    type: "canvas",
    kind: "canvas",
    surface: surface ?? "assistant_message",
    render: "url",
    url,
    ...(typeof raw.viewId === "string"
      ? { viewId: raw.viewId }
      : typeof preview?.viewId === "string"
        ? { viewId: preview.viewId }
        : {}),
    ...(typeof raw.title === "string"
      ? { title: raw.title }
      : typeof preview?.title === "string"
        ? { title: preview.title }
        : {}),
    ...(typeof raw.preferredHeight === "number"
      ? { preferredHeight: raw.preferredHeight }
      : typeof preview?.preferredHeight === "number"
        ? { preferredHeight: preview.preferredHeight }
        : {}),
  };
}

function normalizeTextBlock(
  raw: Record<string, unknown>,
): Extract<ContentBlock, { type: "text" }> | null {
  const text =
    typeof raw.text === "string" ? raw.text : typeof raw.content === "string" ? raw.content : null;
  return text == null ? null : { type: "text", text };
}

export function normalizeGatewayUserDisplayText(text: string): string {
  const trimmed = text.trim();
  const withoutSender = trimmed.replace(
    /^Sender \(untrusted metadata\):\s*```json[\s\S]*?```\s*/u,
    "",
  );
  if (withoutSender !== trimmed) {
    return withoutSender.replace(/^\[[^\]]+\]\s*/u, "").trim();
  }
  if (trimmed.startsWith("Sender (untrusted metadata):")) {
    const timestampMatch = trimmed.match(/\[[^\]]+\]\s*([\s\S]*)$/u);
    return timestampMatch?.[1]?.trim() ?? "";
  }
  return trimmed.replace(/^\[[^\]]+\]\s*/u, "").trim();
}

function normalizeUserDisplayContent(content: ContentBlock[]): ContentBlock[] {
  return content.map((block) => {
    if (block.type !== "text") {
      return block;
    }
    return { ...block, text: normalizeGatewayUserDisplayText(block.text) };
  });
}

function normalizeThinkingBlock(
  raw: Record<string, unknown>,
): Extract<ContentBlock, { type: "thinking" }> | null {
  const text =
    typeof raw.text === "string"
      ? raw.text
      : typeof raw.thinking === "string"
        ? raw.thinking
        : typeof raw.reasoning === "string"
          ? raw.reasoning
          : typeof raw.analysis === "string"
            ? raw.analysis
            : null;
  return text == null ? null : { type: "thinking", text };
}

export function normalizeTranscriptToolResultContent(value: unknown): string | ContentBlock[] {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (isRecord(entry)) {
        return normalizeTranscriptBlock(entry);
      }
      return { type: "text", text: String(entry ?? "") } satisfies ContentBlock;
    });
  }
  if (isRecord(value)) {
    const nested = value.content ?? value.result;
    if (nested !== undefined) {
      return normalizeTranscriptToolResultContent(nested);
    }
    return [normalizeTranscriptBlock(value)];
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value) ?? "unknown";
}

export function normalizeTranscriptBlock(raw: Record<string, unknown>): ContentBlock {
  const type = typeof raw.type === "string" ? raw.type : "";

  if (type === "text" || type === "input_text" || type === "output_text") {
    return normalizeTextBlock(raw) ?? normalizeUnknownBlock(raw);
  }

  if (type === "thinking" || type === "reasoning" || type === "analysis") {
    return normalizeThinkingBlock(raw) ?? normalizeUnknownBlock(raw);
  }

  if (type === "toolCall" || type === "tool_use") {
    return {
      type: "tool_use",
      id: typeof raw.id === "string" ? raw.id : "",
      name: typeof raw.name === "string" ? raw.name : "unknown",
      input: normalizeToolInput(raw.arguments ?? raw.input),
    };
  }

  if (type === "tool_result" || type === "toolResult") {
    const toolUseId =
      typeof raw.toolUseId === "string"
        ? raw.toolUseId
        : typeof raw.tool_use_id === "string"
          ? raw.tool_use_id
          : typeof raw.toolCallId === "string"
            ? raw.toolCallId
            : "";
    return {
      type: "tool_result",
      toolUseId,
      content: normalizeTranscriptToolResultContent(raw.content ?? raw.result),
      isError:
        typeof raw.isError === "boolean"
          ? raw.isError
          : typeof raw.is_error === "boolean"
            ? raw.is_error
            : false,
    };
  }

  if (type === "image") {
    const data =
      typeof raw.data === "string"
        ? raw.data
        : isRecord(raw.source) && typeof raw.source.data === "string"
          ? raw.source.data
          : null;
    const mimeType =
      typeof raw.mimeType === "string"
        ? raw.mimeType
        : isRecord(raw.source) && typeof raw.source.media_type === "string"
          ? raw.source.media_type
          : null;
    if (data && mimeType) {
      return {
        type: "image",
        data,
        mimeType,
        ...(typeof raw.fileName === "string" ? { fileName: raw.fileName } : {}),
      };
    }
  }

  if (type === "file") {
    const data =
      typeof raw.data === "string"
        ? raw.data
        : typeof raw.content === "string"
          ? raw.content
          : null;
    const mimeType =
      typeof raw.mimeType === "string"
        ? raw.mimeType
        : typeof raw.mime_type === "string"
          ? raw.mime_type
          : null;
    const fileName =
      typeof raw.fileName === "string"
        ? raw.fileName
        : typeof raw.file_name === "string"
          ? raw.file_name
          : null;
    if (data && mimeType && fileName) {
      return {
        type: "file",
        data,
        mimeType,
        fileName,
        ...(typeof raw.size === "number" ? { size: raw.size } : {}),
      };
    }
  }

  if (type === "canvas") {
    return normalizeCanvasBlock(raw) ?? normalizeUnknownBlock(raw);
  }

  if (type === "unknown") {
    return normalizeUnknownBlock(raw);
  }

  return normalizeUnknownBlock(raw);
}

export function normalizeTranscriptContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return content.map((entry) => {
      if (isRecord(entry)) {
        return normalizeTranscriptBlock(entry);
      }
      return { type: "text", text: String(entry ?? "") } satisfies ContentBlock;
    });
  }
  if (isRecord(content)) {
    return [normalizeTranscriptBlock(content)];
  }
  return [{ type: "text", text: "" }];
}

function resolveMessageId(
  sessionKey: string,
  messageRecord: TranscriptRecord,
  timestamp: number,
  index: number,
  messageId?: string,
  messageSeq?: number,
): string {
  const rawRecord = messageRecord as Record<string, unknown>;
  if (typeof messageId === "string" && messageId) {
    return messageId;
  }
  if (typeof messageRecord.id === "string" && messageRecord.id) {
    return messageRecord.id;
  }
  const metaRecord = isRecord(rawRecord.__openclaw) ? rawRecord.__openclaw : {};
  if (typeof metaRecord.id === "string" && metaRecord.id) {
    return metaRecord.id;
  }
  const seq = typeof messageSeq === "number" ? messageSeq : index;
  return `${sessionKey}:${timestamp}:${seq}`;
}

export function normalizeTranscriptMessage(
  sessionKey: string,
  messageRecord: TranscriptRecord,
  options?: {
    index?: number;
    messageId?: string;
    messageSeq?: number;
  },
): ChatMessage {
  const timestamp =
    typeof messageRecord.timestamp === "number" ? messageRecord.timestamp : Date.now();
  // Detect compaction summary messages from Gateway transcript JSONL.
  // Source: role "compactionSummary" defined in src/types/pi-agent-core.d.ts:6-10
  const isCompaction = messageRecord.role === "compactionSummary";
  const sourceRole = messageRecord.role;
  const role = isCompaction
    ? "system"
    : sourceRole === "toolResult"
      ? "user"
      : ((messageRecord.role as ChatMessage["role"]) ?? "assistant");
  const content = normalizeTranscriptContent(messageRecord.content);
  return {
    id: resolveMessageId(
      sessionKey,
      messageRecord,
      timestamp,
      options?.index ?? 0,
      options?.messageId,
      options?.messageSeq,
    ),
    role,
    content: sourceRole === "user" ? normalizeUserDisplayContent(content) : content,
    timestamp,
    ...(isCompaction ? { isCompaction: true } : {}),
  };
}

export function mergeToolMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let pendingToolBlocks: ContentBlock[] = [];
  let pendingToolIds: string[] = [];

  for (const message of messages) {
    const hasToolUse = message.content.some((block) => block.type === "tool_use");

    if (message.role === "assistant" && hasToolUse) {
      for (const block of message.content) {
        pendingToolBlocks.push(block);
        if (block.type === "tool_use") {
          pendingToolIds.push(block.id);
        }
      }
      continue;
    }

    if (message.role === "user" && pendingToolIds.length > 0) {
      const toolId = pendingToolIds.shift()!;
      for (const block of message.content) {
        if (block.type === "text") {
          pendingToolBlocks.push({
            type: "tool_result",
            toolUseId: toolId,
            content: block.text,
            isError:
              block.text.startsWith('{ "status": "error"') ||
              block.text.startsWith('{"status":"error"'),
          });
          continue;
        }
        if (block.type === "tool_result" || block.type === "unknown") {
          pendingToolBlocks.push(block);
        }
      }
      continue;
    }

    if (pendingToolBlocks.length > 0 && message.role === "assistant") {
      result.push({
        ...message,
        content: [...pendingToolBlocks, ...message.content],
      });
      pendingToolBlocks = [];
      pendingToolIds = [];
      continue;
    }

    if (pendingToolBlocks.length > 0) {
      result.push({
        id: `${message.id}-tools`,
        role: "assistant",
        content: pendingToolBlocks,
        timestamp: message.timestamp,
      });
      pendingToolBlocks = [];
      pendingToolIds = [];
    }
    result.push(message);
  }

  if (pendingToolBlocks.length > 0) {
    const lastTs = messages[messages.length - 1]?.timestamp ?? Date.now();
    result.push({
      id: `orphan-tools-${lastTs}`,
      role: "assistant",
      content: pendingToolBlocks,
      timestamp: lastTs,
    });
  }

  return result;
}

/**
 * Expand `[embed ...]` shortcodes inside assistant text blocks into
 * structured `canvas` ContentBlocks.  Only applied to completed messages
 * (transcript history), not to streaming increments.
 */
function expandEmbedShortcodes(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant" || msg.streaming) {
      return msg;
    }
    let changed = false;
    const expanded: ContentBlock[] = [];
    for (const block of msg.content) {
      if (block.type !== "text") {
        expanded.push(block);
        continue;
      }
      const { text, previews } = extractCanvasShortcodes(block.text);
      if (previews.length === 0) {
        expanded.push(block);
        continue;
      }
      changed = true;
      if (text.trim()) {
        expanded.push({ type: "text", text });
      }
      for (const preview of previews) {
        expanded.push(preview);
      }
    }
    return changed ? { ...msg, content: expanded } : msg;
  });
}

export function normalizeTranscriptMessages(
  sessionKey: string,
  rawMessages: TranscriptRecord[],
): ChatMessage[] {
  const normalized = rawMessages.map((message, index) =>
    normalizeTranscriptMessage(sessionKey, message, { index }),
  );
  return expandEmbedShortcodes(mergeToolMessages(normalized));
}

export function normalizeSessionMessagePayload(payload: SessionMessagePayloadRecord): ChatMessage {
  const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
  const messageRecord = isRecord(payload.message)
    ? (payload.message as TranscriptRecord)
    : ({ content: "" } as TranscriptRecord);
  const msg = normalizeTranscriptMessage(sessionKey, messageRecord, {
    messageId: typeof payload.messageId === "string" ? payload.messageId : undefined,
    messageSeq: typeof payload.messageSeq === "number" ? payload.messageSeq : undefined,
  });
  // Expand embeds only for completed (non-streaming) messages
  if (!msg.streaming) {
    const [expanded] = expandEmbedShortcodes([msg]);
    if (expanded) {
      return expanded;
    }
  }
  return msg;
}

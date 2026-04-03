import type { ChatMessage, ContentBlock } from "@/stores/chat-types";

type RawHistoryMessage = {
  role?: string;
  content?: unknown;
  timestamp?: number;
};

function normalizeToolInput(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { value: parsed };
    } catch {
      return { raw: value };
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value === undefined) {
    return {};
  }
  return { value };
}

function normalizeTextBlock(raw: Record<string, unknown>): ContentBlock | null {
  const text =
    typeof raw.text === "string"
      ? raw.text
      : typeof raw.content === "string"
        ? raw.content
        : null;
  return text == null ? null : { type: "text", text };
}

function normalizeThinkingBlock(raw: Record<string, unknown>): ContentBlock | null {
  const text =
    typeof raw.text === "string"
      ? raw.text
      : typeof raw.thinking === "string"
        ? raw.thinking
        : typeof raw.reasoning === "string"
          ? raw.reasoning
          : null;
  return text == null ? null : { type: "thinking", text };
}

function normalizeToolResultContent(value: unknown): string | ContentBlock[] {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const blocks = value
      .map((entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? normalizeHistoryBlock(entry as Record<string, unknown>)
          : null,
      )
      .filter((entry): entry is ContentBlock => entry != null);
    return blocks.length > 0 ? blocks : JSON.stringify(value);
  }
  if (value && typeof value === "object") {
    const block = normalizeHistoryBlock(value as Record<string, unknown>);
    return block ? [block] : JSON.stringify(value);
  }
  if (value == null) {
    return "";
  }
  return String(value);
}

function normalizeHistoryBlock(raw: Record<string, unknown>): ContentBlock | null {
  const type = typeof raw.type === "string" ? raw.type : "";

  if (type === "text" || type === "input_text" || type === "output_text") {
    return normalizeTextBlock(raw);
  }

  if (type === "thinking") {
    return normalizeThinkingBlock(raw);
  }

  if (type === "toolCall" || type === "tool_use") {
    return {
      type: "tool_use",
      id: (raw.id as string) ?? "",
      name: (raw.name as string) ?? "unknown",
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
      content: normalizeToolResultContent(raw.content ?? raw.result),
      isError:
        typeof raw.isError === "boolean"
          ? raw.isError
          : typeof raw.is_error === "boolean"
            ? raw.is_error
            : false,
    };
  }

  if (
    type === "image" &&
    typeof raw.data === "string" &&
    typeof raw.mimeType === "string"
  ) {
    return {
      type: "image",
      data: raw.data,
      mimeType: raw.mimeType,
      ...(typeof raw.fileName === "string" ? { fileName: raw.fileName } : {}),
    };
  }

  if (
    type === "file" &&
    typeof raw.data === "string" &&
    typeof raw.mimeType === "string" &&
    typeof raw.fileName === "string"
  ) {
    return {
      type: "file",
      data: raw.data,
      mimeType: raw.mimeType,
      fileName: raw.fileName,
      ...(typeof raw.size === "number" ? { size: raw.size } : {}),
    };
  }

  return null;
}

export function normalizeHistoryContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return (content as unknown[]).map((raw) => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return normalizeHistoryBlock(raw as Record<string, unknown>) ?? (raw as ContentBlock);
      }
      return { type: "text", text: String(raw ?? "") } satisfies ContentBlock;
    });
  }
  if (content && typeof content === "object") {
    const normalized = normalizeHistoryBlock(content as Record<string, unknown>);
    if (normalized) {
      return [normalized];
    }
    return [{ type: "text", text: JSON.stringify(content) }];
  }
  return [{ type: "text", text: "" }];
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
          const text = block.text;
          pendingToolBlocks.push({
            type: "tool_result",
            toolUseId: toolId,
            content: text,
            isError: text.startsWith('{ "status": "error"') || text.startsWith('{"status":"error"'),
          });
          continue;
        }
        if (block.type === "tool_result") {
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

export function normalizeHistoryMessages(
  sessionKey: string,
  rawMessages: RawHistoryMessage[],
): ChatMessage[] {
  const normalized = rawMessages.map((message, index) => {
    const timestamp = message.timestamp ?? Date.now();
    const role =
      message.role === "toolResult"
        ? "user"
        : ((message.role as ChatMessage["role"]) ?? "assistant");
    return {
      id: `${sessionKey}:${timestamp}:${index}`,
      role,
      content: normalizeHistoryContent(message.content),
      timestamp,
    } satisfies ChatMessage;
  });
  return mergeToolMessages(normalized);
}

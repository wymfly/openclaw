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

export function normalizeHistoryContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[]).map((raw) => {
      if (raw.type === "toolCall") {
        return {
          type: "tool_use",
          id: (raw.id as string) ?? "",
          name: (raw.name as string) ?? "unknown",
          input: normalizeToolInput(raw.arguments ?? raw.input),
        } satisfies ContentBlock;
      }
      if (raw.type === "tool_result" && raw.tool_use_id && !raw.toolUseId) {
        return {
          type: "tool_result",
          toolUseId: raw.tool_use_id as string,
          content: (raw.content as string) ?? "",
          isError: (raw.isError as boolean) ?? false,
        } satisfies ContentBlock;
      }
      return raw as ContentBlock;
    });
  }
  if (content && typeof content === "object") {
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

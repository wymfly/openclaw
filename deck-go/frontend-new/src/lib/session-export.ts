import type {
  DeckGoSessionMeta,
  DeckGoTranscriptBlock,
  DeckGoTranscriptMessage,
} from "../../../contracts/generated/ts/deck-api.generated";

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return "";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable payload]";
  }
}

export function transcriptBlockToPlainText(block: DeckGoTranscriptBlock): string {
  switch (block.type) {
    case "text":
    case "thinking":
      return block.text ?? "";
    case "tool_use":
      return [block.name, stringifyValue(block.input)].filter(Boolean).join("\n");
    case "tool_result":
      return stringifyValue(block.content);
    case "image":
    case "file":
      return [block.fileName, block.mimeType, block.size].filter(Boolean).join(" ");
    default:
      return (
        block.text ||
        block.title ||
        stringifyValue({
          content: block.content,
          data: block.data,
          input: block.input,
          summary: block.summary,
          url: block.url,
        })
      );
  }
}

export function transcriptMessageToPlainText(message: DeckGoTranscriptMessage): string {
  return (message.content ?? [])
    .map((block) => transcriptBlockToPlainText(block))
    .filter(Boolean)
    .join("\n");
}

export function findTranscriptMatches(
  messages: DeckGoTranscriptMessage[],
  query: string,
): number[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return messages
    .map((message, index) =>
      transcriptMessageToPlainText(message).toLowerCase().includes(normalized) ? index : -1,
    )
    .filter((index) => index !== -1);
}

export function buildSessionExportJson(
  session: DeckGoSessionMeta,
  messages: DeckGoTranscriptMessage[],
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      messages,
      session: {
        agentId: session.agentId,
        compactionCount: session.compactionCount,
        endedAt: session.endedAt,
        key: session.key,
        model: session.model,
        modelProvider: session.modelProvider,
        runtimeMs: session.runtimeMs,
        startedAt: session.startedAt,
        status: session.status,
        title: session.title,
        updatedAt: session.updatedAt,
      },
    },
    null,
    2,
  );
}

export function buildSessionExportMarkdown(
  session: DeckGoSessionMeta,
  messages: DeckGoTranscriptMessage[],
): string {
  const lines: string[] = [];
  lines.push(`# Session: ${session.title || session.key}`);
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- Key: ${session.key}`);
  lines.push(`- Agent: ${session.agentId || "n/a"}`);
  lines.push(`- Status: ${session.status || "unknown"}`);
  lines.push(`- Model: ${session.model || "n/a"}`);
  lines.push(`- Provider: ${session.modelProvider || "n/a"}`);
  lines.push(`- Updated: ${session.updatedAt ? new Date(session.updatedAt).toISOString() : "n/a"}`);
  lines.push(`- Compactions: ${session.compactionCount ?? 0}`);
  lines.push("");

  if (messages.length > 0) {
    lines.push("## Messages");
    lines.push("");
    for (const message of messages) {
      const role = message.role || "unknown";
      lines.push(`### ${role} · ${message.id || "message"}`);
      if (message.timestamp) {
        lines.push(`_${new Date(message.timestamp).toISOString()}_`);
        lines.push("");
      }
      lines.push(transcriptMessageToPlainText(message) || "(empty)");
      lines.push("");
    }
  }

  return lines.join("\n");
}

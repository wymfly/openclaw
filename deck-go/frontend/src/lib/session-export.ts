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
  // DeckGoTranscriptBlock is a discriminated union; the switch must cover all
  // 8 variants (text / image / file / tool_use / tool_result / thinking /
  // canvas / unknown). TypeScript narrows `block` per case, so each branch
  // sees only the fields that variant carries.
  switch (block.type) {
    case "text":
    case "thinking":
      return block.text ?? "";
    case "tool_use":
      return [block.name, stringifyValue(block.input)].filter(Boolean).join("\n");
    case "tool_result":
      return stringifyValue(block.content);
    case "image":
      return [block.fileName, block.mimeType].filter(Boolean).join(" ");
    case "file":
      return [block.fileName, block.mimeType, block.size]
        .filter((value) => value !== undefined && value !== "")
        .join(" ");
    case "canvas":
      return [block.title, block.url].filter(Boolean).join(" ");
    case "unknown":
      return stringifyValue({ rawType: block.rawType, summary: block.summary });
    default:
      // Exhaustive switch — `block` narrows to `never` here.
      return "";
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

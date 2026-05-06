import type { TranscriptBlock } from "./protocol/schema/transcript.js";

type TranscriptRecord = Record<string, unknown>;
const UNKNOWN_SUMMARY_STRING_LIMIT = 160;

function asRecord(value: unknown): TranscriptRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as TranscriptRecord)
    : null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function summarizeUnknownValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > UNKNOWN_SUMMARY_STRING_LIMIT
      ? `${value.slice(0, UNKNOWN_SUMMARY_STRING_LIMIT - 3)}...`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }
  if (value && typeof value === "object") {
    return "[object]";
  }
  if (typeof value === "symbol") {
    return value.description ?? value.toString();
  }
  if (typeof value === "function") {
    return `[function:${value.name || "anonymous"}]`;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

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

function normalizeTextBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const text = firstString(raw.text, raw.content);
  return text === undefined ? null : { type: "text", text };
}

function normalizeThinkingBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const text = firstString(raw.text, raw.thinking, raw.reasoning, raw.analysis);
  return text === undefined ? null : { type: "thinking", text };
}

function normalizeToolUseBlock(raw: TranscriptRecord): TranscriptBlock {
  return {
    type: "tool_use",
    id: firstString(raw.id, raw.toolCallId, raw.tool_use_id) ?? "",
    name: firstString(raw.name, raw.tool, raw.title) ?? "unknown",
    input: normalizeToolInput(raw.arguments ?? raw.input),
  };
}

function normalizeImageBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const directData = firstString(raw.data);
  const directMimeType = firstString(raw.mimeType, raw.mediaType);
  if (directData !== undefined && directMimeType !== undefined) {
    return {
      type: "image",
      data: directData,
      mimeType: directMimeType,
      ...(typeof raw.fileName === "string" ? { fileName: raw.fileName } : {}),
    };
  }

  const source = asRecord(raw.source);
  if (
    source?.type === "base64" &&
    typeof source.data === "string" &&
    typeof source.media_type === "string"
  ) {
    return {
      type: "image",
      data: source.data,
      mimeType: source.media_type,
      ...(typeof raw.fileName === "string" ? { fileName: raw.fileName } : {}),
    };
  }
  return null;
}

function normalizeFileBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const data = firstString(raw.data, raw.content);
  if (data === undefined) {
    return null;
  }
  return {
    type: "file",
    data,
    mimeType: firstString(raw.mimeType, raw.mime_type, raw.mediaType) ?? "application/octet-stream",
    fileName: firstString(raw.fileName, raw.file_name, raw.name) ?? "file",
    ...(typeof raw.size === "number" ? { size: raw.size } : {}),
  };
}

function normalizeCanvasBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const preview = asRecord(raw.preview);
  const url = firstString(raw.url, preview?.url);
  const render =
    raw.render === "url" || preview?.render === "url" || url !== undefined ? "url" : undefined;
  const surface =
    raw.surface === "assistant_message" || preview?.surface === "assistant_message"
      ? "assistant_message"
      : undefined;
  if (!url || render !== "url") {
    return null;
  }
  const preferredHeight = firstFiniteNumber(raw.preferredHeight, preview?.preferredHeight);
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
    ...(preferredHeight !== undefined ? { preferredHeight } : {}),
  };
}

function normalizeUnknownBlock(raw: TranscriptRecord, rawType?: string): TranscriptBlock {
  if (raw.type === "unknown" && typeof raw.rawType === "string" && asRecord(raw.summary)) {
    return {
      type: "unknown",
      rawType: raw.rawType,
      summary: raw.summary as Record<string, unknown>,
    };
  }
  return {
    type: "unknown",
    rawType: rawType || (typeof raw.type === "string" && raw.type ? raw.type : "unknown"),
    summary: Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, summarizeUnknownValue(value)]),
    ),
  };
}

function normalizeToolResultContent(value: unknown): string | TranscriptBlock[] {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => canonicalizeTranscriptArrayEntry(entry))
      .filter((entry): entry is TranscriptBlock => entry != null);
  }
  const record = asRecord(value);
  if (record) {
    if ("content" in record) {
      return normalizeToolResultContent(record.content);
    }
    const block = canonicalizeTranscriptBlock(record);
    return block ? [block] : JSON.stringify(value);
  }
  if (value == null) {
    return "";
  }
  return JSON.stringify(value) ?? "unknown";
}

function canonicalizeTranscriptArrayEntry(value: unknown): TranscriptBlock | null {
  if (typeof value === "string") {
    return { type: "text", text: value };
  }
  const record = asRecord(value);
  if (record) {
    return canonicalizeTranscriptBlock(record);
  }
  if (value == null) {
    return null;
  }
  return { type: "text", text: JSON.stringify(value) ?? "unknown" };
}

export function canonicalizeTranscriptBlock(raw: TranscriptRecord): TranscriptBlock | null {
  const type = typeof raw.type === "string" ? raw.type : "";

  if (type === "text" || type === "input_text" || type === "output_text") {
    return normalizeTextBlock(raw);
  }

  if (type === "thinking" || type === "reasoning" || type === "analysis") {
    return normalizeThinkingBlock(raw);
  }

  if (type === "tool_use" || type === "toolCall") {
    return normalizeToolUseBlock(raw);
  }

  if (type === "tool_result" || type === "toolResult") {
    return {
      type: "tool_result",
      toolUseId: firstString(raw.toolUseId, raw.tool_use_id, raw.toolCallId, raw.id) ?? "",
      content: normalizeToolResultContent(raw.content ?? raw.result),
      ...(typeof raw.isError === "boolean"
        ? { isError: raw.isError }
        : typeof raw.is_error === "boolean"
          ? { isError: raw.is_error }
          : {}),
    };
  }

  if (type === "image") {
    return normalizeImageBlock(raw);
  }

  if (type === "file") {
    return normalizeFileBlock(raw);
  }

  if (type === "canvas") {
    return normalizeCanvasBlock(raw) ?? normalizeUnknownBlock(raw, type);
  }

  if (type === "unknown") {
    return normalizeUnknownBlock(raw, type);
  }

  if (type) {
    return normalizeUnknownBlock(raw, type);
  }

  if ("analysis" in raw || "reasoning" in raw || "thinking" in raw) {
    return normalizeThinkingBlock(raw);
  }

  if ("text" in raw || "content" in raw) {
    return normalizeTextBlock(raw);
  }

  return null;
}

export function canonicalizeTranscriptContent(content: unknown): TranscriptBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    return content
      .map((entry) => canonicalizeTranscriptArrayEntry(entry))
      .filter((entry): entry is TranscriptBlock => entry != null);
  }
  const record = asRecord(content);
  if (record) {
    const block = canonicalizeTranscriptBlock(record);
    return block ? [block] : [{ type: "text", text: JSON.stringify(content) }];
  }
  if (content == null) {
    return [];
  }
  return [{ type: "text", text: JSON.stringify(content) ?? "unknown" }];
}

function normalizeTranscriptRole(role: unknown): "user" | "assistant" | "system" {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }
  if (role === "toolResult") {
    return "user";
  }
  return "assistant";
}

export function canonicalizeTranscriptMessage(message: unknown): Record<string, unknown> {
  const record = asRecord(message);
  if (!record) {
    return {
      role: "assistant",
      content: canonicalizeTranscriptContent(message),
      timestamp: Date.now(),
    };
  }

  const contentSource = record.content !== undefined ? record.content : record.text;
  const next: Record<string, unknown> = {
    ...record,
    role: normalizeTranscriptRole(record.role),
    content: canonicalizeTranscriptContent(contentSource),
    timestamp: typeof record.timestamp === "number" ? record.timestamp : Date.now(),
  };
  delete next.text;
  return next;
}

export function canonicalizeTranscriptMessages(messages: unknown[]): unknown[] {
  return messages.map((message) => canonicalizeTranscriptMessage(message));
}

function canonicalizeSessionToolResultValue(value: unknown): unknown {
  if (typeof value === "string" || value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return canonicalizeTranscriptContent(value);
  }
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  if ("content" in record) {
    return {
      ...record,
      content: normalizeToolResultContent(record.content),
    };
  }
  const block = canonicalizeTranscriptBlock(record);
  return block ?? value;
}

export function canonicalizeSessionToolPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const data = asRecord(payload.data);
  if (!data) {
    return payload;
  }
  const nextData: Record<string, unknown> = { ...data };
  if ("result" in nextData) {
    nextData.result = canonicalizeSessionToolResultValue(nextData.result);
  }
  if ("partialResult" in nextData) {
    nextData.partialResult = canonicalizeSessionToolResultValue(nextData.partialResult);
  }
  return {
    ...payload,
    data: nextData,
  };
}

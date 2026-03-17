/**
 * Message text extraction with thinking-tag stripping and channel envelope removal.
 *
 * Transplanted from vendor/openclaw-studio. Studio-specific imports removed;
 * regex parsing, WeakMap caching, and tag extraction preserved.
 */

// --- Channel envelope detection ---

const ENVELOPE_PREFIX = /^\[([^\]]+)\]\s*/;
const ENVELOPE_CHANNELS = [
  "WebChat",
  "WhatsApp",
  "Telegram",
  "Signal",
  "Slack",
  "Discord",
  "iMessage",
  "Teams",
  "Matrix",
  "Zalo",
  "Zalo Personal",
  "BlueBubbles",
];

function looksLikeEnvelopeHeader(header: string): boolean {
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\b/.test(header)) {
    return true;
  }
  if (/\d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) {
    return true;
  }
  if (/[A-Za-z]{3} \d{4}-\d{2}-\d{2} \d{2}:\d{2}\b/.test(header)) {
    return true;
  }
  return ENVELOPE_CHANNELS.some((label) => header.startsWith(`${label} `));
}

function stripEnvelope(text: string): string {
  const match = text.match(ENVELOPE_PREFIX);
  if (!match) {
    return text;
  }
  const header = match[1] ?? "";
  if (!looksLikeEnvelopeHeader(header)) {
    return text;
  }
  return text.slice(match[0].length);
}

/**
 * Strip a channel envelope prefix (e.g. `[WhatsApp 2025-01-15 14:30]`) from text.
 */
export function stripChannelEnvelope(text: string): string {
  return stripEnvelope(text);
}

// --- Thinking tag handling ---

const THINKING_TAG_RE = /<\s*\/?\s*(think(?:ing)?|analysis)\s*>/gi;
const THINKING_OPEN_RE = /<\s*(think(?:ing)?|analysis)\s*>/i;
const THINKING_CLOSE_RE = /<\s*\/\s*(think(?:ing)?|analysis)\s*>/i;
const THINKING_BLOCK_RE = /<\s*(think(?:ing)?|analysis)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
const THINKING_STREAM_TAG_RE = /<\s*(\/?)\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;

// --- Assistant prefix stripping ---

const ASSISTANT_PREFIX_RE = /^(?:\[\[reply_to_current\]\]|\[reply_to_current\])\s*(?:\|\s*)?/i;

function stripAssistantPrefix(text: string): string {
  if (!text) {
    return text;
  }
  if (!ASSISTANT_PREFIX_RE.test(text)) {
    return text;
  }
  return text.replace(ASSISTANT_PREFIX_RE, "").trimStart();
}

// --- Exec approval policy stripping ---

const EXEC_APPROVAL_WAIT_POLICY = [
  "Execution approval policy:",
  "- If any tool result says approval is required or pending, stop immediately.",
  "- Do not call additional tools and do not switch to alternate approaches.",
  'If approved command output is unavailable, reply exactly: "Waiting for approved command result."',
].join("\n");

function stripAppendedExecApprovalPolicy(text: string): string {
  const suffix = `\n\n${EXEC_APPROVAL_WAIT_POLICY}`;
  if (!text.endsWith(suffix)) {
    return text;
  }
  return text.slice(0, -suffix.length);
}

// --- Thinking tag stripping from assistant text ---

function stripThinkingTagsFromAssistantText(value: string): string {
  if (!value) {
    return value;
  }
  const hasOpen = THINKING_OPEN_RE.test(value);
  const hasClose = THINKING_CLOSE_RE.test(value);
  if (!hasOpen && !hasClose) {
    return value;
  }
  if (hasOpen !== hasClose) {
    if (!hasOpen) {
      return value.replace(THINKING_CLOSE_RE, "").trimStart();
    }
    return value.replace(THINKING_OPEN_RE, "").trimStart();
  }

  if (!THINKING_TAG_RE.test(value)) {
    return value;
  }
  THINKING_TAG_RE.lastIndex = 0;

  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  for (const match of value.matchAll(THINKING_TAG_RE)) {
    const idx = match.index ?? 0;
    if (!inThinking) {
      result += value.slice(lastIndex, idx);
    }
    const tag = match[0].toLowerCase();
    inThinking = !tag.includes("/");
    lastIndex = idx + match[0].length;
  }
  if (!inThinking) {
    result += value.slice(lastIndex);
  }
  return result.trimStart();
}

// --- Raw text extraction ---

function extractRawText(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const content = m.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return null;
      })
      .filter((v): v is string => typeof v === "string");
    if (parts.length > 0) {
      return parts.join("\n");
    }
  }
  if (typeof m.text === "string") {
    return m.text;
  }
  return null;
}

// --- WeakMap caches ---

const textCache = new WeakMap<object, string | null>();
const thinkingCache = new WeakMap<object, string | null>();

// --- Public API ---

/**
 * Extract displayable text from a message object.
 * Strips thinking tags from assistant messages and channel envelopes from user messages.
 */
export function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const role = typeof m.role === "string" ? m.role : "";
  const content = m.content;

  const postProcess = (value: string): string => {
    if (role === "assistant") {
      return stripAssistantPrefix(stripThinkingTagsFromAssistantText(value));
    }
    return stripAppendedExecApprovalPolicy(stripEnvelope(value));
  };

  if (typeof content === "string") {
    return postProcess(content);
  }

  if (Array.isArray(content)) {
    const parts = content
      .map((p) => {
        const item = p as Record<string, unknown>;
        if (item.type === "text" && typeof item.text === "string") {
          return item.text;
        }
        return null;
      })
      .filter((v): v is string => typeof v === "string");

    if (parts.length > 0) {
      return postProcess(parts.join("\n"));
    }
  }

  if (typeof m.text === "string") {
    return postProcess(m.text);
  }

  return null;
}

/**
 * Cached version of extractText.
 */
export function extractTextCached(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return extractText(message);
  }
  const obj = message;
  if (textCache.has(obj)) {
    return textCache.get(obj) ?? null;
  }
  const value = extractText(message);
  textCache.set(obj, value);
  return value;
}

/**
 * Extract thinking/reasoning content from a message object.
 * Searches content array for thinking-type blocks, direct properties,
 * and inline thinking tags.
 */
export function extractThinking(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const m = message as Record<string, unknown>;
  const content = m.content;
  const parts: string[] = [];

  const extractFromRecord = (record: Record<string, unknown>): string | null => {
    const directKeys = [
      "thinking",
      "analysis",
      "reasoning",
      "thinkingText",
      "analysisText",
      "reasoningText",
      "thinking_text",
      "analysis_text",
      "reasoning_text",
      "thinkingDelta",
      "analysisDelta",
      "reasoningDelta",
      "thinking_delta",
      "analysis_delta",
      "reasoning_delta",
    ] as const;
    for (const key of directKeys) {
      const value = record[key];
      if (typeof value === "string") {
        const cleaned = value.trim();
        if (cleaned) {
          return cleaned;
        }
      }
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        const nestedKeys = [
          "text",
          "delta",
          "content",
          "summary",
          "analysis",
          "reasoning",
          "thinking",
        ] as const;
        for (const nestedKey of nestedKeys) {
          const nestedValue = nested[nestedKey];
          if (typeof nestedValue === "string") {
            const cleaned = nestedValue.trim();
            if (cleaned) {
              return cleaned;
            }
          }
        }
      }
    }
    return null;
  };

  if (Array.isArray(content)) {
    for (const p of content) {
      const item = p as Record<string, unknown>;
      const type = typeof item.type === "string" ? item.type : "";
      if (type === "thinking" || type === "analysis" || type === "reasoning") {
        const extracted = extractFromRecord(item);
        if (extracted) {
          parts.push(extracted);
        } else if (typeof item.text === "string") {
          const cleaned = item.text.trim();
          if (cleaned) {
            parts.push(cleaned);
          }
        }
      } else if (typeof item.thinking === "string") {
        const cleaned = item.thinking.trim();
        if (cleaned) {
          parts.push(cleaned);
        }
      }
    }
  }
  if (parts.length > 0) {
    return parts.join("\n");
  }

  const direct = extractFromRecord(m);
  if (direct) {
    return direct;
  }

  const rawText = extractRawText(message);
  if (!rawText) {
    return null;
  }
  const matches = [...rawText.matchAll(THINKING_BLOCK_RE)];
  const extracted = matches.map((match) => (match[2] ?? "").trim()).filter(Boolean);
  if (extracted.length > 0) {
    return extracted.join("\n");
  }
  const openTagged = extractThinkingFromTaggedStream(rawText);
  return openTagged ? openTagged : null;
}

/**
 * Cached version of extractThinking.
 */
export function extractThinkingCached(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return extractThinking(message);
  }
  const obj = message;
  if (thinkingCache.has(obj)) {
    return thinkingCache.get(obj) ?? null;
  }
  const value = extractThinking(message);
  thinkingCache.set(obj, value);
  return value;
}

// --- Internal helpers for tagged stream extraction ---

function extractThinkingFromTaggedText(text: string): string {
  if (!text) {
    return "";
  }
  let result = "";
  let lastIndex = 0;
  let inThinking = false;
  THINKING_STREAM_TAG_RE.lastIndex = 0;
  for (const match of text.matchAll(THINKING_STREAM_TAG_RE)) {
    const idx = match.index ?? 0;
    if (inThinking) {
      result += text.slice(lastIndex, idx);
    }
    const isClose = match[1] === "/";
    inThinking = !isClose;
    lastIndex = idx + match[0].length;
  }
  return result.trim();
}

function extractThinkingFromTaggedStream(text: string): string {
  if (!text) {
    return "";
  }
  const closed = extractThinkingFromTaggedText(text);
  if (closed) {
    return closed;
  }
  const openRe = /<\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const closeRe = /<\s*\/\s*(?:think(?:ing)?|analysis|thought|antthinking)\s*>/gi;
  const openMatches = [...text.matchAll(openRe)];
  if (openMatches.length === 0) {
    return "";
  }
  const closeMatches = [...text.matchAll(closeRe)];
  const lastOpen = openMatches[openMatches.length - 1];
  const lastClose = closeMatches[closeMatches.length - 1];
  if (lastClose && (lastClose.index ?? -1) > (lastOpen.index ?? -1)) {
    return closed;
  }
  const start = (lastOpen.index ?? 0) + lastOpen[0].length;
  return text.slice(start).trim();
}

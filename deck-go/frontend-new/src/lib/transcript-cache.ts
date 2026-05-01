import type { ChatMessage } from "@/stores/chat-types";

const MAX_ENTRIES = 5;

type CacheEntry = {
  messages: ChatMessage[];
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedTranscript(
  sessionKey: string,
  isStreaming?: boolean,
): ChatMessage[] | null {
  if (isStreaming) {
    return null;
  }
  const entry = cache.get(sessionKey);
  if (!entry) {
    return null;
  }
  cache.delete(sessionKey);
  cache.set(sessionKey, entry);
  return entry.messages;
}

export function setCachedTranscript(sessionKey: string, messages: ChatMessage[]): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(sessionKey)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(sessionKey, { messages, cachedAt: Date.now() });
}

export function invalidateTranscript(sessionKey: string): void {
  cache.delete(sessionKey);
}

export function clearTranscriptCache(): void {
  cache.clear();
}

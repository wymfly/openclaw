/**
 * LRU transcript cache — shared between Chat and Sessions panels.
 *
 * Caches normalized ChatMessage[] by session key to avoid duplicate
 * chat.history Gateway RPC calls when switching between panels.
 *
 * Invalidation: SSE session-state events, streaming end, session delete/clear.
 * Streaming bypass: cache is not read during active streaming sessions.
 *
 * See: .omc/plans/deck-api-resilience.md Phase 2 (S6)
 */

import type { ChatMessage } from "@/stores/chat-types";

const MAX_ENTRIES = 5;

interface CacheEntry {
  messages: ChatMessage[];
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Get cached messages for a session key. Returns null if not cached or during streaming. */
export function getCachedTranscript(
  sessionKey: string,
  isStreaming?: boolean,
): ChatMessage[] | null {
  if (isStreaming) {return null;}
  const entry = cache.get(sessionKey);
  if (!entry) {return null;}
  // Move to end (LRU touch)
  cache.delete(sessionKey);
  cache.set(sessionKey, entry);
  return entry.messages;
}

/** Store messages in cache. Evicts oldest entry if at capacity. */
export function setCachedTranscript(sessionKey: string, messages: ChatMessage[]): void {
  // Evict oldest if at capacity
  if (cache.size >= MAX_ENTRIES && !cache.has(sessionKey)) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(sessionKey, { messages, cachedAt: Date.now() });
}

/** Invalidate cache for a specific session (on SSE event, delete, clear, reset). */
export function invalidateTranscript(sessionKey: string): void {
  cache.delete(sessionKey);
}

/** Clear all cached transcripts. */
export function clearTranscriptCache(): void {
  cache.clear();
}

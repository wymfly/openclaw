import { gwCall } from "@/lib/api-helpers";
import type { TranscriptMessage } from "@/types/gateway-protocol.generated";

/**
 * Central transcript-read seam for full conversation history.
 *
 * Deck still reads full transcripts through `chat.history` until Gateway
 * exposes a single native `sessions.*` equivalent with the same semantics.
 */
export async function fetchTranscriptHistory(params: {
  sessionKey: string;
  limit?: number;
}): Promise<TranscriptMessage[]> {
  const payload = await gwCall("chat.history", {
    sessionKey: params.sessionKey,
    ...(params.limit !== undefined ? { limit: params.limit } : {}),
  });
  return Array.isArray((payload as { messages?: unknown[] }).messages)
    ? (payload as { messages: TranscriptMessage[] }).messages
    : [];
}

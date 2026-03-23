import { loadConfig } from "../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../routing/session-key.js";

export const DEFAULT_EVENT_STREAMS: readonly string[] = ["lifecycle", "assistant"];

/**
 * Resolve the eventStreams whitelist for a given session key.
 * Uses parseAgentSessionKey directly — the session key passed to sendToSession
 * is already canonicalized (via resolveSessionKeyForRun), so loadSessionEntry
 * (which calls readFileSync) is unnecessary overhead on the hot path.
 * Semantic: undefined = not set (use fallback), [] = explicitly empty (filter all agent streams).
 */
export function resolveChannelEventStreams(sessionKey: string): readonly string[] {
  const parsed = parseAgentSessionKey(sessionKey);
  const agentId = normalizeAgentId(parsed?.agentId);
  const cfg = loadConfig();

  const agentEntry = cfg.agents?.list?.find((a) => a.id === agentId);
  const agentStreams = agentEntry?.channels?.eventStreams;
  if (agentStreams !== undefined) {
    return agentStreams;
  }

  const defaultStreams = cfg.agents?.defaults?.channels?.eventStreams;
  if (defaultStreams !== undefined) {
    return defaultStreams;
  }

  return DEFAULT_EVENT_STREAMS;
}

/**
 * Determine whether a channel event should be filtered (dropped).
 * @returns true if the event should be DROPPED
 */
export function shouldFilterChannelEvent(
  eventType: string,
  stream: string | undefined,
  allowedStreams: readonly string[],
): boolean {
  // Non-agent events (e.g. "chat") are never filtered.
  if (eventType !== "agent") {
    return false;
  }
  // Missing stream or error stream always pass through.
  if (!stream || stream === "error") {
    return false;
  }
  return !allowedStreams.includes(stream);
}

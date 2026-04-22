"use client";

import { useEffect } from "react";
import { deckStream } from "@/lib/deck-client";
import { useLogsStore, type LogEntry, type LogLevel, type LogSource } from "@/stores/logs";

// ---------------------------------------------------------------------------
// Log line parser
// ---------------------------------------------------------------------------

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  WARNING: "warn",
  ERROR: "error",
  ERR: "error",
};

const LOG_SOURCE_MAP: Record<string, LogSource> = {
  gateway: "gateway",
  agent: "agent",
  channel: "channel",
};

function parseLogLine(line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\s+\[(\w+)]\s+\[(\w+)]\s+(.*)/);
  if (match) {
    const [, timestamp, rawLevel, rawSource, message] = match;
    return {
      timestamp: timestamp ?? new Date().toISOString(),
      level: LOG_LEVEL_MAP[rawLevel?.toUpperCase() ?? ""] ?? "info",
      source: LOG_SOURCE_MAP[rawSource?.toLowerCase() ?? ""] ?? "unknown",
      message: message ?? trimmed,
    };
  }

  const levelMatch = trimmed.match(/\[(\w+)]/);
  const level = LOG_LEVEL_MAP[levelMatch?.[1]?.toUpperCase() ?? ""] ?? "info";
  return {
    timestamp: new Date().toISOString(),
    level,
    source: "unknown",
    message: trimmed,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to `/api/logs/stream` SSE endpoint for real-time log tailing.
 * Replaces the 2 s polling approach with server-pushed events.
 * Reconnects automatically via `deckStream` with `Last-Event-ID` cursor resume.
 */
export function useLogSSE(): void {
  const streaming = useLogsStore((s) => s.streaming);
  const addEntries = useLogsStore((s) => s.addEntries);
  const clearLogs = useLogsStore((s) => s.clearLogs);

  useEffect(() => {
    if (!streaming) {
      return;
    }

    const controller = new AbortController();

    void deckStream("/api/logs/stream", {
      signal: controller.signal,
      reconnect: true,
      onEvent(event) {
        // Handle log rotation — clear the ring buffer.
        if (event.event === "log.reset") {
          clearLogs();
          return;
        }
        if (event.event !== "log.batch" || !event.data) {
          return;
        }
        try {
          const data = JSON.parse(event.data) as { lines?: string[] };
          if (!Array.isArray(data.lines)) {
            return;
          }

          const parsed: LogEntry[] = [];
          for (const line of data.lines) {
            if (typeof line !== "string") {
              continue;
            }
            const entry = parseLogLine(line);
            if (entry) {
              parsed.push(entry);
            }
          }
          if (parsed.length > 0) {
            addEntries(parsed);
          }
        } catch {
          // Ignore malformed SSE payloads.
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [streaming, addEntries, clearLogs]);
}

"use client";

import { useCallback, useEffect, useRef } from "react";
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

/**
 * Parse a raw log line into a structured LogEntry.
 *
 * Expected format: `2024-03-17T12:00:00Z [INFO] [gateway] Some message`
 * Falls back gracefully for lines that don't match.
 */
function parseLogLine(line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  // Try structured format: timestamp [LEVEL] [source] message
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

  // Fallback: try to extract just level from bracket notation
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

const POLL_INTERVAL_MS = 2000;

/**
 * Polls `/api/logs?cursor=N` every 2 seconds while streaming is enabled.
 * Parses raw lines, applies client-side filters, and feeds the logs store.
 */
export function useLogPolling(): void {
  const cursorRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollFailCountRef = useRef(0);

  const streaming = useLogsStore((s) => s.streaming);
  const addEntries = useLogsStore((s) => s.addEntries);

  const poll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cursorRef.current !== null) {
        params.set("cursor", String(cursorRef.current));
      }
      params.set("limit", "500");
      params.set("maxBytes", "65536");

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) {
        pollFailCountRef.current++;
        if (cursorRef.current !== null) {
          console.warn("[logs] fetch error (status %d), resetting cursor", res.status);
          cursorRef.current = null;
        } else if (pollFailCountRef.current % 10 === 1) {
          console.warn(
            "[logs] polling failed %d times (status %d)",
            pollFailCountRef.current,
            res.status,
          );
        }
        return;
      }
      pollFailCountRef.current = 0;

      const data = (await res.json()) as {
        cursor?: number;
        lines?: string[];
        reset?: boolean;
      };

      // Update cursor for next poll.
      if (typeof data.cursor === "number") {
        cursorRef.current = data.cursor;
      }

      // If the server signals a log rotation, reset cursor.
      if (data.reset) {
        cursorRef.current = null;
      }

      const rawLines = data.lines;
      if (!Array.isArray(rawLines) || rawLines.length === 0) {
        return;
      }

      // Parse raw lines into structured entries — store ALL, filter at render time.
      const parsed: LogEntry[] = [];
      for (const line of rawLines) {
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
    } catch (err) {
      // Network fetch failures are expected during connectivity blips — suppress.
      // Log everything else so parsing/state bugs don't go unnoticed.
      if (!(err instanceof TypeError && String(err.message).includes("fetch"))) {
        console.error("[logs] unexpected polling error:", err);
      }
    }
  }, [addEntries]);

  useEffect(() => {
    if (!streaming) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Kick off the first poll immediately.
    void poll();

    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        await poll();
        if (useLogsStore.getState().streaming) {
          schedule();
        }
      }, POLL_INTERVAL_MS);
    };

    schedule();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [streaming, poll]);
}

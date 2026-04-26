import { useEffect } from "react";
import { streamEvents, type DeckGoActivityEvent } from "../../../api";

type ActivityStreamEvent = {
  event?: string;
  data?: string;
  json?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readDetails(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined || value === null) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

function parsePayload(event: ActivityStreamEvent): unknown {
  if (event.json !== undefined) {
    return event.json;
  }
  if (!event.data) {
    return null;
  }
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

export function normalizeActivityEvent(event: ActivityStreamEvent): DeckGoActivityEvent | null {
  const payload = parsePayload(event);
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const id = readString(record.id);
  const description = readString(record.description);
  if (!id || !description) {
    return null;
  }
  return {
    id,
    description,
    timestamp: readNumber(record.timestamp) ?? Date.now(),
    type: readString(record.type) ?? "system",
    agentId: readString(record.agentId),
    agentName: readString(record.agentName),
    details: readDetails(record.details),
  };
}

export function useActivitySSE(onActivityEvent: (event: DeckGoActivityEvent) => void) {
  useEffect(() => {
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      retryDelayMs: 1_000,
      onEvent(event) {
        if (event.event !== "activity.event") {
          return;
        }
        const activityEvent = normalizeActivityEvent(event);
        if (activityEvent) {
          onActivityEvent(activityEvent);
        }
      },
    }).catch(() => {});

    return () => controller.abort();
  }, [onActivityEvent]);
}

import type {
  DeckGoLogStreamEvent,
  DeckGoProjectionGapEvent,
  DeckGoSessionMessageStreamEvent,
  DeckGoSessionToolStreamEvent,
  DeckGoSessionsChangedStreamEvent,
  DeckGoServerEvent,
} from "../../contracts/generated/ts/deck-api.generated";
import type { DeckGoRuntimeGatewayStatus } from "./api";

export type DeckGoParsedServerEvent =
  | { kind: "projection.gap"; payload: DeckGoProjectionGapEvent }
  | { kind: "runtime.gateway.status"; payload: DeckGoRuntimeGatewayStatus }
  | { kind: "runtime.gateway.health"; payload: DeckGoRuntimeGatewayStatus }
  | { kind: "runtime.gateway.exit"; payload: DeckGoRuntimeGatewayStatus }
  | { kind: "session.message"; payload: DeckGoSessionMessageStreamEvent }
  | { kind: "session.tool"; payload: DeckGoSessionToolStreamEvent }
  | { kind: "sessions.changed"; payload: DeckGoSessionsChangedStreamEvent }
  | { kind: "unknown"; event: DeckGoServerEvent };

export type DeckGoParsedLogEvent =
  | { kind: "log.batch"; payload: { lines?: unknown[]; cursor?: number } }
  | { kind: "log.reset"; payload: Record<string, never> }
  | { kind: "unknown"; event: DeckGoLogStreamEvent };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function runtimeStatusPayload(value: unknown): DeckGoRuntimeGatewayStatus {
  const record = asRecord(value);
  if (record?.mode === "remote") {
    return record as unknown as DeckGoRuntimeGatewayStatus;
  }
  return {
    ...record,
    autoStart: typeof record?.autoStart === "boolean" ? record.autoStart : false,
    managed: typeof record?.managed === "boolean" ? record.managed : false,
    mode: "bundled",
  } as unknown as DeckGoRuntimeGatewayStatus;
}

export function parseServerEvent(event: DeckGoServerEvent): DeckGoParsedServerEvent {
  switch (event.event) {
    case "projection.gap":
      return {
        kind: "projection.gap",
        payload: (event.json as DeckGoProjectionGapEvent | undefined) ?? { reason: "unknown" },
      };
    case "runtime.gateway.status":
      return {
        kind: "runtime.gateway.status",
        payload: runtimeStatusPayload(event.json),
      };
    case "runtime.gateway.health":
      return {
        kind: "runtime.gateway.health",
        payload: runtimeStatusPayload(event.json),
      };
    case "runtime.gateway.exit":
      return {
        kind: "runtime.gateway.exit",
        payload: runtimeStatusPayload(event.json),
      };
    case "session.message":
      return {
        kind: "session.message",
        payload: (event.json as DeckGoSessionMessageStreamEvent | undefined) ?? { sessionKey: "" },
      };
    case "session.tool":
      return {
        kind: "session.tool",
        payload: (event.json as DeckGoSessionToolStreamEvent | undefined) ?? {
          runId: "",
          seq: 0,
          stream: "tool",
          ts: 0,
          sessionKey: "",
          data: {},
        },
      };
    case "sessions.changed":
      return {
        kind: "sessions.changed",
        payload: (event.json as DeckGoSessionsChangedStreamEvent | undefined) ?? {
          sessionKey: "",
          ts: 0,
        },
      };
    default:
      return { kind: "unknown", event };
  }
}

export function parseLogEvent(event: DeckGoLogStreamEvent): DeckGoParsedLogEvent {
  switch (event.event) {
    case "log.batch": {
      const payload = asRecord(event.json);
      return {
        kind: "log.batch",
        payload: {
          lines: Array.isArray(payload?.lines) ? payload.lines : undefined,
          cursor: typeof payload?.cursor === "number" ? payload.cursor : undefined,
        },
      };
    }
    case "log.reset":
      return { kind: "log.reset", payload: {} };
    default:
      return { kind: "unknown", event };
  }
}

export function summarizeServerEvent(event: DeckGoServerEvent): string {
  const parsed = parseServerEvent(event);
  switch (parsed.kind) {
    case "projection.gap":
      return `projection gap (${parsed.payload.reason || "unknown"})`;
    case "runtime.gateway.status":
      return `runtime status = ${parsed.payload.status || "unknown"}${parsed.payload.gatewayUrl ? ` @ ${parsed.payload.gatewayUrl}` : ""}`;
    case "runtime.gateway.health":
      return `runtime health = ${parsed.payload.health || "unknown"}`;
    case "runtime.gateway.exit":
      return `runtime exit code = ${
        parsed.payload.mode === "bundled" ? (parsed.payload.lastExitCode ?? "unknown") : "unknown"
      }`;
    case "session.message":
      return `session.message for ${parsed.payload.sessionKey || "unknown-session"}`;
    case "session.tool": {
      const rawPhase = parsed.payload.data?.phase;
      const phase = typeof rawPhase === "string" && rawPhase.trim() ? rawPhase : "unknown";
      return `session.tool for ${parsed.payload.sessionKey || "unknown-session"} (${phase})`;
    }
    case "sessions.changed":
      return `sessions.changed for ${parsed.payload.sessionKey || "unknown-session"} (${parsed.payload.reason || parsed.payload.phase || "unknown"})`;
    default:
      return parsed.event.event || "unknown";
  }
}

export function summarizeLogEvent(event: DeckGoLogStreamEvent): string {
  const parsed = parseLogEvent(event);
  switch (parsed.kind) {
    case "log.batch":
      return `log batch (${parsed.payload.lines?.length ?? 0} lines, cursor ${parsed.payload.cursor ?? 0})`;
    case "log.reset":
      return "log reset";
    default:
      return parsed.event.event || "unknown";
  }
}

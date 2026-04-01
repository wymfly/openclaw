/**
 * RunEventPipeline — EventBus subscriber that transforms SSE `chat` and `agent`
 * events into `run_events` rows via RunEventStore.
 *
 * Event shapes match the real Gateway contract:
 *   - chat: { runId, sessionKey, seq, state, usage?, errorMessage?, stopReason? }
 *   - agent: { runId, seq, stream, ts, data: {...}, sessionKey? }
 *
 * Batch buffer: accumulates events and flushes on 50 count or 500ms timeout.
 */

import type { ServerEvent } from "./event-bus";
import type { RunEventInput } from "./run-event-store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 500;

/**
 * Tool names classified as file operations (lowercased for case-insensitive matching).
 * Covers both PascalCase Pi tools (Read, Write, Edit) and snake_case variants
 * (read_file, write_file, etc.) that appear in real SSE events.
 */
const FILE_TOOLS = new Set([
  "read",
  "write",
  "edit",
  "multiedit",
  "glob",
  "read_file",
  "write_file",
  "edit_file",
  "create_file",
  "delete_file",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mapped stream types for run_events rows. */
export type RunEventStream =
  | "model"
  | "tool_call"
  | "file_op"
  | "subagent"
  | "system"
  | "compaction";

/**
 * Chat event payload shape (ChatEventSchema).
 * No top-level agentId — must derive from sessionKey pattern.
 */
type ChatPayload = {
  runId?: string;
  sessionKey?: string;
  seq?: number;
  state?: "delta" | "final" | "error" | "aborted";
  usage?: Record<string, unknown>;
  errorMessage?: string;
  stopReason?: string;
};

/**
 * Agent event payload shape (AgentEventPayload).
 * No top-level agentId or type — must derive from sessionKey.
 */
type AgentPayload = {
  runId?: string;
  seq?: number;
  stream?: string;
  ts?: number;
  data?: Record<string, unknown>;
  sessionKey?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract agentId from sessionKey pattern `agent:{agentId}:{...}`.
 * Returns undefined if the pattern does not match.
 */
export function extractAgentId(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const match = sessionKey.match(/^agent:([^:]+):/);
  return match?.[1];
}

/**
 * Classify an SSE event into a run_events stream category.
 *
 * Returns the stream string for RunEventInput, or null to skip the event.
 *
 * Classification rules:
 * - chat + state "final"|"error" → "model"
 * - chat + state "delta" → SKIP (too many)
 * - agent + stream "compaction" → "compaction"
 * - agent + stream "tool" + file tool name → "file_op"
 * - agent + stream "tool" + other → "tool_call"
 * - agent + stream "lifecycle" + childRunId/subagent data → "subagent"
 * - agent + stream "lifecycle" + other → "system"
 * - agent + stream "error" → "system"
 * - No runId → SKIP (null)
 */
export function classifyEvent(
  eventType: "chat" | "agent",
  payload: unknown,
): RunEventStream | null {
  if (eventType === "chat") {
    const p = payload as ChatPayload;
    if (!p.runId) {
      return null;
    }
    const state = p.state;
    if (state === "final" || state === "error") {
      return "model";
    }
    // delta and aborted — skip (too many deltas, aborted is not interesting)
    return null;
  }

  if (eventType === "agent") {
    const p = payload as AgentPayload;
    if (!p.runId) {
      return null;
    }
    const stream = p.stream;

    if (stream === "compaction") {
      return "compaction";
    }

    if (stream === "tool") {
      const toolName = p.data?.name as string | undefined;
      if (toolName && FILE_TOOLS.has(toolName.toLowerCase())) {
        return "file_op";
      }
      return "tool_call";
    }

    if (stream === "lifecycle") {
      const data = p.data ?? {};
      // Detect subagent lifecycle events: childRunId or subagent-related sessionKey
      if (data.childRunId || data.childSessionKey) {
        return "subagent";
      }
      return "system";
    }

    if (stream === "error") {
      return "system";
    }

    // assistant and other streams — skip
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// RunEventPipeline
// ---------------------------------------------------------------------------

export class RunEventPipeline {
  private buffer: RunEventInput[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly flushFn: (events: RunEventInput[]) => void;

  /**
   * @param flushFn — callback to persist events (typically RunEventStore.appendEvents).
   */
  constructor(flushFn: (events: RunEventInput[]) => void) {
    this.flushFn = flushFn;
  }

  /**
   * EventBus subscriber handler. Processes "chat" and "agent" events,
   * classifies them, and buffers for batch write.
   */
  handleEvent = (event: ServerEvent): void => {
    const eventType = event.type;
    if (eventType !== "chat" && eventType !== "agent") {
      return;
    }

    const payload = event.data;
    const stream = classifyEvent(eventType, payload);
    if (!stream) {
      return;
    }

    const p = payload as Record<string, unknown>;
    const runId = p.runId as string;
    const seq = (p.seq as number) ?? 0;
    const sessionKey = p.sessionKey as string | undefined;
    const agentId = extractAgentId(sessionKey);

    // Normalize stored data to a shape expected by RunEventStore SQL/TS:
    // - top-level `type` field ("tool_use" | "result" | "compaction" | "text" | etc.)
    // - For agent events: store the inner `data` object (already has `type`/`name`)
    // - For chat events: construct `{ type: "result", subtype, usage }` from state
    const chatPayload = p as ChatPayload;
    const normalizedData =
      eventType === "agent"
        ? ((p.data as Record<string, unknown>) ?? payload)
        : {
            type: "result",
            subtype: chatPayload.state === "final" ? "success" : "error",
            usage: chatPayload.usage,
            ...(chatPayload.errorMessage ? { errorMessage: chatPayload.errorMessage } : {}),
          };

    const input: RunEventInput = {
      runId,
      seq,
      stream,
      data: JSON.stringify(normalizedData),
      agentId,
      sessionKey,
    };

    this.buffer.push(input);

    // Flush on batch size threshold.
    if (this.buffer.length >= BATCH_SIZE) {
      this.flush();
      return;
    }

    // Start/restart the timer for time-based flush.
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  };

  /** Flush buffered events to the store. */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const events = this.buffer;
    this.buffer = [];

    try {
      this.flushFn(events);
    } catch (err) {
      console.error("[RunEventPipeline] flush failed:", err);
    }
  }

  /** Stop the pipeline: flush remaining events and clear timer. */
  destroy(): void {
    this.flush();
  }
}

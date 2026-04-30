// ---------------------------------------------------------------------------
// Session-scoped chat types for the refactored Zustand store.
//
// These are extracted from chat.ts (ContentBlock, ChatMessage, SessionInfo,
// ActiveApproval) plus new types for per-session state management.
// The original chat.ts remains available so compatibility consumers can import
// from either module while session-scoped code uses this smaller type surface.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Content block types (Anthropic-compatible discriminated union)
// Re-exported so downstream can import from a single module.
// ---------------------------------------------------------------------------

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string; fileName?: string }
  | { type: "file"; data: string; mimeType: string; fileName: string; size?: number }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string | ContentBlock[]; isError?: boolean }
  | { type: "thinking"; text: string }
  | {
      type: "canvas";
      kind: "canvas";
      surface: "assistant_message";
      render: "url";
      url: string;
      viewId?: string;
      title?: string;
      preferredHeight?: number;
    }
  | { type: "unknown"; rawType: string; summary: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: ContentBlock[];
  timestamp: number;
  /** Whether this message is still being streamed. */
  streaming?: boolean;
  /** Error associated with this message. */
  error?: string;
  /** Token count before compaction (compaction notice only). */
  tokensBefore?: number;
  /** Token count after compaction (compaction notice only). */
  tokensAfter?: number;
  /** Whether this message is a compaction summary from Gateway transcript. */
  isCompaction?: boolean;
}

// ---------------------------------------------------------------------------
// Session info compatibility shape for consumers that still read chat session
// summaries through the store adapter. Prefer SessionMeta in new code.
// ---------------------------------------------------------------------------

export type SessionInfo = {
  key: string;
  sessionId?: string;
  agentId?: string;
  title?: string;
  lastMessage?: string;
  updatedAt?: number;
};

// ---------------------------------------------------------------------------
// Approval request (renamed from ActiveApproval for the new API)
// ---------------------------------------------------------------------------

export type ApprovalRequest = {
  id: string;
  toolName: string;
  command?: string;
  description?: string;
  sessionKey?: string;
  agentId?: string;
  cwd?: string;
  createdAtMs?: number;
  expiresAtMs?: number;
};

/** @deprecated Use ApprovalRequest; retained for ActiveApproval consumers. */
export type ActiveApproval = ApprovalRequest;

// ---------------------------------------------------------------------------
// Tool progress tracking
// ---------------------------------------------------------------------------

export interface ToolProgress {
  toolUseId: string;
  name: string;
  status: "running" | "completed" | "error";
  startedAt: number;
  completedAt?: number;
}

// ---------------------------------------------------------------------------
// A2UI state (Agent-to-User Interface overlay)
// ---------------------------------------------------------------------------

export interface A2UIState {
  /** Whether the A2UI overlay is currently visible. */
  visible: boolean;
  /** URL of the A2UI canvas frame. */
  url?: string;
  bridgeStatus?: "connecting" | "ready" | "error";
  eventLog?: A2UIEvent[];
  surfaces?: string[];
  treeData?: unknown;
}

export interface A2UIEvent {
  timestamp: number;
  direction: "inbound" | "outbound";
  action: string;
  summary: string;
  raw: unknown;
}

export const MAX_A2UI_EVENT_LOG = 200;

// ---------------------------------------------------------------------------
// Run metadata
// ---------------------------------------------------------------------------

export interface RunMetadata {
  runId: string;
  model?: string;
  usage?: { input?: number; output?: number; cache?: number };
  durationMs?: number;
  startedAt?: number;
  streaming?: boolean;
  // -------------------------------------------------------------------------
  // P2a chat capability extension (capability map §7).
  // View-shape fields derived from wire CostUsageTotals (camelCase). Optional
  // throughout — chat metadata bar must hide-on-undefined gracefully.
  // -------------------------------------------------------------------------
  /** Read-side cache tokens. Maps from wire `usage.cacheRead`. */
  cacheReadTokens?: number;
  /** Write-side cache tokens. Maps from wire `usage.cacheWrite`. */
  cacheWriteTokens?: number;
  /**
   * Cache-hit ratio in `[0, 1]`. Derived in the consumer layer:
   * `cacheRead / (input + output + cacheRead + cacheWrite)`.
   */
  cacheHit?: number;
  /** Total run cost in USD (float). Maps from wire `usage.totalCost`. */
  cost?: number;
}

// ---------------------------------------------------------------------------
// Subagent lineage view shape (P2a §7)
// ---------------------------------------------------------------------------
// Wire shape `DeckGoSubagentLineageNode` is a flat array. The chat panel
// builds a recursive view-shape with optional `children` for rendering. This
// type exposes the recursive shape for components that consume it without
// breaking the flat-list wire contract.
// ---------------------------------------------------------------------------

export interface SubagentLineageNode {
  sessionKey: string;
  parentSessionKey?: string;
  agentId?: string;
  title?: string;
  status?: string;
  startedAt?: number;
  endedAt?: number;
  spawnedWorkspaceDir?: string;
  /**
   * Optional recursive children populated by `buildLineageTree` in the chat
   * subagent renderer. Absent on the wire shape.
   */
  children?: SubagentLineageNode[];
}

// ---------------------------------------------------------------------------
// Per-session state
// ---------------------------------------------------------------------------

export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  /** Session lifecycle status from Gateway. Replaces old "idle"|"active" enum. */
  status: "idle" | "running" | "done" | "failed" | "killed" | "timeout";
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  runMetadata: Record<string, RunMetadata>;
  a2uiState: A2UIState | null;
  lastAccessedAt: number;
  // New lifecycle fields
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  fastMode?: boolean;
}

// ---------------------------------------------------------------------------
// Session metadata (lightweight, always in memory)
// ---------------------------------------------------------------------------

export interface SessionMeta {
  key: string;
  agentId: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
  // New fields from sessions.changed snapshots
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  model?: string;
  modelProvider?: string;
  thinkingLevel?: string;
  fastMode?: boolean;
  verboseLevel?: string;
  reasoningLevel?: "off" | "on" | "stream";
  responseUsage?: "off" | "tokens" | "full";
  sendPolicy?: "allow" | "deny";
  totalTokens?: number;
  totalTokensFresh?: boolean;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  contextTokens?: number;
  compactionCount?: number;
  // Subagent fields (loaded via sessions.list, not events)
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
}

export interface SessionPreviewOverlay {
  text: string;
  updatedAt: number;
  source: "optimistic" | "remote";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of session states kept in memory before LRU eviction. */
export const MAX_CACHED_SESSIONS = 20;

/** How long (ms) an idle session can stay cached before becoming evictable. */
export const DEFAULT_EVICT_IDLE_MS = 5 * 60 * 1000; // 5 minutes

export type SSEConnectionStatus = "connected" | "reconnecting" | "disconnected";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a fresh, empty session state. */
export function createEmptySessionState(): SessionState {
  return {
    messages: [],
    isStreaming: false,
    status: "idle",
    streamingRunId: null,
    error: null,
    toolProgress: {},
    activeApproval: null,
    runMetadata: {},
    a2uiState: null,
    lastAccessedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Rendering helpers — extract typed content from ChatMessage
// ---------------------------------------------------------------------------

export function getTextContent(msg: { content: ContentBlock[] }): string {
  return msg.content
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export function getThinkingContent(msg: { content: ContentBlock[] }): string {
  return msg.content
    .filter((b): b is Extract<ContentBlock, { type: "thinking" }> => b.type === "thinking")
    .map((b) => b.text)
    .join("");
}

export function getToolUseBlocks(msg: {
  content: ContentBlock[];
}): Extract<ContentBlock, { type: "tool_use" }>[] {
  return msg.content.filter(
    (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use",
  );
}

export function getToolResultBlocks(msg: {
  content: ContentBlock[];
}): Extract<ContentBlock, { type: "tool_result" }>[] {
  return msg.content.filter(
    (b): b is Extract<ContentBlock, { type: "tool_result" }> => b.type === "tool_result",
  );
}

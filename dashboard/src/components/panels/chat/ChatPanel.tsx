"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useChatStore } from "@/stores/chat";
import {
  useSessionMessages,
  useActiveSessionKey,
  useSessionStreaming,
  useSessionA2UI,
} from "@/stores/chat-hooks";
import {
  loadBlockPreferences,
  saveBlockPreferences,
  type ChatBlockPreferences,
} from "@/stores/chat-preferences";
import type { ChatMessage, ContentBlock, SessionMeta } from "@/stores/chat-types";
import { useUIStore } from "@/stores/ui";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { BlockFilterBar } from "./BlockFilterBar";
import { CanvasPanel } from "./CanvasPanel";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { RightPanel } from "./RightPanel";
import { SessionSidebar } from "./SessionSidebar";
import { ToolProgressBar } from "./ToolProgressBar";
import { useChatSSE } from "./useChatSSE";

/** Context for artifact interactions — consumed by ToolResultCard and MessageInput. */
export const ArtifactContext = createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
  onToggleArtifactPanel: () => void;
  artifactPanelOpen: boolean;
}>({ onOpenArtifact: () => {}, onToggleArtifactPanel: () => {}, artifactPanelOpen: false });

/**
 * Convert Gateway ContentBlock[] to normalized ContentBlock[] for storage.
 *
 * Gateway history uses its own format that differs from Anthropic API:
 *   - `type: "toolCall"` → `type: "tool_use"` (with `arguments` → `input`)
 *   - `type: "tool_result"` may use `tool_use_id` (snake_case) → `toolUseId`
 */
function normalizeContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text" as const, text: content }];
  }
  if (Array.isArray(content)) {
    return (content as Record<string, unknown>[]).map((raw) => {
      // Gateway: toolCall → tool_use
      if (raw.type === "toolCall") {
        const args = raw.arguments ?? raw.input ?? {};
        return {
          type: "tool_use" as const,
          id: (raw.id as string) ?? "",
          name: (raw.name as string) ?? "unknown",
          input: (typeof args === "string" ? JSON.parse(args) : args) as Record<string, unknown>,
        };
      }
      // Anthropic: tool_result with snake_case tool_use_id
      if (raw.type === "tool_result" && raw.tool_use_id && !raw.toolUseId) {
        return {
          type: "tool_result" as const,
          toolUseId: raw.tool_use_id as string,
          content: (raw.content as string) ?? "",
          isError: (raw.isError as boolean) ?? false,
        };
      }
      return raw as ContentBlock;
    });
  }
  if (typeof content === "object" && content !== null) {
    return [{ type: "text" as const, text: JSON.stringify(content) }];
  }
  return [{ type: "text" as const, text: "" }];
}

/**
 * Merge Anthropic-format history messages into SSE-like format.
 *
 * Anthropic API stores tool interactions as separate messages:
 *   assistant: [tool_use blocks]
 *   user: [tool_result blocks]
 *   assistant: [text response]
 *
 * SSE combines everything into one assistant message. This function
 * merges tool_use assistant messages + following tool_result user messages
 * into the next text-bearing assistant message, so history renders
 * identically to real-time streaming.
 */
/**
 * Track pending tool_use IDs so we can pair them with their results.
 *
 * Gateway history format:
 *   assistant: [{type: "tool_use", id: "call_1", name: "read", input: {...}}, ...]
 *   user (was "toolResult"): [{type: "text", text: "file contents"}]  ← one per tool call
 *
 * The toolResult messages don't carry a `tool_result` type — they're just
 * `text` blocks. We identify them by: role="user" immediately following
 * tool_use messages, while we still have pending tool IDs.
 */
function mergeToolMessages(msgs: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let pendingToolBlocks: ContentBlock[] = [];
  let pendingToolIds: string[] = [];

  for (const msg of msgs) {
    const hasToolUse = msg.content.some((b) => b.type === "tool_use");

    if (msg.role === "assistant" && hasToolUse) {
      // Assistant message with tool_use blocks — buffer them
      for (const block of msg.content) {
        pendingToolBlocks.push(block);
        if (block.type === "tool_use") {
          pendingToolIds.push(block.id);
        }
      }
      continue;
    }

    if (msg.role === "user" && pendingToolIds.length > 0) {
      // This is a toolResult message — convert text blocks to tool_result blocks
      const toolId = pendingToolIds.shift()!;
      for (const block of msg.content) {
        if (block.type === "text") {
          // Wrap the text content as a proper tool_result block
          const isError =
            (block as { text: string }).text.startsWith('{ "status": "error"') ||
            (block as { text: string }).text.startsWith('{"status":"error"');
          pendingToolBlocks.push({
            type: "tool_result" as const,
            toolUseId: toolId,
            content: (block as { text: string }).text,
            isError,
          });
        } else if (block.type === "tool_result") {
          // Already a proper tool_result block
          pendingToolBlocks.push(block);
        }
      }
      continue;
    }

    if (pendingToolBlocks.length > 0 && msg.role === "assistant") {
      // Text assistant message after tool blocks — merge
      result.push({
        ...msg,
        content: [...pendingToolBlocks, ...msg.content],
      });
      pendingToolBlocks = [];
      pendingToolIds = [];
      continue;
    }

    // Regular message — flush any pending tool blocks as their own message
    if (pendingToolBlocks.length > 0) {
      result.push({
        id: `${msg.id}-tools`,
        role: "assistant",
        content: pendingToolBlocks,
        timestamp: msg.timestamp,
      });
      pendingToolBlocks = [];
      pendingToolIds = [];
    }
    result.push(msg);
  }

  // Flush remaining tool blocks
  if (pendingToolBlocks.length > 0) {
    const lastTs = msgs[msgs.length - 1]?.timestamp ?? Date.now();
    result.push({
      id: `orphan-tools-${lastTs}`,
      role: "assistant",
      content: pendingToolBlocks,
      timestamp: lastTs,
    });
  }

  return result;
}

/**
 * Chat panel — entry point component.
 * Composes session sidebar, message list, and input area.
 */
export function ChatPanel() {
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const messages = useSessionMessages();
  const { isStreaming } = useSessionStreaming();
  const [blockPrefs, setBlockPrefs] = useState<ChatBlockPreferences>(loadBlockPreferences);

  // Right panel state: hidden, canvas (A2UI), or artifact viewer
  const [rightPanelMode, setRightPanelMode] = useState<"hidden" | "canvas" | "artifact">("hidden");
  const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);

  // A2UI canvas state — auto-show when agent pushes a surface update
  const a2uiState = useSessionA2UI();
  useEffect(() => {
    if (a2uiState?.visible && rightPanelMode !== "canvas") {
      setRightPanelMode("canvas");
    }
  }, [a2uiState?.visible, rightPanelMode]);

  // Real-time canvas visibility — driven by SSE "present"/"dismiss" events
  // which set canvasVisible in useUIStore. This overrides the right panel mode.
  const canvasVisible = useUIStore((s) => s.canvasVisible);
  useEffect(() => {
    if (canvasVisible && rightPanelMode !== "canvas") {
      setRightPanelMode("canvas");
    } else if (!canvasVisible && rightPanelMode === "canvas") {
      setRightPanelMode("hidden");
    }
  }, [canvasVisible, rightPanelMode]);

  // Reset right panel when session changes
  useEffect(() => {
    setRightPanelMode("hidden");
    setActiveArtifact(null);
  }, [activeSessionKey]);

  const handleOpenArtifact = useCallback((artifact: ArtifactInfo) => {
    setActiveArtifact(artifact);
    setRightPanelMode("artifact");
  }, []);

  const handleCloseRightPanel = useCallback(() => {
    setRightPanelMode("hidden");
    // Keep activeArtifact so the toggle button can reopen it
    useUIStore.getState().setCanvasVisible(false);
  }, []);

  const handleToggleArtifactPanel = useCallback(() => {
    if (rightPanelMode === "artifact") {
      setRightPanelMode("hidden");
    } else if (activeArtifact) {
      setRightPanelMode("artifact");
    }
  }, [rightPanelMode, activeArtifact]);

  const artifactCtx = useMemo(
    () => ({
      onOpenArtifact: handleOpenArtifact,
      onToggleArtifactPanel: handleToggleArtifactPanel,
      artifactPanelOpen: rightPanelMode === "artifact",
    }),
    [handleOpenArtifact, handleToggleArtifactPanel, rightPanelMode],
  );

  const handleBlockPrefsChange = useCallback((prefs: ChatBlockPreferences) => {
    setBlockPrefs(prefs);
    saveBlockPreferences(prefs);
  }, []);

  // Show filter bar when there are tool/thinking blocks
  const hasFilterableBlocks = messages.some((m) =>
    m.content.some((b) => b.type === "thinking" || b.type === "tool_use"),
  );

  // Connect to SSE stream for real-time chat events.
  useChatSSE();

  // Fetch sessions on mount and when agent changes.
  useEffect(() => {
    const url = activeAgentId
      ? `/api/chat/sessions?agentId=${encodeURIComponent(activeAgentId)}`
      : "/api/chat/sessions";
    void fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const list: Array<{
          key?: string;
          sessionKey?: string;
          agentId?: string;
          title?: string;
          lastMessage?: string;
          updatedAt?: number;
        }> = Array.isArray(data) ? data : Array.isArray(data?.sessions) ? data.sessions : [];
        // Map server response to SessionMeta[]
        const metas: SessionMeta[] = list.map((s) => ({
          key: s.key ?? s.sessionKey ?? "",
          agentId: s.agentId ?? activeAgentId ?? "main",
          title: s.title,
          updatedAt: s.updatedAt ?? Date.now(),
          lastMessagePreview: s.lastMessage,
        }));
        useChatStore.getState().setSessionMetas(metas);
      })
      .catch(() => {});
  }, [activeAgentId]);

  // Fetch history when session changes.
  useEffect(() => {
    if (!activeSessionKey) {
      return;
    }
    // Skip history fetch while streaming — SSE messages are the source of truth.
    // History will be fetched via reloadFullContent after streaming completes.
    const session = useChatStore.getState().sessions.get(activeSessionKey);
    if (session?.isStreaming) {
      return;
    }
    const params = new URLSearchParams({ sessionKey: activeSessionKey });
    if (activeAgentId) {
      params.set("agentId", activeAgentId);
    }
    void fetch(`/api/chat/history?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
        const rawMsgs: ChatMessage[] = raw.map(
          (m: { role?: string; content?: unknown; timestamp?: number }, i: number) => {
            // Gateway uses "toolResult" role; normalize to "user" for rendering
            const role =
              m.role === "toolResult" ? "user" : ((m.role as ChatMessage["role"]) ?? "assistant");
            return {
              id: `${activeSessionKey}:${m.timestamp ?? 0}:${i}`,
              role,
              content: normalizeContent(m.content),
              timestamp: m.timestamp ?? Date.now(),
            };
          },
        );
        // Merge Anthropic-format tool messages so history renders like SSE
        const msgs = mergeToolMessages(rawMsgs);
        // For brand-new sessions the server returns empty history.
        // Preserve locally-added messages (e.g. the user message just sent)
        // to avoid a race where setMessages([]) wipes a pending outbound message.
        const currentMessages =
          useChatStore.getState().sessions.get(activeSessionKey)?.messages ?? [];
        if (msgs.length === 0 && currentMessages.length > 0) {
          return;
        }
        useChatStore.getState().setMessages(activeSessionKey, msgs);
      })
      .catch(() => {});
  }, [activeSessionKey, activeAgentId]);

  // Suppress lint — isStreaming and messages are used through the hooks above
  void isStreaming;

  return (
    <ArtifactContext.Provider value={artifactCtx}>
      <div
        className="flex h-full rounded-lg overflow-hidden border"
        style={{ borderColor: "var(--border)" }}
      >
        <SessionSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <MessageList blockPreferences={blockPrefs} />
          {hasFilterableBlocks && (
            <BlockFilterBar preferences={blockPrefs} onChange={handleBlockPrefsChange} />
          )}
          <ToolProgressBar />
          <MessageInput />
        </div>
        <RightPanel mode={rightPanelMode} onClose={handleCloseRightPanel}>
          {rightPanelMode === "canvas" && <CanvasPanel onClose={handleCloseRightPanel} />}
          {rightPanelMode === "artifact" && activeArtifact && (
            <ArtifactPanel artifact={activeArtifact} onClose={handleCloseRightPanel} />
          )}
        </RightPanel>
      </div>
    </ArtifactContext.Provider>
  );
}

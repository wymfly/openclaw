"use client";

import { createContext, useCallback, useEffect, useState } from "react";
import { useChatStore } from "@/stores/chat";
import { useSessionMessages, useActiveSessionKey, useSessionStreaming } from "@/stores/chat-hooks";
import {
  loadBlockPreferences,
  saveBlockPreferences,
  type ChatBlockPreferences,
} from "@/stores/chat-preferences";
import type { ChatMessage, ContentBlock, SessionMeta } from "@/stores/chat-types";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { BlockFilterBar } from "./BlockFilterBar";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { ToolProgressBar } from "./ToolProgressBar";
import { useChatSSE } from "./useChatSSE";

/** Context for artifact interactions — consumed by ToolResultCard. */
export const ArtifactContext = createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
}>({ onOpenArtifact: () => {} });

/** Convert Gateway ContentBlock[] to ContentBlock[] for storage. */
function normalizeContent(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text" as const, text: content }];
  }
  if (Array.isArray(content)) {
    // Already ContentBlock[] — pass through
    return content as ContentBlock[];
  }
  if (typeof content === "object" && content !== null) {
    return [{ type: "text" as const, text: JSON.stringify(content) }];
  }
  return [{ type: "text" as const, text: "" }];
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
    const params = new URLSearchParams({ sessionKey: activeSessionKey });
    if (activeAgentId) {
      params.set("agentId", activeAgentId);
    }
    void fetch(`/api/chat/history?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [];
        const msgs: ChatMessage[] = raw.map(
          (m: { role?: string; content?: unknown; timestamp?: number }, i: number) => ({
            id: `hist-${i}`,
            role: (m.role as ChatMessage["role"]) ?? "assistant",
            content: normalizeContent(m.content),
            timestamp: m.timestamp ?? Date.now(),
          }),
        );
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
    </div>
  );
}

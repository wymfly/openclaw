"use client";

import { useEffect } from "react";
import { useChatStore, type ChatMessage } from "@/stores/chat";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useChatSSE } from "./useChatSSE";

/** Convert Gateway ContentBlock[] to plain string for display. */
function flattenContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((b: { type?: string; text?: string }) => (b.type === "text" ? (b.text ?? "") : ""))
      .join("");
  }
  return typeof content === "object" && content !== null ? JSON.stringify(content) : "";
}

/**
 * Chat panel — entry point component.
 * Composes session sidebar, message list, and input area.
 */
export function ChatPanel() {
  const { activeSessionId, activeAgentId, setSessions, setMessages } = useChatStore();

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
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.sessions)
            ? data.sessions
            : [];
        setSessions(list);
      })
      .catch(() => {});
  }, [activeAgentId, setSessions]);

  // Fetch history when session changes.
  useEffect(() => {
    if (!activeSessionId) {
      return;
    }
    const params = new URLSearchParams({ sessionKey: activeSessionId });
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
            content: flattenContent(m.content),
            timestamp: m.timestamp ?? Date.now(),
          }),
        );
        setMessages(msgs);
      })
      .catch(() => {});
  }, [activeSessionId, activeAgentId, setMessages]);

  return (
    <div
      className="flex h-full rounded-lg overflow-hidden border"
      style={{ borderColor: "var(--border)" }}
    >
      <SessionSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}

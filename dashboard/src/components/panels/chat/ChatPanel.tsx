"use client";

import { useEffect } from "react";
import { useChatStore } from "@/stores/chat";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useChatSSE } from "./useChatSSE";

/**
 * Chat panel — entry point component.
 * Composes session sidebar, message list, and input area.
 *
 * Design baseline: rounded container with ring border,
 * internal sections separated by borders, card-elevated bg.
 */
export function ChatPanel() {
  const { activeSessionId, activeAgentId, setSessions, setMessages } = useChatStore();

  useChatSSE();

  useEffect(() => {
    const url = activeAgentId
      ? `/api/chat/sessions?agentId=${encodeURIComponent(activeAgentId)}`
      : "/api/chat/sessions";
    void fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data);
        }
      })
      .catch(() => {});
  }, [activeAgentId, setSessions]);

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
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(() => {});
  }, [activeSessionId, activeAgentId, setMessages]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      <SessionSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}

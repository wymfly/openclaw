"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useChatStore } from "@/stores/chat";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useChatSSE } from "./useChatSSE";

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
        if (Array.isArray(data)) {
          setSessions(data);
        }
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
        if (Array.isArray(data)) {
          setMessages(data);
        }
      })
      .catch(() => {});
  }, [activeSessionId, activeAgentId, setMessages]);

  return (
    <Card className="flex-row h-full p-0 gap-0">
      <SessionSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <MessageList />
        <MessageInput />
      </div>
    </Card>
  );
}

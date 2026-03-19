"use client";

import { PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChatStore, type ChatMessage, type SessionInfo } from "@/stores/chat";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useChatSSE } from "./useChatSSE";

// ---------------------------------------------------------------------------
// Gateway → ChatMessage adapters
// ---------------------------------------------------------------------------

type GatewayContentBlock = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: Record<string, unknown>;
};
type GatewayMessage = { role: string; content: GatewayContentBlock[]; timestamp?: number };

/** Convert a Gateway history message to the UI ChatMessage shape. */
function toUiMessage(msg: GatewayMessage, index: number): ChatMessage {
  const textParts: string[] = [];
  let thinking: string | undefined;
  for (const block of msg.content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    } else if (block.type === "thinking" && block.thinking) {
      thinking = (thinking ?? "") + block.thinking;
    }
  }
  return {
    id: `hist-${index}`,
    role: msg.role as ChatMessage["role"],
    content: textParts.join("\n"),
    timestamp: msg.timestamp ?? Date.now(),
    thinking,
  };
}

type GatewaySessionEntry = {
  key: string;
  sessionId?: string;
  agentId?: string;
  derivedTitle?: string;
  lastMessage?: string;
  updatedAt?: number;
};

function toUiSession(s: GatewaySessionEntry): SessionInfo {
  return {
    key: s.key,
    sessionId: s.sessionId,
    agentId: s.agentId,
    title: s.derivedTitle,
    lastMessage: s.lastMessage,
    updatedAt: s.updatedAt,
  };
}

// ---------------------------------------------------------------------------

/**
 * Chat panel — entry point component.
 * Composes session sidebar, message list, and input area.
 *
 * Design baseline: rounded container with ring border,
 * internal sections separated by borders, card-elevated bg.
 *
 * On narrow screens (< 1024px) the session sidebar collapses into
 * a Sheet overlay toggled by a small button, giving the message
 * area full width.
 */
export function ChatPanel() {
  const { activeSessionId, activeAgentId, setSessions, setMessages } = useChatStore();
  const isCompact = useMediaQuery("(max-width: 1023px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useChatSSE();

  useEffect(() => {
    const url = activeAgentId
      ? `/api/chat/sessions?agentId=${encodeURIComponent(activeAgentId)}`
      : "/api/chat/sessions";
    void fetch(url)
      .then((r) => r.json())
      .then((data: { sessions?: GatewaySessionEntry[] } | GatewaySessionEntry[]) => {
        const list = Array.isArray(data) ? data : data.sessions;
        if (Array.isArray(list)) {
          setSessions(list.map(toUiSession));
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
      .then((data: { messages?: GatewayMessage[] } | GatewayMessage[]) => {
        const list = Array.isArray(data) ? data : data.messages;
        if (Array.isArray(list)) {
          setMessages(list.map(toUiMessage));
        }
      })
      .catch(() => {});
  }, [activeSessionId, activeAgentId, setMessages]);

  return (
    <div className="flex h-full overflow-hidden rounded-xl bg-[var(--bg-secondary)] ring-1 ring-[var(--border)]">
      {/* Desktop: inline sidebar */}
      {!isCompact && <SessionSidebar />}

      {/* Compact: sidebar as sheet overlay */}
      {isCompact && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="data-[side=left]:w-64 data-[side=left]:sm:max-w-64 gap-0 p-0 bg-[var(--bg-secondary)]"
          >
            <SheetTitle className="sr-only">Sessions</SheetTitle>
            <SessionSidebar onSessionSelect={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Compact: toggle button for sidebar */}
        {isCompact && (
          <div className="flex items-center h-9 px-2 border-b border-[var(--border-subtle)] shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center gap-1.5 h-7 px-2 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <PanelLeft size={14} />
              <span>Sessions</span>
            </button>
          </div>
        )}
        <MessageList />
        <MessageInput />
      </div>
    </div>
  );
}

"use client";

import { PanelLeft } from "lucide-react";
import { createContext, useCallback, useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChatStore, type ChatMessage, type ContentBlock, type SessionInfo } from "@/stores/chat";
import { ApprovalDialog } from "./ApprovalDialog";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useChatSSE } from "./useChatSSE";

// ---------------------------------------------------------------------------
// Artifact context — lets ToolResultCard open the panel without prop drilling
// ---------------------------------------------------------------------------
export const ArtifactContext = createContext<{
  onOpenArtifact: (artifact: ArtifactInfo) => void;
}>({ onOpenArtifact: () => {} });

// ---------------------------------------------------------------------------
// Gateway → ChatMessage adapters
// ---------------------------------------------------------------------------

// Tool call type aliases (Gateway transcript uses multiple variants)
const TOOL_USE_TYPES = new Set(["tool_use", "toolcall", "tool_call"]);
const TOOL_RESULT_TYPES = new Set(["tool_result", "tool_result_error"]);

type GatewayMessage = { role: string; content: Record<string, unknown>[]; timestamp?: number };

/** Convert a Gateway history message to the UI ChatMessage shape, mapping all content block types. */
function toUiMessage(msg: GatewayMessage, index: number): ChatMessage {
  const blocks: ContentBlock[] = (msg.content ?? []).map((block) => {
    const type = ((block.type as string) ?? "text").toLowerCase();
    if (type === "text") {
      return { type: "text" as const, text: (block.text as string) ?? "" };
    }
    if (type === "image") {
      const source = block.source as Record<string, unknown> | undefined;
      return {
        type: "image" as const,
        data: (source?.data as string) ?? "",
        mimeType: (source?.media_type as string) ?? "",
      };
    }
    if (TOOL_USE_TYPES.has(type)) {
      return {
        type: "tool_use" as const,
        id: (block.id as string) ?? "",
        name: (block.name as string) ?? "",
        input: (block.input ?? block.arguments ?? {}) as Record<string, unknown>,
      };
    }
    if (TOOL_RESULT_TYPES.has(type)) {
      return {
        type: "tool_result" as const,
        toolUseId: ((block.tool_use_id ?? block.toolUseId) as string) ?? "",
        content: ((block.content ?? block.output) as string) ?? "",
        isError: block.is_error === true || type === "tool_result_error",
      };
    }
    if (type === "thinking") {
      return { type: "thinking" as const, text: ((block.thinking ?? block.text) as string) ?? "" };
    }
    // Unknown block — serialise as text to avoid silent data loss
    return { type: "text" as const, text: JSON.stringify(block) };
  });
  return {
    id: `hist-${index}`,
    role: msg.role as ChatMessage["role"],
    content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
    timestamp: msg.timestamp ?? Date.now(),
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
  const {
    activeSessionId,
    activeAgentId,
    setSessions,
    setMessages,
    activeApproval,
    setActiveApproval,
  } = useChatStore();
  const isCompact = useMediaQuery("(max-width: 1023px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);

  useChatSSE();

  /**
   * Relay the user's approval decision to the Gateway and clear the dialog.
   * Uses the dedicated /api/exec/approval route which calls exec.approval.resolve.
   * Clear only on success so the user can retry on network/server failure.
   */
  const handleResolveApproval = useCallback(
    async (id: string, decision: "allow-once" | "allow-always" | "deny") => {
      try {
        const res = await fetch("/api/exec/approval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, decision }),
        });
        if (res.ok) {
          setActiveApproval(null); // Clear only on success
        }
      } catch {
        // Keep dialog visible on error so user can retry
      }
    },
    [setActiveApproval],
  );

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
      {/* Desktop: inline sidebar — hidden when artifact panel is open */}
      {!isCompact && !activeArtifact && <SessionSidebar />}

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
        <ArtifactContext.Provider value={{ onOpenArtifact: setActiveArtifact }}>
          <MessageList />
        </ArtifactContext.Provider>
        {activeApproval && (
          <ApprovalDialog
            approval={activeApproval}
            onResolve={(id, decision) => void handleResolveApproval(id, decision)}
          />
        )}
        <MessageInput />
      </div>

      {/* Artifact panel — shown beside chat when an artifact is active */}
      {activeArtifact && (
        <ArtifactPanel artifact={activeArtifact} onClose={() => setActiveArtifact(null)} />
      )}
    </div>
  );
}

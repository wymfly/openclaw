"use client";

import { PanelLeft } from "lucide-react";
import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useChatStore, type ChatMessage, type ContentBlock } from "@/stores/chat";
import { useActiveSessionKey, useSessionApproval, useSessionStreaming } from "@/stores/chat-hooks";
import { ApprovalDialog } from "./ApprovalDialog";
import { ArtifactPanel } from "./artifacts/ArtifactPanel";
import type { ArtifactInfo } from "./artifacts/detectArtifact";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";
import { SessionSidebar } from "./SessionSidebar";
import { useSSEConnection } from "./useChatSSE";

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
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const { isStreaming } = useSessionStreaming();
  const activeApproval = useSessionApproval();
  const refreshSessionMeta = useChatStore((s) => s.refreshSessionMeta);
  const setActiveApprovalAction = useChatStore((s) => s.setActiveApproval);

  const isCompact = useMediaQuery("(max-width: 1023px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<ArtifactInfo | null>(null);

  useSSEConnection();

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
        if (res.ok && activeSessionKey) {
          setActiveApprovalAction(activeSessionKey, null); // Clear only on success
        }
      } catch {
        // Keep dialog visible on error so user can retry
      }
    },
    [activeSessionKey, setActiveApprovalAction],
  );

  // Refresh session list on mount, agent change, and after streaming completes
  // (streaming completion may have created a new session with a derived title)
  useEffect(() => {
    void refreshSessionMeta();
  }, [refreshSessionMeta, activeAgentId]);

  // Refresh sessions after a reply completes (picks up new session titles)
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      void refreshSessionMeta();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, refreshSessionMeta]);

  // Load history when active session changes
  useEffect(() => {
    if (!activeSessionKey) {
      return;
    }

    // Guard against stale fetch responses: if activeSessionKey changes
    // while fetch is in flight, discard the response.
    let cancelled = false;
    const params = new URLSearchParams({ sessionKey: activeSessionKey });
    if (activeAgentId) {
      params.set("agentId", activeAgentId);
    }
    void fetch(`/api/chat/history?${params}`)
      .then((r) => r.json())
      .then((data: { messages?: GatewayMessage[] } | GatewayMessage[]) => {
        if (cancelled) {
          return;
        }
        const list = Array.isArray(data) ? data : data.messages;
        if (Array.isArray(list)) {
          useChatStore.getState().setMessages(activeSessionKey, list.map(toUiMessage));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeSessionKey, activeAgentId]);

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

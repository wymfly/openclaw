"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore, type SessionInfo } from "@/stores/chat";

function formatTime(ts?: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionSidebar({ onSessionSelect }: { onSessionSelect?: () => void } = {}) {
  const t = useTranslations("chat");
  const {
    sessions,
    activeSessionId,
    activeAgentId,
    setActiveSession,
    setActiveAgent,
    clearMessages,
  } = useChatStore();

  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const handleNew = () => {
    // Generate a unique session key for the new session
    // Format: agent:<agentId>:<unique-id> (matches Gateway session key convention)
    const agentId = activeAgentId || "main";
    const uniqueId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newSessionKey = `agent:${agentId}:${uniqueId}`;
    setActiveSession(newSessionKey);
    clearMessages();
    onSessionSelect?.();
  };

  const handleSelect = (session: SessionInfo) => {
    setActiveSession(session.key);
    if (session.agentId) {
      setActiveAgent(session.agentId);
    }
    onSessionSelect?.();
  };

  const handleDelete = async (sessionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/chat/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, agentId: activeAgentId }),
    });
    if (activeSessionId === sessionKey) {
      setActiveSession(null);
      clearMessages();
    }
  };

  return (
    <aside className="flex flex-col w-full sm:w-56 shrink-0 border-r border-[var(--border)] h-full bg-[var(--bg-secondary)]">
      {/* Agent selector */}
      <div className="p-2.5 border-b border-[var(--border-subtle)]">
        <Select
          value={activeAgentId ?? "_default"}
          onValueChange={(val) => setActiveAgent(val === "_default" ? null : val)}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("defaultAgent")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_default">{t("defaultAgent")}</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New session */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNew}
        className="justify-start gap-1.5 mx-2 mt-2 mb-1 text-[var(--accent)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
      >
        <Plus size={14} />
        {t("newSession")}
      </Button>

      {/* Session list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-0.5">
          {sessions.map((session) => {
            const isActive = activeSessionId === session.key;
            return (
              <button
                key={session.key}
                onClick={() => handleSelect(session)}
                className={cn(
                  "relative flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer group",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                  isActive
                    ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
                )}
              >
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]"
                    aria-hidden
                  />
                )}

                <div className="flex flex-col items-start min-w-0">
                  <span className="truncate w-full text-left font-medium">
                    {session.title || session.key}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {formatTime(session.updatedAt)}
                  </span>
                </div>

                {/* Delete on hover */}
                <span
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 text-[var(--text-secondary)] hover:text-[var(--danger)] cursor-pointer"
                  onClick={(e) => void handleDelete(session.key, e)}
                  role="button"
                  tabIndex={-1}
                  aria-label="Delete session"
                >
                  <Trash2 size={12} />
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

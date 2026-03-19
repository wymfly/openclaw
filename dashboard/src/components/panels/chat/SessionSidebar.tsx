"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

export function SessionSidebar() {
  const t = useTranslations("chat");
  const {
    sessions,
    activeSessionId,
    activeAgentId,
    setActiveSession,
    setActiveAgent,
    clearMessages,
  } = useChatStore();

  const handleNew = () => {
    setActiveSession(null);
    clearMessages();
  };

  const handleSelect = (session: SessionInfo) => {
    setActiveSession(session.key);
    if (session.agentId) {
      setActiveAgent(session.agentId);
    }
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
    <aside className="flex flex-col w-56 shrink-0 border-r h-full bg-card">
      {/* Agent selector */}
      <div className="p-2 border-b">
        <Select
          value={activeAgentId ?? "_default"}
          onValueChange={(val) => setActiveAgent(val === "_default" ? null : val)}
        >
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder={t("defaultAgent")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_default">{t("defaultAgent")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* New session button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleNew}
        className="justify-start gap-1.5 rounded-none border-b text-primary"
      >
        <Plus size={14} />
        {t("newSession")}
      </Button>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {sessions.map((session) => {
          const isActive = activeSessionId === session.key;
          return (
            <button
              key={session.key}
              onClick={() => handleSelect(session)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group cursor-pointer",
                isActive ? "bg-primary/[0.12] text-primary" : "text-foreground hover:bg-muted",
              )}
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate w-full text-left">{session.title || session.key}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(session.updatedAt)}
                </span>
              </div>
              <span
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 text-muted-foreground"
                onClick={(e) => void handleDelete(session.key, e)}
                role="button"
                tabIndex={-1}
              >
                <Trash2 size={12} />
              </span>
            </button>
          );
        })}
      </ScrollArea>
    </aside>
  );
}

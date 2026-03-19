"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSessionsStore, type HistoryMessage, type SessionEntry } from "@/stores/sessions";

function pressureBarClass(pct: number): string {
  if (pct >= 80) {
    return "bg-[var(--danger)]";
  }
  if (pct >= 60) {
    return "bg-[var(--warning)]";
  }
  return "bg-[var(--success)]";
}

function pressureTextClass(pct: number): string {
  if (pct >= 80) {
    return "text-[var(--danger)]";
  }
  if (pct >= 60) {
    return "text-[var(--warning)]";
  }
  return "text-[var(--success)]";
}

function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

function formatTime(ts: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

function HistoryBubble({ message }: { message: HistoryMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.timestamp && (
          <span
            className={cn(
              "block text-[10px] mt-1 opacity-60",
              isUser ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

export function SessionDetail() {
  const t = useTranslations("sessions");
  const tc = useTranslations("common");
  const { sessions, selectedKey, history, deleteSession } = useSessionsStore();
  const [confirming, setConfirming] = useState(false);

  const session = sessions.find((s) => s.key === selectedKey);
  if (!session) {
    return null;
  }

  const pct = contextPct(session);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    void deleteSession(session.key);
    setConfirming(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-card">
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold truncate font-mono text-foreground"
            title={session.key}
          >
            {session.key}
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            {session.model && (
              <span className="text-xs text-muted-foreground">
                {t("model")}: {session.model}
              </span>
            )}
            {session.updatedAt > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("updatedAt")}: {formatTime(session.updatedAt)}
              </span>
            )}
          </div>
        </div>

        <Button
          variant={confirming ? "destructive" : "ghost"}
          size="icon-sm"
          title={confirming ? t("confirmDelete") : tc("delete")}
          onClick={handleDelete}
          onBlur={() => setConfirming(false)}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Stats + context bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-4 mb-2">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground">{t("tokensIn")}</span>
            <p className="text-sm font-medium text-foreground">{formatTokens(session.tokensIn)}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground">{t("tokensOut")}</span>
            <p className="text-sm font-medium text-foreground">{formatTokens(session.tokensOut)}</p>
          </div>
        </div>

        {session.contextWindow > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{t("context")}</span>
              <span className={cn("text-xs font-medium", pressureTextClass(pct))}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", pressureBarClass(pct))}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Conversation history */}
      <ScrollArea className="flex-1 px-4 py-3">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t("history")}</p>
          </div>
        ) : (
          history.map((msg, i) => <HistoryBubble key={`${msg.role}-${i}`} message={msg} />)
        )}
      </ScrollArea>
    </div>
  );
}

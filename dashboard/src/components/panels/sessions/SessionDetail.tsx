"use client";

import { Trash2, User, Bot } from "lucide-react";
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
    <div className={cn("flex gap-3 mb-4 transition-panel", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center ring-1",
          isUser
            ? "bg-[var(--accent-muted)] text-[var(--accent)] ring-[var(--accent)]/20"
            : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ring-[var(--border)]",
        )}
      >
        {isUser ? <User size={12} /> : <Bot size={12} />}
      </div>

      {/* Content */}
      <div
        className={cn("flex flex-col max-w-[75%] min-w-0", isUser ? "items-end" : "items-start")}
      >
        <div
          className={cn(
            "px-3 py-2 text-sm leading-relaxed",
            isUser
              ? "bg-[var(--accent)] text-white rounded-2xl rounded-br-md"
              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-2xl rounded-bl-md ring-1 ring-[var(--border-subtle)]",
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        {message.timestamp && (
          <span className="text-[10px] mt-1 px-1 text-[var(--text-secondary)] font-mono">
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
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold truncate font-mono text-[var(--text-primary)]"
            title={session.key}
          >
            {session.key}
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            {session.model && (
              <span className="text-xs text-[var(--text-secondary)]">
                {t("model")}: <span className="font-mono">{session.model}</span>
              </span>
            )}
            {session.updatedAt > 0 && (
              <span className="text-xs text-[var(--text-secondary)]">
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
          className={cn(
            "cursor-pointer",
            !confirming &&
              "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
          )}
        >
          <Trash2 size={15} />
        </Button>
      </div>

      {/* Stats + context bar */}
      <div className="px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-6 mb-2">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              {t("tokensIn")}
            </span>
            <p className="text-sm font-semibold font-mono text-[var(--text-primary)]">
              {formatTokens(session.tokensIn)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
              {t("tokensOut")}
            </span>
            <p className="text-sm font-semibold font-mono text-[var(--text-primary)]">
              {formatTokens(session.tokensOut)}
            </p>
          </div>
        </div>

        {session.contextWindow > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text-secondary)]">{t("context")}</span>
              <span className={cn("text-xs font-semibold font-mono", pressureTextClass(pct))}>
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  pressureBarClass(pct),
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Conversation history */}
      <ScrollArea className="flex-1 px-5 py-4">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
            <p className="text-sm">{t("history")}</p>
          </div>
        ) : (
          history.map((msg, i) => <HistoryBubble key={`${msg.role}-${i}`} message={msg} />)
        )}
      </ScrollArea>
    </div>
  );
}

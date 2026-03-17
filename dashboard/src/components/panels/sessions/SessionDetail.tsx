"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSessionsStore, type HistoryMessage, type SessionEntry } from "@/stores/sessions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Color for context usage percentage. */
function pressureColor(pct: number): string {
  if (pct >= 80) {
    return "#ef4444";
  }
  if (pct >= 60) {
    return "#eab308";
  }
  return "#22c55e";
}

/** Compute context usage percentage (0-100). */
function contextPct(session: SessionEntry): number {
  if (session.contextWindow <= 0) {
    return 0;
  }
  const used = session.tokensIn + session.tokensOut;
  return Math.min(100, Math.round((used / session.contextWindow) * 100));
}

/** Format a timestamp for display. */
function formatTime(ts: number): string {
  if (!ts) {
    return "";
  }
  return new Date(ts).toLocaleString();
}

/** Format token count for display. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HistoryBubble({ message }: { message: HistoryMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className="max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed"
        style={{
          backgroundColor: isUser ? "var(--accent)" : "var(--bg-secondary)",
          color: isUser ? "#fff" : "var(--text-primary)",
        }}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.timestamp && (
          <span
            className="block text-[10px] mt-1 opacity-60"
            style={{ color: isUser ? "#fff" : "var(--text-secondary)" }}
          >
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SessionDetail — shows session metadata, token stats, context bar,
 * conversation history, and a delete button.
 */
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
  const color = pressureColor(pct);

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
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-secondary)",
        }}
      >
        <div className="min-w-0">
          <h3
            className="text-sm font-semibold truncate font-mono"
            style={{ color: "var(--text-primary)" }}
            title={session.key}
          >
            {session.key}
          </h3>
          <div className="flex items-center gap-3 mt-0.5">
            {session.model && (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("model")}: {session.model}
              </span>
            )}
            {session.updatedAt > 0 && (
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("updatedAt")}: {formatTime(session.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          className="shrink-0 p-1.5 rounded-md transition-colors"
          style={{
            color: confirming ? "#fff" : "var(--text-secondary)",
            backgroundColor: confirming ? "#ef4444" : "transparent",
          }}
          title={confirming ? t("confirmDelete") : tc("delete")}
          onClick={handleDelete}
          onBlur={() => setConfirming(false)}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Stats + context bar */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        {/* Token stats */}
        <div className="flex items-center gap-4 mb-2">
          <div>
            <span className="text-[10px] uppercase" style={{ color: "var(--text-secondary)" }}>
              {t("tokensIn")}
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {formatTokens(session.tokensIn)}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase" style={{ color: "var(--text-secondary)" }}>
              {t("tokensOut")}
            </span>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {formatTokens(session.tokensOut)}
            </p>
          </div>
        </div>

        {/* Context usage bar */}
        {session.contextWindow > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("context")}
              </span>
              <span className="text-xs font-medium" style={{ color }}>
                {pct}%
              </span>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--bg-secondary)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {history.length === 0 ? (
          <div
            className="flex items-center justify-center h-full"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-sm">{t("history")}</p>
          </div>
        ) : (
          history.map((msg, i) => <HistoryBubble key={`${msg.role}-${i}`} message={msg} />)
        )}
      </div>
    </div>
  );
}

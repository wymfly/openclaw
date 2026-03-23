"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";

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

/** Derive a friendly display title from session key or metadata. */
function sessionTitle(session: SessionMeta): string {
  if (session.title) {
    return session.title;
  }
  // Parse "agent:{agentId}:web-{ts}-{rand}" -> "agentId - Web Chat"
  const parts = session.key.split(":");
  if (parts.length >= 3 && parts[0] === "agent") {
    const agentId = parts[1];
    const suffix = parts.slice(2).join(":");
    if (suffix === "main") {
      return `${agentId} · Main`;
    }
    if (suffix.startsWith("web-")) {
      return `${agentId} · Web Chat`;
    }
    if (suffix.startsWith("direct:")) {
      return `${agentId} · DM`;
    }
    return `${agentId} · ${suffix.slice(0, 12)}`;
  }
  return session.key.length > 24 ? `${session.key.slice(0, 24)}...` : session.key;
}

export function SessionSidebar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const sessionMetas = useChatStore((s) => s.sessionMetas);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);

  const handleNew = () => {
    setActiveSession(null);
  };

  const handleSelect = (session: SessionMeta) => {
    setActiveSession(session.key);
    if (session.agentId) {
      setActiveAgent(session.agentId);
    }
  };

  const handleDelete = async (sessionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await fetch("/api/chat/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, agentId: activeAgentId }),
    });
    if (res.ok) {
      useChatStore.getState().setSessionMetas(sessionMetas.filter((s) => s.key !== sessionKey));
      useChatStore.getState().removeSession(sessionKey);
      if (activeSessionKey === sessionKey) {
        setActiveSession(null);
      }
    }
  };

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Agent selector */}
      <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
        <select
          value={activeAgentId ?? ""}
          onChange={(e) => setActiveAgent(e.target.value || null)}
          className="w-full text-xs rounded px-2 py-1.5"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">{t("defaultAgent")}</option>
        </select>
      </div>

      {/* New session button */}
      <button
        onClick={handleNew}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b hover:opacity-80 transition-opacity"
        style={{ borderColor: "var(--border)", color: "var(--brand)" }}
      >
        <Plus size={14} />
        {t("newSession")}
      </button>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessionMetas.map((session) => {
          const isActive = activeSessionKey === session.key;
          return (
            <button
              key={session.key}
              onClick={() => handleSelect(session)}
              className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--brand) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--brand)" : "var(--text-primary)",
              }}
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate w-full text-left">{sessionTitle(session)}</span>
                <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                  {formatTime(session.updatedAt)}
                </span>
              </div>
              <span
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                onClick={(e) => void handleDelete(session.key, e)}
                role="button"
                tabIndex={-1}
                style={{ color: "var(--text-secondary)" }}
              >
                <Trash2 size={12} />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

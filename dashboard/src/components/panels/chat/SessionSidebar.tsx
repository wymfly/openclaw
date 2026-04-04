"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { deckFetch } from "@/lib/deck-client";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { patchSession } from "./chat-api";

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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const activeSessionKey = useActiveSessionKey();
  const activeAgentId = useChatStore((s) => s.activeAgentId);
  const sessionMetas = useChatStore((s) => s.sessionMetas);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setActiveAgent = useChatStore((s) => s.setActiveAgent);
  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

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
    const res = await deckFetch("/api/chat/sessions", {
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

  const handleStartRename = (session: SessionMeta) => {
    cancelRenameRef.current = false;
    setEditingKey(session.key);
    setEditValue(session.title ?? sessionTitle(session));
  };

  const handleFinishRename = async (session: SessionMeta) => {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      return;
    }
    const trimmed = editValue.trim();
    setEditingKey(null);
    if (!trimmed) {
      return;
    }
    const current = session.title ?? sessionTitle(session);
    if (trimmed === current) {
      return;
    }
    const ok = await patchSession(session.key, { label: trimmed });
    if (ok) {
      useChatStore.setState((s) => {
        const metas = s.sessionMetas.map((m) =>
          m.key === session.key ? { ...m, title: trimmed } : m,
        );
        return { sessionMetas: metas, sessionMeta: metas };
      });
    }
  };

  const filteredMetas = useMemo(() => {
    if (!searchQuery.trim()) {
      return sessionMetas;
    }
    const q = searchQuery.toLowerCase();
    return sessionMetas.filter((session) => {
      const title = (session.title ?? sessionTitle(session)).toLowerCase();
      return title.includes(q);
    });
  }, [sessionMetas, searchQuery]);

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Agent selector */}
      <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
        <select
          value={activeAgentId ?? ""}
          onChange={(e) => setActiveAgent(e.target.value || null)}
          className="w-full text-xs rounded px-2 py-1.5"
          style={{
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          <option value="">{t("defaultAgent")}</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name || agent.id}
            </option>
          ))}
        </select>
      </div>

      {/* New session button */}
      <button
        onClick={handleNew}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b hover:opacity-80 transition-opacity"
        style={{ borderColor: "var(--border)", color: "var(--primary)" }}
      >
        <Plus size={14} />
        {t("newSession")}
      </button>

      {/* Search */}
      <div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchSessions")}
          className="w-full text-xs rounded px-2 py-1"
          style={{
            backgroundColor: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {filteredMetas.map((session) => {
          const isActive = activeSessionKey === session.key;
          return (
            <div
              key={session.key}
              className="flex items-center justify-between w-full px-3 py-2 text-xs transition-colors group"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--primary)" : "var(--foreground)",
              }}
            >
              <div className="flex flex-col items-start min-w-0 flex-1">
                {editingKey === session.key ? (
                  <input
                    ref={editRef}
                    className="w-full text-xs bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] rounded px-1 py-0.5"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRenameRef.current = true;
                        setEditingKey(null);
                      }
                    }}
                    onBlur={() => void handleFinishRename(session)}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="truncate w-full text-left"
                    onClick={() => handleSelect(session)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(session);
                    }}
                  >
                    {sessionTitle(session)}
                  </button>
                )}
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {formatTime(session.updatedAt)}
                </span>
              </div>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                onClick={(e) => void handleDelete(session.key, e)}
                style={{ color: "var(--muted-foreground)" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

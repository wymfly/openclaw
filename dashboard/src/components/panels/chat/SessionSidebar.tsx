"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { deckFetch } from "@/lib/deck-client";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { AgentTabs } from "./AgentTabs";
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

  const handleNew = () => {
    setActiveSession(null);
  };

  const handleSelect = (session: SessionMeta) => {
    setActiveSession(session.key);
    if (session.agentId) {
      setActiveAgent(session.agentId);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDeleteClick = useCallback((sessionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(sessionKey);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const res = await deckFetch("/api/chat/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey: deleteTarget, agentId: activeAgentId }),
      });
      if (res.ok) {
        useChatStore.getState().setSessionMetas(sessionMetas.filter((s) => s.key !== deleteTarget));
        useChatStore.getState().removeSession(deleteTarget);
        if (activeSessionKey === deleteTarget) {
          setActiveSession(null);
        }
      }
    } catch {
      // Network error — silently close dialog
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, activeAgentId, sessionMetas, activeSessionKey, setActiveSession]);

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
      const preview = (session.lastMessagePreview ?? "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [sessionMetas, searchQuery]);

  return (
    <aside
      className="flex flex-col w-56 shrink-0 border-r h-full"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
    >
      {/* Agent tabs */}
      <AgentTabs />

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
              className="flex items-center justify-between w-full px-3 py-3 text-xs transition-colors group cursor-pointer"
              style={{
                backgroundColor: isActive
                  ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                  : "transparent",
                color: isActive ? "var(--primary)" : "var(--foreground)",
              }}
              onClick={() => handleSelect(session)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartRename(session);
              }}
            >
              <div className="flex flex-col items-start min-w-0 flex-1">
                {editingKey === session.key ? (
                  <input
                    ref={editRef}
                    className="w-full text-xs bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] rounded px-1 py-0.5"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
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
                  <span className="truncate w-full text-left font-medium">
                    {sessionTitle(session)}
                  </span>
                )}
                {session.lastMessagePreview && (
                  <span
                    className="truncate w-full text-[10px]"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {session.lastMessagePreview}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {formatTime(session.updatedAt)}
                </span>
              </div>
              <button
                type="button"
                aria-label={t("deleteConfirmTitle")}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 p-1 rounded hover:bg-[var(--muted)]"
                onClick={(e) => handleDeleteClick(session.key, e)}
                style={{ color: "var(--muted-foreground)" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog — compact */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false} className="max-w-[220px] p-3 gap-2 rounded-lg">
          <p className="text-xs text-center" style={{ color: "var(--foreground)" }}>
            {t("deleteConfirmMessage")}
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => setDeleteTarget(null)}
            >
              {t("deleteConfirmCancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-3"
              onClick={() => void handleDeleteConfirm()}
            >
              {t("deleteConfirmOk")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, TrashIcon } from "@/deck-ui/icons";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { AgentTabs } from "./AgentTabs";
import { deleteChatSession, fetchSessionPreviews, patchSession } from "./chat-api";

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "";
  }
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionTitle(session: SessionMeta): string {
  if (session.title) {
    return session.title;
  }
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

function finalSessionPreview(
  session: SessionMeta,
  overlays: Record<string, { text: string } | undefined>,
): string {
  return overlays[session.key]?.text ?? session.lastMessagePreview ?? "";
}

export function SessionSidebar(
  props: {
    sessionMetas?: SessionMeta[];
    sessionPreviewOverlays?: Record<string, { text: string } | undefined>;
    activeSessionKey?: string | null;
    activeAgentId?: string | null;
    onCreateSession?: () => void;
    onSelectSession?: (session: SessionMeta) => void;
  } = {},
) {
  const t = useTranslations("chat");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const cancelRenameRef = useRef(false);
  const storeActiveSessionKey = useActiveSessionKey();
  const storeActiveAgentId = useChatStore((state) => state.activeAgentId);
  const storeSessionMetas = useChatStore((state) => state.sessionMetas);
  const storeSessionPreviewOverlays = useChatStore((state) => state.sessionPreviewOverlays);
  const setActiveSession = useChatStore((state) => state.setActiveSession);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const activeSessionKey = props.activeSessionKey ?? storeActiveSessionKey;
  const activeAgentId = props.activeAgentId ?? storeActiveAgentId;
  const sessionMetas = props.sessionMetas ?? storeSessionMetas;
  const sessionPreviewOverlays = props.sessionPreviewOverlays ?? storeSessionPreviewOverlays;
  const isControlled = props.sessionMetas !== undefined;

  useEffect(() => {
    if (isControlled) {
      return undefined;
    }
    const keys = sessionMetas.map((session) => session.key);
    if (keys.length === 0) {
      return undefined;
    }

    let cancelled = false;
    void fetchSessionPreviews(keys)
      .then((overlays) => {
        if (cancelled) {
          return;
        }
        const store = useChatStore.getState();
        for (const key of keys) {
          const overlay = overlays[key];
          if (overlay) {
            store.mergeSessionPreviewOverlay(key, overlay);
            continue;
          }
          if (store.sessionPreviewOverlays[key]?.source === "remote") {
            store.clearSessionPreviewOverlay(key);
          }
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        const store = useChatStore.getState();
        for (const key of keys) {
          if (store.sessionPreviewOverlays[key]?.source === "remote") {
            store.clearSessionPreviewOverlay(key);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isControlled, sessionMetas]);

  const handleNew = () => {
    if (props.onCreateSession) {
      props.onCreateSession();
      return;
    }
    setActiveSession(null);
  };

  const handleSelect = (session: SessionMeta) => {
    if (props.onSelectSession) {
      props.onSelectSession(session);
      return;
    }
    setActiveSession(session.key);
    if (session.agentId) {
      setActiveAgent(session.agentId);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      const result = await deleteChatSession(deleteTarget, activeAgentId);
      if (result.ok === false) {
        return;
      }
      const store = useChatStore.getState();
      store.setSessionMetas(sessionMetas.filter((session) => session.key !== deleteTarget));
      store.removeSession(deleteTarget);
      if (activeSessionKey === deleteTarget) {
        setActiveSession(null);
      }
    } catch {
      // Close the confirmation even when the transport reports a failure.
    } finally {
      setDeleteTarget(null);
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
      useChatStore.setState((state) => {
        const metas = state.sessionMetas.map((entry) =>
          entry.key === session.key ? { ...entry, title: trimmed } : entry,
        );
        return { sessionMetas: metas, sessionMeta: metas };
      });
    }
  };

  const filteredMetas = useMemo(() => {
    if (!searchQuery.trim()) {
      return sessionMetas;
    }
    const query = searchQuery.toLowerCase();
    return sessionMetas.filter((session) => {
      const title = (session.title ?? sessionTitle(session)).toLowerCase();
      const preview = finalSessionPreview(session, sessionPreviewOverlays).toLowerCase();
      return title.includes(query) || preview.includes(query);
    });
  }, [searchQuery, sessionMetas, sessionPreviewOverlays]);

  return (
    <aside className="deck-ui-session-sidebar">
      <AgentTabs />
      <button className="deck-ui-session-new" type="button" onClick={handleNew}>
        <PlusIcon />
        <span>{t("newSession")}</span>
      </button>
      <input
        className="deck-ui-session-search"
        type="text"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("searchSessions")}
      />

      <div className="deck-ui-session-list">
        {filteredMetas.map((session) => {
          const previewText = finalSessionPreview(session, sessionPreviewOverlays);
          return (
            <div
              className={`deck-ui-session-row ${
                activeSessionKey === session.key ? "is-selected" : ""
              }`}
              key={session.key}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(session)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                handleStartRename(session);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelect(session);
                }
              }}
            >
              {editingKey === session.key ? (
                <input
                  className="deck-ui-session-edit"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRenameRef.current = true;
                      setEditingKey(null);
                    }
                  }}
                  onBlur={() => void handleFinishRename(session)}
                  autoFocus
                />
              ) : (
                <span>{sessionTitle(session)}</span>
              )}
              {previewText ? <span>{previewText}</span> : null}
              <span>{formatTime(session.updatedAt)}</span>
              <button
                className="deck-ui-session-delete"
                type="button"
                aria-label={t("deleteConfirmTitle")}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(session.key);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>

      {deleteTarget ? (
        <div className="deck-ui-delete-dialog" role="dialog" aria-label={t("deleteConfirmTitle")}>
          <p>{t("deleteConfirmMessage")}</p>
          <button
            className="deck-ui-delete-cancel"
            type="button"
            onClick={() => setDeleteTarget(null)}
          >
            {t("deleteConfirmCancel")}
          </button>
          <button
            className="deck-ui-delete-confirm"
            type="button"
            onClick={() => void handleDeleteConfirm()}
          >
            {t("deleteConfirmOk")}
          </button>
        </div>
      ) : null}

      <footer className="deck-ui-sidebar-foot">
        {t("defaultAgent")} {activeAgentId ?? "main"}
      </footer>
      {activeSessionKey ? <div data-active-session={activeSessionKey} /> : null}
    </aside>
  );
}

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { HashIcon, PanelCollapseIcon, PanelExpandIcon, PlusIcon, TrashIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { Input } from "@/design-system/atoms/Input";
import { SidebarRow } from "@/design-system/atoms/SidebarRow";
import { useAgentsStore } from "@/stores/agents";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";
import type { SessionMeta } from "@/stores/chat-types";
import { AgentTabs } from "./AgentTabs";
import { deleteChatSession, fetchSessionPreviews, patchSession } from "./chat-api";
import "./session-sidebar.css";

const COLLAPSED_AGENT_LIMIT = 3;
const COLLAPSED_SESSION_LIMIT = 8;

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
  const [collapsed, setCollapsed] = useState(false);
  const cancelRenameRef = useRef(false);
  const storeActiveSessionKey = useActiveSessionKey();
  const storeActiveAgentId = useChatStore((state) => state.activeAgentId);
  const storeSessionMetas = useChatStore((state) => state.sessionMetas);
  const storeSessionPreviewOverlays = useChatStore((state) => state.sessionPreviewOverlays);
  const setActiveSession = useChatStore((state) => state.setActiveSession);
  const setActiveAgent = useChatStore((state) => state.setActiveAgent);
  const agents = useAgentsStore((state) => state.agents);
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
      const label = (session.label ?? "").toLowerCase();
      const preview = finalSessionPreview(session, sessionPreviewOverlays).toLowerCase();
      const key = session.key.toLowerCase();
      return (
        title.includes(query) ||
        label.includes(query) ||
        preview.includes(query) ||
        key.includes(query)
      );
    });
  }, [searchQuery, sessionMetas, sessionPreviewOverlays]);

  if (collapsed) {
    const visibleAgents = agents.slice(0, COLLAPSED_AGENT_LIMIT);
    const overflowAgents = Math.max(agents.length - COLLAPSED_AGENT_LIMIT, 0);
    const collapsedSessions = sessionMetas.slice(0, COLLAPSED_SESSION_LIMIT);
    return (
      <aside className="ds-session-sidebar ds-session-sidebar--collapsed deck-ui-session-sidebar">
        <IconButton
          size="sm"
          aria-label={t("sidebarExpand")}
          title={t("sidebarExpand")}
          className="ds-session-sidebar__toggle"
          onClick={() => setCollapsed(false)}
        >
          <PanelExpandIcon />
        </IconButton>
        <IconButton
          size="sm"
          aria-label={t("newSession")}
          title={t("newSession")}
          className="ds-session-sidebar__new-mini"
          onClick={handleNew}
        >
          <PlusIcon />
        </IconButton>
        {visibleAgents.length > 0 ? (
          <div className="ds-session-sidebar__agent-stack">
            {visibleAgents.map((agent) => {
              const letter = (agent.name || agent.id).slice(0, 1).toLowerCase();
              const active = agent.id === activeAgentId;
              const dotClasses = ["ds-session-sidebar__agent-dot"];
              if (active) {
                dotClasses.push("ds-session-sidebar__agent-dot--active");
              }
              return (
                <button
                  key={agent.id}
                  type="button"
                  className={dotClasses.join(" ")}
                  title={agent.name || agent.id}
                  onClick={() => setActiveAgent(agent.id)}
                >
                  {letter}
                </button>
              );
            })}
            {overflowAgents > 0 ? (
              <span
                className="ds-session-sidebar__agent-dot ds-session-sidebar__agent-dot--overflow"
                aria-label={`+${overflowAgents}`}
              >
                +
              </span>
            ) : null}
          </div>
        ) : null}
        <span className="ds-session-sidebar__rule" aria-hidden="true" />
        {collapsedSessions.map((session) => {
          const sessionRunning = session.status === "running";
          const active = activeSessionKey === session.key;
          const miniClasses = ["ds-session-sidebar__session-mini"];
          if (active) {
            miniClasses.push("ds-session-sidebar__session-mini--active");
          }
          return (
            <button
              key={session.key}
              type="button"
              className={miniClasses.join(" ")}
              title={sessionTitle(session)}
              onClick={() => handleSelect(session)}
            >
              {sessionRunning ? (
                <span className="ds-session-sidebar__streaming-dot" aria-hidden="true" />
              ) : (
                <HashIcon />
              )}
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="ds-session-sidebar deck-ui-session-sidebar">
      <div className="ds-session-sidebar__head">
        <AgentTabs />
        <IconButton
          size="sm"
          aria-label={t("sidebarCollapse")}
          title={t("sidebarCollapse")}
          className="ds-session-sidebar__toggle"
          onClick={() => setCollapsed(true)}
        >
          <PanelCollapseIcon />
        </IconButton>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="ds-session-sidebar__new deck-ui-session-new"
        onClick={handleNew}
      >
        <PlusIcon />
        <span>{t("newSession")}</span>
      </Button>
      <Input
        className="ds-session-sidebar__search deck-ui-session-search"
        inputSize="sm"
        type="text"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("searchSessions")}
      />

      <div className="ds-session-sidebar__list deck-ui-session-list">
        {filteredMetas.map((session) => {
          const previewText = finalSessionPreview(session, sessionPreviewOverlays);
          const titleNode =
            editingKey === session.key ? (
              <input
                className="ds-session-sidebar__edit deck-ui-session-edit"
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
            );

          return (
            <SidebarRow
              key={session.key}
              className="deck-ui-session-row"
              active={activeSessionKey === session.key}
              title={titleNode}
              preview={previewText || undefined}
              meta={formatTime(session.updatedAt)}
              aria-label={[sessionTitle(session), session.label, previewText]
                .filter(Boolean)
                .join(" ")}
              trailing={
                <IconButton
                  size="sm"
                  className="deck-ui-session-delete"
                  aria-label={t("deleteConfirmTitle")}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(session.key);
                  }}
                >
                  <TrashIcon />
                </IconButton>
              }
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
            />
          );
        })}
      </div>

      {deleteTarget ? (
        <div
          className="ds-session-sidebar__delete-dialog deck-ui-delete-dialog"
          role="dialog"
          aria-label={t("deleteConfirmTitle")}
        >
          <p>{t("deleteConfirmMessage")}</p>
          <Button
            variant="secondary"
            size="sm"
            className="deck-ui-delete-cancel"
            onClick={() => setDeleteTarget(null)}
          >
            {t("deleteConfirmCancel")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="deck-ui-delete-confirm"
            onClick={() => void handleDeleteConfirm()}
          >
            {t("deleteConfirmOk")}
          </Button>
        </div>
      ) : null}

      <footer className="ds-session-sidebar__foot deck-ui-sidebar-foot">
        {t("defaultAgent")} {activeAgentId ?? "main"}
      </footer>
      {activeSessionKey ? <div data-active-session={activeSessionKey} /> : null}
    </aside>
  );
}

import { useTranslations } from "next-intl";
import { useState } from "react";
import { RefreshIcon } from "@/deck-ui/icons";
import { Button } from "@/design-system/atoms/Button";
import { IconButton } from "@/design-system/atoms/IconButton";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UIEvents } from "@/stores/chat-hooks";

export function CanvasDebugPanel() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const events = useSessionA2UIEvents();
  const surfaces = useChatStore((state) => {
    const key = state.activeSessionKey;
    return key ? (state.sessions.get(key)?.a2uiState?.surfaces ?? []) : [];
  });
  const treeData = useChatStore((state) => {
    const key = state.activeSessionKey;
    return key ? (state.sessions.get(key)?.a2uiState?.treeData ?? null) : null;
  });
  const [activeTab, setActiveTab] = useState<"messages" | "tree">("messages");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const clearEvents = () => {
    if (activeSessionKey) {
      useChatStore.getState().setA2UIState(activeSessionKey, { eventLog: [] });
    }
  };

  const refreshTree = () => {
    if (activeSessionKey) {
      useChatStore.getState().pushCanvasCommand(activeSessionKey, { action: "request_tree" });
    }
  };

  return (
    <section className="ds-canvas-debug deck-ui-canvas-debug">
      <header className="ds-canvas-debug__tabs deck-ui-canvas-debug-tabs">
        <button
          type="button"
          className={activeTab === "messages" ? "is-active" : ""}
          aria-pressed={activeTab === "messages"}
          onClick={() => setActiveTab("messages")}
        >
          {t("debugMessages")}
        </button>
        <button
          type="button"
          className={activeTab === "tree" ? "is-active" : ""}
          aria-pressed={activeTab === "tree"}
          onClick={() => setActiveTab("tree")}
        >
          {t("debugTree")}
        </button>
        <span>{t("debugEvents", { count: events.length })}</span>
        <Button
          variant="ghost"
          size="sm"
          className="deck-ui-canvas-debug-clear"
          onClick={clearEvents}
        >
          {t("debugClear")}
        </Button>
      </header>

      {activeTab === "messages" ? (
        events.length === 0 ? (
          <p className="ds-canvas-debug__empty deck-ui-canvas-debug-empty">
            {t("debugEvents", { count: 0 })}
          </p>
        ) : (
          <ul className="ds-canvas-debug__events deck-ui-canvas-debug-events">
            {events.map((event, index) => (
              <li key={`${event.timestamp}-${event.action}-${index}`}>
                <button
                  className="ds-canvas-debug__event deck-ui-canvas-debug-event"
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <span className="ds-canvas-debug__time deck-ui-canvas-debug-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{event.action}</span>
                  <span>{event.summary}</span>
                </button>
                {expandedIndex === index ? (
                  <pre className="ds-canvas-debug__raw deck-ui-canvas-debug-raw">
                    {JSON.stringify(event.raw, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="ds-canvas-debug__tree deck-ui-canvas-debug-tree">
          <IconButton
            size="sm"
            title={t("debugRefreshTree")}
            aria-label={t("debugRefreshTree")}
            onClick={refreshTree}
          >
            <RefreshIcon />
          </IconButton>
          {treeData != null ? (
            <pre className="ds-canvas-debug__raw deck-ui-canvas-debug-raw">
              {JSON.stringify(treeData, null, 2)}
            </pre>
          ) : surfaces.length > 0 ? (
            <ul className="ds-canvas-debug__surfaces deck-ui-canvas-debug-surfaces">
              {surfaces.map((surface) => (
                <li key={surface}>{surface}</li>
              ))}
            </ul>
          ) : (
            <p className="ds-canvas-debug__empty deck-ui-canvas-debug-empty">
              {t("debugTreeUnavailable")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

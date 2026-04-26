import { useTranslations } from "next-intl";
import { useState } from "react";
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
    <section className="deck-ui-canvas-debug">
      <header className="deck-ui-canvas-debug-tabs">
        <button
          className={activeTab === "messages" ? "is-active" : ""}
          type="button"
          onClick={() => setActiveTab("messages")}
        >
          {t("debugMessages")}
        </button>
        <button
          className={activeTab === "tree" ? "is-active" : ""}
          type="button"
          onClick={() => setActiveTab("tree")}
        >
          {t("debugTree")}
        </button>
        <span>{t("debugEvents", { count: events.length })}</span>
        <button className="deck-ui-canvas-debug-clear" type="button" onClick={clearEvents}>
          {t("debugClear")}
        </button>
      </header>

      {activeTab === "messages" ? (
        events.length === 0 ? (
          <p className="deck-ui-canvas-debug-empty">{t("debugEvents", { count: 0 })}</p>
        ) : (
          <ul className="deck-ui-canvas-debug-events">
            {events.map((event, index) => (
              <li key={`${event.timestamp}-${event.action}-${index}`}>
                <button
                  className="deck-ui-canvas-debug-event"
                  type="button"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <span className="deck-ui-canvas-debug-time">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{event.action}</span>
                  <span>{event.summary}</span>
                </button>
                {expandedIndex === index ? (
                  <pre className="deck-ui-canvas-debug-raw">
                    {JSON.stringify(event.raw, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="deck-ui-canvas-debug-tree">
          <button
            className="deck-ui-tool-control"
            type="button"
            title={t("debugRefreshTree")}
            aria-label={t("debugRefreshTree")}
            onClick={refreshTree}
          >
            Refresh
          </button>
          {treeData != null ? (
            <pre className="deck-ui-canvas-debug-raw">{JSON.stringify(treeData, null, 2)}</pre>
          ) : surfaces.length > 0 ? (
            <ul className="deck-ui-canvas-debug-surfaces">
              {surfaces.map((surface) => (
                <li key={surface}>{surface}</li>
              ))}
            </ul>
          ) : (
            <p className="deck-ui-canvas-debug-empty">{t("debugTreeUnavailable")}</p>
          )}
        </div>
      )}
    </section>
  );
}

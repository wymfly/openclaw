"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey, useSessionA2UIEvents } from "@/stores/chat-hooks";

export function CanvasDebugPanel() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const events = useSessionA2UIEvents();
  const surfaces = useChatStore((s) => {
    const key = s.activeSessionKey;
    return key ? (s.sessions.get(key)?.a2uiState?.surfaces ?? []) : [];
  });
  const [activeTab, setActiveTab] = useState<"messages" | "tree">("messages");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleClear = () => {
    if (!activeSessionKey) {
      return;
    }
    // Reset event log by setting it to empty
    useChatStore.getState().setA2UIState(activeSessionKey, { eventLog: [] });
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-primary)] max-h-[240px] flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[var(--border-subtle)] shrink-0">
        {(["messages", "tree"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 text-[11px] transition-colors cursor-pointer",
              activeTab === tab
                ? "text-[var(--brand)] border-b-2 border-[var(--brand)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
          >
            {tab === "messages" ? t("debugMessages") : t("debugTree")}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-[9px] text-[var(--text-secondary)] px-2">
          {t("debugEvents", { count: events.length })}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          {t("debugClear")}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto font-mono text-[11px]">
        {activeTab === "messages" ? (
          events.length === 0 ? (
            <div className="p-3 text-center text-[var(--text-secondary)] text-[10px]">
              {t("debugEvents", { count: 0 })}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {events.map((evt, i) => (
                <div key={`${evt.timestamp}-${evt.action}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="w-full flex items-center gap-2 px-3 py-1 hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer text-left"
                  >
                    <span className="text-[var(--text-secondary)] min-w-[50px] text-[10px]">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-[10px]">
                      {evt.direction === "inbound" ? "\u2B07" : "\u2B06"}
                    </span>
                    <span
                      className={cn(
                        "min-w-[90px] font-medium text-[10px]",
                        evt.direction === "inbound"
                          ? "text-[var(--brand)]"
                          : "text-[var(--warning)]",
                      )}
                    >
                      {evt.action}
                    </span>
                    <span className="text-[var(--text-secondary)] text-[10px] truncate">
                      {evt.summary}
                    </span>
                  </button>
                  {expandedIdx === i && (
                    <pre className="px-3 py-2 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-tertiary)] overflow-x-auto max-h-[120px]">
                      {JSON.stringify(evt.raw, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )
        ) : surfaces.length > 0 ? (
          <div className="p-3 space-y-1">
            {surfaces.map((s) => (
              <div key={s} className="flex items-center gap-2 text-[10px]">
                <span className="text-[var(--success)]">{"\u25CF"}</span>
                <span className="text-[var(--text-primary)]">{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 text-center text-[var(--text-secondary)] text-[10px]">
            {t("debugTreeUnavailable")}
          </div>
        )}
      </div>
    </div>
  );
}

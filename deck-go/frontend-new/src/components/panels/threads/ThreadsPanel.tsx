import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoThreadEntry } from "../../../api";
import { fetchThreads } from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import { ShellStat } from "../../shared/ShellComponents";
import {
  areThreadFiltersEqual,
  DEFAULT_THREAD_FILTERS,
  normalizeThreadFilters,
  sortThreadsByActivity,
  THREAD_FILTER_DEBOUNCE_MS,
} from "./thread-utils";
import { ThreadDetail } from "./ThreadDetail";
import { ThreadList } from "./ThreadList";

type PanelState = "idle" | "loading" | "ready";

export function ThreadsPanel() {
  const t = useTranslations("threads");
  const ui = useDeckUI();
  const [threads, setThreads] = useState<DeckGoThreadEntry[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [draftFilters, setDraftFilters] = useState(DEFAULT_THREAD_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_THREAD_FILTERS);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [error, setError] = useState("");
  const [handoffMessage, setHandoffMessage] = useState("");
  const loadSequenceRef = useRef(0);

  const refresh = useCallback(
    async (preferredThreadId?: string, filters = appliedFilters) => {
      const sequence = loadSequenceRef.current + 1;
      loadSequenceRef.current = sequence;
      setLoadState("loading");
      try {
        const next = await fetchThreads(normalizeThreadFilters(filters));
        if (sequence !== loadSequenceRef.current) {
          return;
        }
        const nextThreads = sortThreadsByActivity(next.threads ?? []);
        setThreads(nextThreads);
        setLoadState("ready");
        setError("");
        const fallbackId = preferredThreadId?.trim() || nextThreads[0]?.threadId || "";
        setSelectedThreadId((current) =>
          nextThreads.some((thread) => thread.threadId === current)
            ? current
            : nextThreads.some((thread) => thread.threadId === fallbackId)
              ? fallbackId
              : nextThreads[0]?.threadId || "",
        );
      } catch (loadError) {
        if (sequence !== loadSequenceRef.current) {
          return;
        }
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("failedLoadThreads"));
      }
    },
    [appliedFilters, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextFilters = normalizeThreadFilters(draftFilters);
      setAppliedFilters((current) =>
        areThreadFiltersEqual(current, nextFilters) ? current : nextFilters,
      );
    }, THREAD_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftFilters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedThreads = useMemo(() => sortThreadsByActivity(threads), [threads]);
  const selectedThread =
    sortedThreads.find((thread) => thread.threadId === selectedThreadId) ??
    sortedThreads[0] ??
    null;

  const refreshFromDraftFilters = () => {
    const nextFilters = normalizeThreadFilters(draftFilters);
    setAppliedFilters((current) =>
      areThreadFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
    void refresh(selectedThreadId, nextFilters);
  };

  const updateStatusFilter = (status: "active" | "all") => {
    const nextDraft = { ...draftFilters, status };
    const nextFilters = normalizeThreadFilters(nextDraft);
    setDraftFilters(nextDraft);
    setAppliedFilters((current) =>
      areThreadFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
  };

  const copySessionKey = async () => {
    if (!selectedThread) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setHandoffMessage(t("sessionKeyReady", { sessionKey: selectedThread.targetSessionKey }));
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedThread.targetSessionKey);
      setHandoffMessage(t("copiedSessionKey", { sessionKey: selectedThread.targetSessionKey }));
    } catch {
      setHandoffMessage(t("clipboardUnavailable", { sessionKey: selectedThread.targetSessionKey }));
    }
  };

  const openSessionPanel = () => {
    if (!selectedThread) {
      return;
    }
    navigateToSession(ui, { sessionKey: selectedThread.targetSessionKey });
    setHandoffMessage(t("openedSessionPanel", { sessionKey: selectedThread.targetSessionKey }));
  };

  const openAgentPanel = () => {
    if (!selectedThread) {
      return;
    }
    navigateToAgent(ui, { agentId: selectedThread.agentId });
    setHandoffMessage(t("openedAgentPanel", { agentId: selectedThread.agentId }));
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-threads">
      <div className="deckgo-column deck-ui-threads-column">
        <article className="deckgo-card is-float deck-ui-threads-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("panelTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-threads-body">
            <div className="deckgo-pill-row deck-ui-threads-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {t("threadsStatus", { state: t(loadState) })}
              </span>
              <span className="deckgo-pill">
                {t("resultsCount", { count: sortedThreads.length })}
              </span>
            </div>
            <div className="deckgo-actions deck-ui-threads-controls">
              <input
                className="deckgo-input deck-ui-threads-input"
                value={draftFilters.agentId}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, agentId: event.target.value }))
                }
                placeholder={t("agentIdPlaceholder")}
              />
              <input
                className="deckgo-input deck-ui-threads-input"
                value={draftFilters.channel}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, channel: event.target.value }))
                }
                placeholder={t("channelIdPlaceholder")}
              />
              <select
                className="deckgo-input deck-ui-threads-input"
                value={draftFilters.status}
                onChange={(event) => updateStatusFilter(event.target.value as "active" | "all")}
              >
                <option value="active">{t("active")}</option>
                <option value="all">{t("all")}</option>
              </select>
              <button
                className="deckgo-button deck-ui-threads-button"
                type="button"
                onClick={refreshFromDraftFilters}
              >
                {t("refreshThreads")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-threads-error">{error}</p> : null}
            <div className="deckgo-grid deckgo-grid-2 deck-ui-threads-stats">
              <ShellStat label={t("threadsLower")} value={sortedThreads.length} />
              <ShellStat label={t("selectedLower")} value={selectedThread?.threadId || t("na")} />
            </div>
            <ThreadList
              threads={sortedThreads}
              selectedThreadId={selectedThread?.threadId ?? ""}
              onSelectThread={setSelectedThreadId}
            />
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-threads-column deck-ui-threads-detail-column">
        <article className="deckgo-card is-float deck-ui-threads-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("selectedThread")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedThreadDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-threads-body">
            <ThreadDetail
              thread={selectedThread}
              handoffMessage={handoffMessage}
              onCopySessionKey={() => void copySessionKey()}
              onOpenSession={openSessionPanel}
              onOpenAgent={openAgentPanel}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

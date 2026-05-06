import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoThreadEntry } from "../../../api";
import { fetchThreads } from "../../../api";
import { navigateToAgent, navigateToSession } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import { useTranslations } from "../../../i18n/provider";
import {
  areThreadFiltersEqual,
  ALL_THREADS_FILTER,
  calculateThreadMetrics,
  DEFAULT_THREAD_FILTERS,
  DEFAULT_THREAD_LOCAL_FILTERS,
  filterThreadsByLocalState,
  listThreadChannelKinds,
  listThreadTargetKinds,
  normalizeThreadFilters,
  sortThreadsByActivity,
  THREAD_FILTER_DEBOUNCE_MS,
} from "./thread-utils";
import { ThreadDetail, type ThreadDetailTab } from "./ThreadDetail";
import { ThreadList } from "./ThreadList";
import "./threads-panel.css";

type PanelState = "idle" | "loading" | "ready";

function ThreadMetric(props: { label: string; value: string | number; tone?: "good" | "warn" }) {
  return (
    <article className={`threads-panel__metric ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

export function ThreadsPanel() {
  const t = useTranslations("threads");
  const ui = useDeckUI();
  const [threads, setThreads] = useState<DeckGoThreadEntry[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [draftFilters, setDraftFilters] = useState(DEFAULT_THREAD_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_THREAD_FILTERS);
  const [localFilters, setLocalFilters] = useState(DEFAULT_THREAD_LOCAL_FILTERS);
  const [activeTab, setActiveTab] = useState<ThreadDetailTab>("overview");
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
  const visibleThreads = useMemo(
    () => filterThreadsByLocalState(sortedThreads, localFilters),
    [localFilters, sortedThreads],
  );
  const channelKinds = useMemo(() => listThreadChannelKinds(sortedThreads), [sortedThreads]);
  const targetKinds = useMemo(() => listThreadTargetKinds(sortedThreads), [sortedThreads]);
  const metrics = useMemo(
    () => calculateThreadMetrics(sortedThreads, visibleThreads.length),
    [sortedThreads, visibleThreads.length],
  );
  const selectedThread =
    visibleThreads.find((thread) => thread.threadId === selectedThreadId) ??
    visibleThreads[0] ??
    null;

  useEffect(() => {
    setSelectedThreadId((current) =>
      visibleThreads.some((thread) => thread.threadId === current)
        ? current
        : visibleThreads[0]?.threadId || "",
    );
  }, [visibleThreads]);

  const refreshFromDraftFilters = () => {
    const nextFilters = normalizeThreadFilters(draftFilters);
    setAppliedFilters((current) =>
      areThreadFiltersEqual(current, nextFilters) ? current : nextFilters,
    );
    void refresh(selectedThreadId, nextFilters);
  };

  const updateLocalFilter = <Key extends keyof typeof localFilters>(
    key: Key,
    value: (typeof localFilters)[Key],
  ) => {
    setLocalFilters((current) => ({ ...current, [key]: value }));
    setActiveTab("overview");
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
    <section className="threads-panel" data-testid="threads-panel">
      <header className="threads-panel__header">
        <div className="threads-panel__title-stack">
          <p className="threads-panel__eyebrow">{t("workspaceEyebrow")}</p>
          <h2 className="threads-panel__title">{t("panelTitle")}</h2>
          <p className="threads-panel__description">{t("panelDescription")}</p>
        </div>
        <div className="threads-panel__header-actions">
          <span className={`threads-panel__pill ${loadState === "ready" ? "is-good" : ""}`}>
            {t("threadsStatus", { state: t(loadState) })}
          </span>
          <span className="threads-panel__pill">{t("contractSource")}</span>
        </div>
      </header>

      <div className="threads-panel__workspace">
        <article className="threads-panel__card threads-panel__inventory-card">
          <div className="threads-panel__card-head">
            <div>
              <p className="threads-panel__eyebrow">{t("filtersTitle")}</p>
              <h3 className="threads-panel__card-title">{t("inventoryTitle")}</h3>
            </div>
            <span className="threads-panel__pill">
              {t("resultsCount", { count: visibleThreads.length })}
            </span>
          </div>
          <div className="threads-panel__body">
            <div className="threads-panel__filters" aria-label={t("filtersTitle")}>
              <input
                className="threads-panel__input"
                value={draftFilters.agentId}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, agentId: event.target.value }))
                }
                placeholder={t("agentIdPlaceholder")}
              />
              <input
                className="threads-panel__input"
                value={draftFilters.channel}
                onChange={(event) =>
                  setDraftFilters((current) => ({ ...current, channel: event.target.value }))
                }
                placeholder={t("channelIdPlaceholder")}
              />
              <select
                className="threads-panel__input"
                value={draftFilters.status}
                onChange={(event) => updateStatusFilter(event.target.value as "active" | "all")}
              >
                <option value="active">{t("active")}</option>
                <option value="all">{t("all")}</option>
              </select>
              <button
                className="threads-panel__button is-primary"
                type="button"
                onClick={refreshFromDraftFilters}
              >
                {t("refreshThreads")}
              </button>
            </div>

            <div className="threads-panel__local-filters" aria-label={t("prototypeFilters")}>
              <label className="threads-panel__search">
                <span>{t("searchThreads")}</span>
                <input
                  className="threads-panel__input"
                  type="search"
                  value={localFilters.query}
                  onChange={(event) => updateLocalFilter("query", event.target.value)}
                  placeholder={t("searchPlaceholder")}
                />
              </label>
              <select
                className="threads-panel__input"
                value={localFilters.channelKind}
                aria-label={t("channelKind")}
                onChange={(event) => updateLocalFilter("channelKind", event.target.value)}
              >
                <option value={ALL_THREADS_FILTER}>{t("allChannels")}</option>
                {channelKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <select
                className="threads-panel__input"
                value={localFilters.targetKind}
                aria-label={t("targetKind")}
                onChange={(event) => updateLocalFilter("targetKind", event.target.value)}
              >
                <option value={ALL_THREADS_FILTER}>{t("allTargets")}</option>
                {targetKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <select
                className="threads-panel__input"
                value={localFilters.recency}
                aria-label={t("activityRecency")}
                onChange={(event) =>
                  updateLocalFilter("recency", event.target.value as "all" | "active" | "stale")
                }
              >
                <option value="all">{t("allRecency")}</option>
                <option value="active">{t("active24h")}</option>
                <option value="stale">{t("stale")}</option>
              </select>
            </div>

            <div className="threads-panel__metrics">
              <ThreadMetric
                label={t("bindings")}
                tone={loadState === "ready" ? "good" : undefined}
                value={metrics.total}
              />
              <ThreadMetric label={t("active24h")} value={metrics.active24h} />
              <ThreadMetric label={t("channelsLower")} value={metrics.channelKinds} />
              <ThreadMetric label={t("agentsLower")} value={metrics.distinctAgents} />
              <ThreadMetric label={t("autoBound")} value={metrics.autoBound} />
              <ThreadMetric label={t("visibleLower")} value={metrics.visible} />
            </div>

            {error ? <p className="threads-panel__error">{error}</p> : null}

            <ThreadList
              threads={visibleThreads}
              selectedThreadId={selectedThread?.threadId ?? ""}
              onSelectThread={setSelectedThreadId}
            />
          </div>
        </article>

        <article className="threads-panel__card threads-panel__detail-card">
          <div className="threads-panel__card-head">
            <div>
              <p className="threads-panel__eyebrow">{t("relationshipTitle")}</p>
              <h3 className="threads-panel__card-title">{t("selectedThread")}</h3>
            </div>
            {selectedThread ? (
              <div className="threads-panel__pill-row">
                <span className="threads-panel__pill">{selectedThread.channelId}</span>
                <span className="threads-panel__pill">{selectedThread.agentId}</span>
              </div>
            ) : null}
          </div>
          <div className="threads-panel__body">
            <ThreadDetail
              thread={selectedThread}
              activeTab={activeTab}
              handoffMessage={handoffMessage}
              onCopySessionKey={() => void copySessionKey()}
              onOpenSession={openSessionPanel}
              onOpenAgent={openAgentPanel}
              onTabChange={setActiveTab}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

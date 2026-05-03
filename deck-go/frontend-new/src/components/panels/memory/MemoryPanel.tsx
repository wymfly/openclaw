import { useEffect, useMemo, useState } from "react";
import type {
  DeckGoAgentSummary,
  DeckGoMemoryDreamAction,
  DeckGoMemoryDreamDiaryResult,
  DeckGoMemoryDreamsResult,
  DeckGoMemoryFileNode,
  DeckGoMemoryHealthEntry,
  DeckGoMemoryHealthResponse,
  DeckGoMemorySearchResult,
  DeckGoMemorySearchScope,
} from "../../../api";
import {
  browseMemory,
  fetchAgentsList,
  fetchMemoryHealth,
  readMemoryFile,
  runMemoryDreams,
  searchMemory,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import "./memory-panel.css";

type PanelState = "idle" | "loading" | "ready";
type MemoryTab = "files" | "search" | "graph" | "health" | "dreams";
type MetricTone = "neutral" | "positive" | "warning" | "danger";

const DREAM_ACTIONS_REQUIRING_CONFIRMATION = new Set<DeckGoMemoryDreamAction>([
  "repair",
  "reset",
  "resetShortTerm",
]);

function isDreamDiaryResult(
  result: DeckGoMemoryDreamsResult,
): result is DeckGoMemoryDreamDiaryResult {
  return !("action" in result);
}

function normalizeHealthEntries(
  response: DeckGoMemoryHealthResponse | null,
): DeckGoMemoryHealthEntry[] {
  if (!response) {
    return [];
  }
  if (Array.isArray(response.entries)) {
    return response.entries;
  }
  if (response.agentId || response.provider) {
    return [
      {
        agentId: response.agentId || "",
        provider: response.provider || "",
        embeddingStatus: response.embedding?.ok ? "ok" : response.error ? "error" : "unknown",
        error: response.embedding?.error || response.error,
      },
    ];
  }
  return [];
}

function memoryParentPath(path: string) {
  const normalized = path.replace(/\/+$/u, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "";
}

function countRelatedMemoryNodes(file: DeckGoMemoryFileNode, files: DeckGoMemoryFileNode[]) {
  const parent = memoryParentPath(file.path);
  return files.filter(
    (candidate) => candidate.path !== file.path && memoryParentPath(candidate.path) === parent,
  ).length;
}

function formatMemoryTimestamp(value?: number) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toLocaleString();
}

function formatMemorySize(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  return `${(value / 1024).toFixed(1)} KB`;
}

function metricClass(tone: MetricTone = "neutral") {
  return `memory-panel__metric ${tone === "neutral" ? "" : `is-${tone}`}`;
}

function MemoryMetric(props: { label: string; value: string | number; tone?: MetricTone }) {
  return (
    <div className={metricClass(props.tone)}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

export function MemoryPanel() {
  const t = useTranslations("memory");
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [agentId, setAgentId] = useState("main");
  const [tab, setTab] = useState<MemoryTab>("files");
  const [files, setFiles] = useState<DeckGoMemoryFileNode[]>([]);
  const [currentBrowsePath, setCurrentBrowsePath] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<DeckGoMemorySearchScope>("all");
  const [searchResults, setSearchResults] = useState<DeckGoMemorySearchResult[]>([]);
  const [searchUnavailableReason, setSearchUnavailableReason] = useState("");
  const [healthResponse, setHealthResponse] = useState<DeckGoMemoryHealthResponse | null>(null);
  const [dreamDiary, setDreamDiary] = useState<DeckGoMemoryDreamDiaryResult | null>(null);
  const [dreamsResult, setDreamsResult] = useState<DeckGoMemoryDreamsResult | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "reading" | "searching" | "dreams">(
    "idle",
  );
  const [error, setError] = useState("");

  const refreshAgents = async () => {
    try {
      const result = await fetchAgentsList();
      const nextAgents = result.agents ?? [];
      setAgents(nextAgents);
      setAgentId((current) => {
        if (current.trim() && nextAgents.some((agent) => agent.id === current.trim())) {
          return current.trim();
        }
        return result.defaultId || nextAgents[0]?.id || current.trim() || "main";
      });
    } catch {
      setAgents([]);
    }
  };

  const refreshFiles = async (nextPath?: string) => {
    setLoadState("loading");
    try {
      const result = await browseMemory(agentId, nextPath);
      setFiles(result.files ?? []);
      setCurrentBrowsePath(nextPath ?? "");
      setLoadState("ready");
      setError("");
      setSelectedPath("");
      setSelectedContent("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("failedBrowse"));
    }
  };

  const readFileAction = async (path: string) => {
    setActionState("reading");
    try {
      const fileResult = await readMemoryFile(agentId, path);
      setSelectedPath(path);
      setSelectedContent(fileResult.content ?? "");
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("failedRead"));
    } finally {
      setActionState("idle");
    }
  };

  const refreshHealth = async () => {
    setLoadState("loading");
    try {
      const result = await fetchMemoryHealth();
      setHealthResponse(result);
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("failedHealth"));
    }
  };

  const refreshDreamDiary = async () => {
    setActionState("dreams");
    try {
      const result = await runMemoryDreams("read");
      if (isDreamDiaryResult(result)) {
        setDreamDiary(result);
      } else {
        setDreamsResult(result);
      }
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("failedDreamRead"));
    } finally {
      setActionState("idle");
    }
  };

  useEffect(() => {
    void refreshAgents();
  }, []);

  useEffect(() => {
    const trimmedAgentId = agentId.trim();
    if (trimmedAgentId && trimmedAgentId !== agentId) {
      setAgentId(trimmedAgentId);
    }
  }, [agentId]);

  useEffect(() => {
    if (tab === "files" || tab === "graph") {
      void refreshFiles();
      return;
    }
    if (tab === "health") {
      void refreshHealth();
    }
  }, [agentId, tab]);

  useEffect(() => {
    if (tab === "dreams") {
      void refreshDreamDiary();
    }
  }, [tab]);

  const healthEntries = useMemo(() => normalizeHealthEntries(healthResponse), [healthResponse]);
  const activeAgent = agents.find((agent) => agent.id === agentId);
  const directoryCount = files.filter((file) => file.type === "directory").length;
  const fileCount = files.filter((file) => file.type === "file").length;
  const currentPathLabel = currentBrowsePath || t("memoryRoot");
  const hasHealthError = healthEntries.some((entry) => entry.embeddingStatus === "error");
  const healthLabel =
    healthEntries.length === 0 ? t("unknown") : hasHealthError ? t("attention") : t("healthy");
  const searchStateLabel = searchUnavailableReason
    ? t("searchUnavailable")
    : searchResults.length > 0
      ? t("searchAvailable")
      : t("noResults");
  const detailFocus =
    tab === "files"
      ? selectedPath || t("noSelection")
      : tab === "search"
        ? searchResults[0]?.path || t("noSelection")
        : tab === "dreams"
          ? dreamDiary?.path || t("noSelection")
          : tab === "health"
            ? healthLabel
            : `${files.length} ${t("nodes")}`;

  const tabItems: Array<{ id: MemoryTab; label: string; description: string }> = [
    { id: "files", label: t("files"), description: t("filesLaneDescription") },
    { id: "search", label: t("searchTab"), description: t("searchLaneDescription") },
    { id: "graph", label: t("graphTab"), description: t("graphLaneDescription") },
    { id: "health", label: t("health"), description: t("healthLaneDescription") },
    { id: "dreams", label: t("dreams.tab"), description: t("dreamsLaneDescription") },
  ];
  const activeTab = tabItems.find((item) => item.id === tab) ?? tabItems[0];

  const searchAction = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setError(t("searchRequired"));
      return;
    }
    setActionState("searching");
    try {
      const result = await searchMemory({ query, agentId, scope: searchScope });
      setSearchResults(result.results ?? []);
      setSearchUnavailableReason(result.unavailableReason ?? "");
      setError("");
    } catch (actionError) {
      setSearchResults([]);
      setSearchUnavailableReason("");
      setError(actionError instanceof Error ? actionError.message : t("failedSearch"));
    } finally {
      setActionState("idle");
    }
  };

  const dreamsAction = async (action: DeckGoMemoryDreamAction) => {
    if (action === "read") {
      await refreshDreamDiary();
      return;
    }
    if (
      DREAM_ACTIONS_REQUIRING_CONFIRMATION.has(action) &&
      !window.confirm(t("confirmDreamAction", { action }))
    ) {
      return;
    }
    setActionState("dreams");
    try {
      const result = await runMemoryDreams(action);
      setDreamsResult(result);
      const diaryResult = await runMemoryDreams("read");
      if (isDreamDiaryResult(diaryResult)) {
        setDreamDiary(diaryResult);
      }
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("failedDreamAction"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="memory-panel deck-ui-memory" data-testid="memory-panel">
      <header className="memory-panel__header">
        <div className="memory-panel__title-stack">
          <p className="memory-panel__eyebrow">{t("workbenchEyebrow")}</p>
          <h2 className="memory-panel__title">{t("workbenchTitle")}</h2>
          <p className="memory-panel__description">{t("workbenchDescription")}</p>
        </div>
        <div className="memory-panel__header-actions">
          <span className={`memory-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
            {t("memoryStatus", { state: t(loadState) })}
          </span>
          <span className="memory-panel__pill">{t("agentValue", { agentId })}</span>
          <span className="memory-panel__pill">{t("contractLane")}</span>
        </div>
      </header>

      <div className="memory-panel__metrics" aria-label={t("summaryLabel")}>
        <MemoryMetric label={t("activeLane")} value={activeTab.label} tone="positive" />
        <MemoryMetric label={t("visibleEntries")} value={files.length} />
        <MemoryMetric label={t("activePath")} value={currentPathLabel} />
        <MemoryMetric
          label={t("searchState")}
          value={searchStateLabel}
          tone={searchUnavailableReason ? "warning" : "neutral"}
        />
        <MemoryMetric label={t("detailFocus")} value={detailFocus} />
      </div>

      <div className="memory-panel__workbench">
        <article className="memory-panel__card deck-ui-memory-card">
          <div className="memory-panel__card-head">
            <div>
              <p className="memory-panel__label">{t("controlsEyebrow")}</p>
              <h3 className="memory-panel__card-title">{t("controlsTitle")}</h3>
              <p className="memory-panel__note">{t("controlsDescription")}</p>
            </div>
            <span className="memory-panel__pill">{t("browsing", { path: currentPathLabel })}</span>
          </div>

          <div className="memory-panel__controls">
            <label className="memory-panel__field">
              <span>{t("agent")}</span>
              <input
                className="memory-panel__input deck-ui-memory-input"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                placeholder={t("agentIdPlaceholder")}
              />
            </label>
            {agents.length > 0 ? (
              <label className="memory-panel__field">
                <span>{t("agentSelector")}</span>
                <select
                  aria-label={t("agentSelector")}
                  className="memory-panel__input deck-ui-memory-input"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="memory-panel__tabs" role="group" aria-label={t("lanesLabel")}>
            {tabItems.map((item) => (
              <button
                key={item.id}
                className={`memory-panel__tab deck-ui-memory-tab ${tab === item.id ? "is-active" : ""}`}
                type="button"
                aria-pressed={tab === item.id}
                title={item.description}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? <p className="memory-panel__error deck-ui-memory-error">{error}</p> : null}

          <div className="memory-panel__lane">
            <div className="memory-panel__lane-head">
              <div>
                <p className="memory-panel__label">{t("activeLane")}</p>
                <h3 className="memory-panel__section-title">{activeTab.label}</h3>
                <p className="memory-panel__note">{activeTab.description}</p>
              </div>
              <span className="memory-panel__pill">{activeAgent?.name || agentId}</span>
            </div>

            {tab === "files" ? (
              <>
                <div className="memory-panel__submetrics">
                  <MemoryMetric label={t("entries")} value={files.length} />
                  <MemoryMetric label={t("directories")} value={directoryCount} />
                  <MemoryMetric label={t("selectedPath")} value={selectedPath || t("na")} />
                </div>
                <div className="memory-panel__actions">
                  <span className="memory-panel__pill">
                    {t("browsing", { path: currentPathLabel })}
                  </span>
                  {currentBrowsePath ? (
                    <button
                      className="memory-panel__button"
                      type="button"
                      onClick={() =>
                        void refreshFiles(memoryParentPath(currentBrowsePath) || undefined)
                      }
                    >
                      {t("backToParent")}
                    </button>
                  ) : null}
                </div>
                <ul className="memory-panel__list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="memory-panel__empty deck-ui-memory-empty">
                      {t("noMemoryFilesLoaded")}
                    </p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <button
                          type="button"
                          className={`memory-panel__row deck-ui-memory-row ${selectedPath === file.path ? "is-selected" : ""}`}
                          onClick={() => {
                            if (file.type === "file") {
                              void readFileAction(file.path);
                            } else {
                              void refreshFiles(file.path);
                            }
                          }}
                        >
                          <span className={`memory-panel__row-type is-${file.type}`}>
                            {file.type === "directory" ? t("directory") : t("file")}
                          </span>
                          <span className="memory-panel__row-main">
                            <strong>{file.name}</strong>
                            <span className="memory-panel__meta deck-ui-memory-meta">
                              {t("fileMeta", {
                                path: file.path,
                                size: formatMemorySize(file.size),
                                type: file.type,
                              })}
                            </span>
                          </span>
                          <span className="memory-panel__row-count">
                            {t("connections", {
                              count: countRelatedMemoryNodes(file, files),
                            })}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}

            {tab === "search" ? (
              <>
                <div className="memory-panel__controls is-search">
                  <input
                    className="memory-panel__input deck-ui-memory-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("searchMemoryPlaceholder")}
                  />
                  <select
                    className="memory-panel__input deck-ui-memory-input"
                    value={searchScope}
                    onChange={(event) =>
                      setSearchScope(event.target.value as DeckGoMemorySearchScope)
                    }
                  >
                    <option value="all">{t("scopeAll")}</option>
                    <option value="global">{t("scopeGlobalValue")}</option>
                    <option value="agent">{t("scopeAgentValue")}</option>
                  </select>
                  <button
                    className="memory-panel__button is-primary"
                    type="button"
                    onClick={() => void searchAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "searching" ? t("searching") : t("searchMemory")}
                  </button>
                </div>
                {searchUnavailableReason ? (
                  <p className="memory-panel__warning deck-ui-memory-error">
                    {searchUnavailableReason}
                  </p>
                ) : null}
                <div className="memory-panel__submetrics">
                  <MemoryMetric label={t("results")} value={searchResults.length} />
                  <MemoryMetric label={t("scope")} value={searchScope} />
                </div>
                <ul className="memory-panel__list deck-ui-memory-list">
                  {searchResults.length === 0 ? (
                    <p className="memory-panel__empty deck-ui-memory-empty">
                      {t("noSearchResultsLoaded")}
                    </p>
                  ) : (
                    searchResults.map((result, index) => (
                      <li key={`${result.path}-${index}`}>
                        <div className="memory-panel__row deck-ui-memory-row">
                          <span className="memory-panel__row-type is-search">{t("recall")}</span>
                          <span className="memory-panel__row-main">
                            <strong>{result.path}</strong>
                            <span className="memory-panel__meta deck-ui-memory-meta">
                              {t("searchResultMeta", {
                                relevance: result.relevance,
                                scope: result.scope || t("na"),
                                tier: result.tier || t("na"),
                              })}
                            </span>
                            <span className="memory-panel__meta deck-ui-memory-meta">
                              {result.content}
                            </span>
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}

            {tab === "graph" ? (
              <>
                <div className="memory-panel__submetrics">
                  <MemoryMetric label={t("nodes")} value={files.length} />
                  <MemoryMetric label={t("files")} value={fileCount} />
                  <MemoryMetric label={t("directories")} value={directoryCount} />
                </div>
                <div className="memory-panel__surface deck-ui-memory-surface">
                  <p className="memory-panel__label">{t("graph")}</p>
                  <p className="memory-panel__note">{t("graphDescription")}</p>
                </div>
                <ul className="memory-panel__list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="memory-panel__empty deck-ui-memory-empty">{t("noGraphNodes")}</p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <div className="memory-panel__row deck-ui-memory-row">
                          <span className={`memory-panel__row-type is-${file.type}`}>
                            {file.type === "directory" ? t("directory") : t("file")}
                          </span>
                          <span className="memory-panel__row-main">
                            <strong>{file.name}</strong>
                            <span className="memory-panel__meta deck-ui-memory-meta">
                              {t("graphNodeMeta", {
                                connections: countRelatedMemoryNodes(file, files),
                                path: file.path,
                                type: file.type,
                              })}
                            </span>
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}

            {tab === "health" ? (
              <>
                <div className="memory-panel__submetrics">
                  <MemoryMetric label={t("entries")} value={healthEntries.length} />
                  <MemoryMetric
                    label={t("lanceDb")}
                    value={healthResponse?.lanceDbEnabled ? t("enabled") : t("off")}
                    tone={healthResponse?.lanceDbEnabled ? "positive" : "warning"}
                  />
                  <MemoryMetric
                    label={t("status")}
                    value={healthLabel}
                    tone={hasHealthError ? "danger" : "positive"}
                  />
                </div>
                <ul className="memory-panel__list deck-ui-memory-list">
                  {healthEntries.length === 0 ? (
                    <p className="memory-panel__empty deck-ui-memory-empty">
                      {t("noHealthEntries")}
                    </p>
                  ) : (
                    healthEntries.map((entry, index) => (
                      <li key={`${entry.agentId}-${entry.provider}-${index}`}>
                        <div className="memory-panel__row deck-ui-memory-row">
                          <span
                            className={`memory-panel__row-type is-${entry.embeddingStatus === "error" ? "danger" : "health"}`}
                          >
                            {entry.embeddingStatus}
                          </span>
                          <span className="memory-panel__row-main">
                            <strong>{entry.agentId || t("na")}</strong>
                            <span className="memory-panel__meta deck-ui-memory-meta">
                              {t("healthMeta", {
                                error: entry.error || t("na"),
                                provider: entry.provider || t("na"),
                                status: entry.embeddingStatus,
                              })}
                            </span>
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}

            {tab === "dreams" ? (
              <>
                <div className="memory-panel__actions is-dreams">
                  <button
                    className="memory-panel__button"
                    type="button"
                    onClick={() => void dreamsAction("read")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamRead")}
                  </button>
                  <button
                    className="memory-panel__button"
                    type="button"
                    onClick={() => void dreamsAction("backfill")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamBackfill")}
                  </button>
                  <button
                    className="memory-panel__button"
                    type="button"
                    onClick={() => void dreamsAction("dedupe")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamDedupe")}
                  </button>
                  <button
                    className="memory-panel__button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("repair")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamRepair")}
                  </button>
                  <button
                    className="memory-panel__button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("resetShortTerm")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamResetShortTerm")}
                  </button>
                  <button
                    className="memory-panel__button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("reset")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamReset")}
                  </button>
                </div>
                <div className="memory-panel__surface deck-ui-memory-surface deck-ui-memory-diary">
                  <div className="memory-panel__lane-head">
                    <div>
                      <p className="memory-panel__label">{t("dreams.title")}</p>
                      <h3 className="memory-panel__section-title">
                        {dreamDiary?.path || t("dreamDiaryUnread")}
                      </h3>
                    </div>
                    {dreamDiary ? (
                      <span className="memory-panel__pill is-positive">
                        {dreamDiary.found ? t("found") : t("notFound")}
                      </span>
                    ) : null}
                  </div>
                  {dreamDiary ? (
                    <>
                      <div className="memory-panel__submetrics">
                        <MemoryMetric label={t("agent")} value={dreamDiary.agentId} />
                        <MemoryMetric
                          label={t("updated")}
                          value={formatMemoryTimestamp(dreamDiary.updatedAtMs)}
                        />
                      </div>
                      {dreamDiary.content ? (
                        <p className="memory-panel__note">
                          {dreamDiary.content.replace(/\s+/g, " ").trim().slice(0, 180)}
                        </p>
                      ) : (
                        <p className="memory-panel__empty">{t("noDreamDiaryContent")}</p>
                      )}
                    </>
                  ) : (
                    <p className="memory-panel__empty">{t("dreamDiaryUnread")}</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </article>

        <aside className="memory-panel__card memory-panel__detail deck-ui-memory-card">
          <div className="memory-panel__card-head">
            <div>
              <p className="memory-panel__label">{t("detailEyebrow")}</p>
              <h3 className="memory-panel__card-title">{t("detailTitle")}</h3>
              <p className="memory-panel__note">{t("detailDescription")}</p>
            </div>
            <span className="memory-panel__pill">{activeTab.label}</span>
          </div>
          <div className="memory-panel__detail-body">
            {tab === "files" ? (
              selectedPath ? (
                <div className="memory-panel__surface deck-ui-memory-surface">
                  <p className="memory-panel__label">{selectedPath}</p>
                  <pre className="memory-panel__code deck-ui-memory-code deck-ui-memory-code-wrap">
                    {selectedContent}
                  </pre>
                </div>
              ) : (
                <p className="memory-panel__empty deck-ui-memory-empty">{t("selectFileToRead")}</p>
              )
            ) : null}
            {tab === "search" ? (
              searchResults.length > 0 ? (
                <JsonDetails title={t("searchResultsTitle")} payload={searchResults} />
              ) : (
                <p className="memory-panel__empty deck-ui-memory-empty">
                  {t("runSearchToInspect")}
                </p>
              )
            ) : null}
            {tab === "graph" ? (
              files.length > 0 ? (
                <JsonDetails title={t("graphNodesTitle")} payload={files} />
              ) : (
                <p className="memory-panel__empty deck-ui-memory-empty">{t("loadFilesForGraph")}</p>
              )
            ) : null}
            {tab === "health" ? (
              <JsonDetails title={t("rawHealthResponse")} payload={healthResponse} />
            ) : null}
            {tab === "dreams" ? (
              <>
                {dreamDiary ? (
                  <div className="memory-panel__surface deck-ui-memory-surface">
                    <p className="memory-panel__label">{dreamDiary.path}</p>
                    <pre className="memory-panel__code deck-ui-memory-code deck-ui-memory-code-wrap">
                      {dreamDiary.content || t("noDreamDiaryContent")}
                    </pre>
                  </div>
                ) : (
                  <p className="memory-panel__empty deck-ui-memory-empty">
                    {t("readDreamDiaryToInspect")}
                  </p>
                )}
                {dreamsResult ? (
                  <JsonDetails title={t("dreamActionResult")} payload={dreamsResult} />
                ) : null}
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

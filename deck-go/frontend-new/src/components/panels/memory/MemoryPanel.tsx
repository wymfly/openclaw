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
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type MemoryTab = "files" | "search" | "graph" | "health" | "dreams";

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
    <section className="deckgo-panel-workspace deck-ui-memory">
      <div className="deckgo-column deck-ui-memory-column">
        <article className="deckgo-card is-float deck-ui-memory-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("title")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("panelDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-memory-body">
            <div className="deckgo-pill-row deck-ui-memory-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                {t("memoryStatus", { state: t(loadState) })}
              </span>
              <span className="deckgo-pill">{t("agentValue", { agentId })}</span>
            </div>
            <div className="deckgo-actions deck-ui-memory-controls">
              <input
                className="deckgo-input deck-ui-memory-input"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                placeholder={t("agentIdPlaceholder")}
              />
              {agents.length > 0 ? (
                <select
                  aria-label={t("agentSelector")}
                  className="deckgo-input deck-ui-memory-input"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "files" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("files")}
              >
                {t("files")}
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "search" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("search")}
              >
                {t("searchTab")}
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "graph" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("graph")}
              >
                {t("graphTab")}
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "health" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("health")}
              >
                {t("health")}
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "dreams" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("dreams")}
              >
                {t("dreams.tab")}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-memory-error">{error}</p> : null}
            {tab === "files" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label={t("entries")} value={files.length} />
                  <ShellStat label={t("selectedPath")} value={selectedPath || t("na")} />
                </div>
                <div className="deckgo-actions deck-ui-memory-actions">
                  <span className="deckgo-pill">
                    {t("browsing", { path: currentBrowsePath || t("memoryRoot") })}
                  </span>
                  {currentBrowsePath ? (
                    <button
                      className="deckgo-button deck-ui-memory-button"
                      type="button"
                      onClick={() =>
                        void refreshFiles(memoryParentPath(currentBrowsePath) || undefined)
                      }
                    >
                      {t("backToParent")}
                    </button>
                  ) : null}
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">{t("noMemoryFilesLoaded")}</p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <button
                          type="button"
                          className={`deckgo-selectable-card deck-ui-memory-row ${selectedPath === file.path ? "is-selected" : ""}`}
                          onClick={() => {
                            if (file.type === "file") {
                              void readFileAction(file.path);
                            } else {
                              void refreshFiles(file.path);
                            }
                          }}
                        >
                          <strong>{file.name}</strong>
                          <div className="deckgo-meta deck-ui-memory-meta">
                            {t("fileMeta", {
                              path: file.path,
                              size: file.size ?? t("na"),
                              type: file.type,
                            })}
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}
            {tab === "graph" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label={t("nodes")} value={files.length} />
                  <ShellStat
                    label={t("directories")}
                    value={files.filter((file) => file.type === "directory").length}
                  />
                </div>
                <div className="deckgo-surface-tile deck-ui-memory-surface">
                  <p className="deckgo-surface-label">{t("graph")}</p>
                  <p className="deckgo-note">{t("graphDescription")}</p>
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">{t("noGraphNodes")}</p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <div className="deckgo-selectable-card deck-ui-memory-row">
                          <strong>{file.name}</strong>
                          <div className="deckgo-meta deck-ui-memory-meta">
                            {t("graphNodeMeta", {
                              connections: countRelatedMemoryNodes(file, files),
                              path: file.path,
                              type: file.type,
                            })}
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}
            {tab === "search" ? (
              <>
                <div className="deckgo-actions deck-ui-memory-controls">
                  <input
                    className="deckgo-input deck-ui-memory-input"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("searchMemoryPlaceholder")}
                  />
                  <select
                    className="deckgo-input deck-ui-memory-input"
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
                    className="deckgo-button deck-ui-memory-button is-primary"
                    type="button"
                    onClick={() => void searchAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "searching" ? t("searching") : t("searchMemory")}
                  </button>
                </div>
                {searchUnavailableReason ? (
                  <p className="deckgo-note deck-ui-memory-error">{searchUnavailableReason}</p>
                ) : null}
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label={t("results")} value={searchResults.length} />
                  <ShellStat label={t("scope")} value={searchScope} />
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {searchResults.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">{t("noSearchResultsLoaded")}</p>
                  ) : (
                    searchResults.map((result, index) => (
                      <li key={`${result.path}-${index}`}>
                        <div className="deckgo-selectable-card deck-ui-memory-row">
                          <strong>{result.path}</strong>
                          <div className="deckgo-meta deck-ui-memory-meta">
                            {t("searchResultMeta", {
                              relevance: result.relevance,
                              scope: result.scope || t("na"),
                              tier: result.tier || t("na"),
                            })}
                          </div>
                          <div className="deckgo-meta deck-ui-memory-meta">{result.content}</div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : null}
            {tab === "health" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label={t("entries")} value={healthEntries.length} />
                  <ShellStat
                    label={t("lanceDb")}
                    value={healthResponse?.lanceDbEnabled ? t("enabled") : t("off")}
                  />
                </div>
                <JsonDetails title={t("healthPayload")} payload={healthEntries} />
              </>
            ) : null}
            {tab === "dreams" ? (
              <>
                <div className="deckgo-actions deck-ui-memory-actions">
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("read")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamRead")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("backfill")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamBackfill")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("dedupe")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamDedupe")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("repair")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamRepair")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("resetShortTerm")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamResetShortTerm")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("reset")}
                    disabled={actionState !== "idle"}
                  >
                    {t("dreamReset")}
                  </button>
                </div>
                <div className="deckgo-surface-tile deck-ui-memory-surface deck-ui-memory-diary">
                  <p className="deckgo-surface-label">{t("dreams.title")}</p>
                  {dreamDiary ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                        <ShellStat label={t("agent")} value={dreamDiary.agentId} />
                        <ShellStat
                          label={t("status")}
                          value={dreamDiary.found ? t("found") : t("notFound")}
                        />
                        <ShellStat label={t("path")} value={dreamDiary.path} />
                        <ShellStat
                          label={t("updated")}
                          value={formatMemoryTimestamp(dreamDiary.updatedAtMs)}
                        />
                      </div>
                      {dreamDiary.content ? (
                        <p className="deckgo-note">
                          {dreamDiary.content.replace(/\s+/g, " ").trim().slice(0, 160)}
                        </p>
                      ) : (
                        <p className="deckgo-note">{t("noDreamDiaryContent")}</p>
                      )}
                    </>
                  ) : (
                    <p className="deckgo-note">{t("dreamDiaryUnread")}</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-memory-column deck-ui-memory-detail-column">
        <article className="deckgo-card is-float deck-ui-memory-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("detailTitle")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("detailDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-memory-body">
            {tab === "files" ? (
              selectedPath ? (
                <div className="deckgo-surface-tile deck-ui-memory-surface">
                  <p className="deckgo-surface-label">{selectedPath}</p>
                  <pre className="deckgo-code deck-ui-memory-code deck-ui-memory-code-wrap">
                    {selectedContent}
                  </pre>
                </div>
              ) : (
                <p className="deckgo-note deck-ui-memory-empty">{t("selectFileToRead")}</p>
              )
            ) : null}
            {tab === "search" ? (
              searchResults.length > 0 ? (
                <JsonDetails title={t("searchResultsTitle")} payload={searchResults} />
              ) : (
                <p className="deckgo-note deck-ui-memory-empty">{t("runSearchToInspect")}</p>
              )
            ) : null}
            {tab === "graph" ? (
              files.length > 0 ? (
                <JsonDetails title={t("graphNodesTitle")} payload={files} />
              ) : (
                <p className="deckgo-note deck-ui-memory-empty">{t("loadFilesForGraph")}</p>
              )
            ) : null}
            {tab === "health" ? (
              <JsonDetails title={t("rawHealthResponse")} payload={healthResponse} />
            ) : null}
            {tab === "dreams" ? (
              <>
                {dreamDiary ? (
                  <div className="deckgo-surface-tile deck-ui-memory-surface">
                    <p className="deckgo-surface-label">{dreamDiary.path}</p>
                    <pre className="deckgo-code deck-ui-memory-code deck-ui-memory-code-wrap">
                      {dreamDiary.content || t("noDreamDiaryContent")}
                    </pre>
                  </div>
                ) : (
                  <p className="deckgo-note deck-ui-memory-empty">{t("readDreamDiaryToInspect")}</p>
                )}
                {dreamsResult ? (
                  <JsonDetails title={t("dreamActionResult")} payload={dreamsResult} />
                ) : null}
              </>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

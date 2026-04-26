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
      setError(loadError instanceof Error ? loadError.message : "failed to browse memory");
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
      setError(actionError instanceof Error ? actionError.message : "failed to read memory file");
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
      setError(loadError instanceof Error ? loadError.message : "failed to load memory health");
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
      setError(actionError instanceof Error ? actionError.message : "memory dreams read failed");
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
      setError("memory search query is required");
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
      setError(actionError instanceof Error ? actionError.message : "memory search failed");
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
      !window.confirm(`Run memory dreams ${action}?`)
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
      setError(actionError instanceof Error ? actionError.message : "memory dreams action failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-memory">
      <div className="deckgo-column deck-ui-memory-column">
        <article className="deckgo-card is-float deck-ui-memory-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Memory</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Browse memory files, search memory, inspect health, and run dream-diary actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-memory-body">
            <div className="deckgo-pill-row deck-ui-memory-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Memory {loadState}
              </span>
              <span className="deckgo-pill">agent {agentId}</span>
            </div>
            <div className="deckgo-actions deck-ui-memory-controls">
              <input
                className="deckgo-input deck-ui-memory-input"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
                placeholder="agent id"
              />
              {agents.length > 0 ? (
                <select
                  aria-label="Memory agent selector"
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
                Files
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "search" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("search")}
              >
                Search
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "graph" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("graph")}
              >
                Graph
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "health" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("health")}
              >
                Health
              </button>
              <button
                className={`deckgo-button deck-ui-memory-button deck-ui-memory-tab ${tab === "dreams" ? "is-primary" : ""}`}
                type="button"
                onClick={() => setTab("dreams")}
              >
                Dreams
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-memory-error">{error}</p> : null}
            {tab === "files" ? (
              <>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label="entries" value={files.length} />
                  <ShellStat label="selected path" value={selectedPath || "n/a"} />
                </div>
                <div className="deckgo-actions deck-ui-memory-actions">
                  <span className="deckgo-pill">browsing {currentBrowsePath || "memory root"}</span>
                  {currentBrowsePath ? (
                    <button
                      className="deckgo-button deck-ui-memory-button"
                      type="button"
                      onClick={() =>
                        void refreshFiles(memoryParentPath(currentBrowsePath) || undefined)
                      }
                    >
                      Back to parent
                    </button>
                  ) : null}
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">No memory files loaded.</p>
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
                            {file.type} | {file.path} | size: {file.size ?? "n/a"}
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
                  <ShellStat label="nodes" value={files.length} />
                  <ShellStat
                    label="directories"
                    value={files.filter((file) => file.type === "directory").length}
                  />
                </div>
                <div className="deckgo-surface-tile deck-ui-memory-surface">
                  <p className="deckgo-surface-label">Knowledge graph</p>
                  <p className="deckgo-note">
                    Memory files grouped by path relationships for quick context navigation.
                  </p>
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {files.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">
                      No memory graph nodes loaded.
                    </p>
                  ) : (
                    files.map((file) => (
                      <li key={file.path}>
                        <div className="deckgo-selectable-card deck-ui-memory-row">
                          <strong>{file.name}</strong>
                          <div className="deckgo-meta deck-ui-memory-meta">
                            {file.type} | {file.path} | connections:{" "}
                            {countRelatedMemoryNodes(file, files)}
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
                    placeholder="search memory"
                  />
                  <select
                    className="deckgo-input deck-ui-memory-input"
                    value={searchScope}
                    onChange={(event) =>
                      setSearchScope(event.target.value as DeckGoMemorySearchScope)
                    }
                  >
                    <option value="all">all</option>
                    <option value="global">global</option>
                    <option value="agent">agent</option>
                  </select>
                  <button
                    className="deckgo-button deck-ui-memory-button is-primary"
                    type="button"
                    onClick={() => void searchAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "searching" ? "Searching" : "Search memory"}
                  </button>
                </div>
                {searchUnavailableReason ? (
                  <p className="deckgo-note deck-ui-memory-error">{searchUnavailableReason}</p>
                ) : null}
                <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                  <ShellStat label="results" value={searchResults.length} />
                  <ShellStat label="scope" value={searchScope} />
                </div>
                <ul className="deckgo-shell-list deck-ui-memory-list">
                  {searchResults.length === 0 ? (
                    <p className="deckgo-note deck-ui-memory-empty">
                      No memory search results loaded.
                    </p>
                  ) : (
                    searchResults.map((result, index) => (
                      <li key={`${result.path}-${index}`}>
                        <div className="deckgo-selectable-card deck-ui-memory-row">
                          <strong>{result.path}</strong>
                          <div className="deckgo-meta deck-ui-memory-meta">
                            relevance: {result.relevance} | tier: {result.tier || "n/a"} | scope:{" "}
                            {result.scope || "n/a"}
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
                  <ShellStat label="entries" value={healthEntries.length} />
                  <ShellStat
                    label="lance db"
                    value={healthResponse?.lanceDbEnabled ? "enabled" : "off"}
                  />
                </div>
                <JsonDetails title="Health payload" payload={healthEntries} />
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
                    Read
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("backfill")}
                    disabled={actionState !== "idle"}
                  >
                    Backfill
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("dedupe")}
                    disabled={actionState !== "idle"}
                  >
                    Dedupe
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button"
                    type="button"
                    onClick={() => void dreamsAction("repair")}
                    disabled={actionState !== "idle"}
                  >
                    Repair
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("resetShortTerm")}
                    disabled={actionState !== "idle"}
                  >
                    Reset short-term
                  </button>
                  <button
                    className="deckgo-button deck-ui-memory-button is-danger"
                    type="button"
                    onClick={() => void dreamsAction("reset")}
                    disabled={actionState !== "idle"}
                  >
                    Reset
                  </button>
                </div>
                <div className="deckgo-surface-tile deck-ui-memory-surface deck-ui-memory-diary">
                  <p className="deckgo-surface-label">Dream diary</p>
                  {dreamDiary ? (
                    <>
                      <div className="deckgo-grid deckgo-grid-2 deck-ui-memory-stats">
                        <ShellStat label="agent" value={dreamDiary.agentId} />
                        <ShellStat
                          label="status"
                          value={dreamDiary.found ? "found" : "not found"}
                        />
                        <ShellStat label="path" value={dreamDiary.path} />
                        <ShellStat
                          label="updated"
                          value={formatMemoryTimestamp(dreamDiary.updatedAtMs)}
                        />
                      </div>
                      {dreamDiary.content ? (
                        <p className="deckgo-note">
                          {dreamDiary.content.replace(/\s+/g, " ").trim().slice(0, 160)}
                        </p>
                      ) : (
                        <p className="deckgo-note">No dream diary content returned.</p>
                      )}
                    </>
                  ) : (
                    <p className="deckgo-note">Dream diary has not been read yet.</p>
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
            <h2 className="deckgo-card-title">Memory detail</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Gateway recall results render when available, and the LanceDB-unavailable state stays
            explicit when the backend returns a degraded response.
          </p>
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
                <p className="deckgo-note deck-ui-memory-empty">Select a memory file to read it.</p>
              )
            ) : null}
            {tab === "search" ? (
              searchResults.length > 0 ? (
                <JsonDetails title="Memory search results" payload={searchResults} />
              ) : (
                <p className="deckgo-note deck-ui-memory-empty">
                  Run a memory search to inspect recall results.
                </p>
              )
            ) : null}
            {tab === "graph" ? (
              files.length > 0 ? (
                <JsonDetails title="Memory graph nodes" payload={files} />
              ) : (
                <p className="deckgo-note deck-ui-memory-empty">
                  Load memory files to inspect graph nodes.
                </p>
              )
            ) : null}
            {tab === "health" ? (
              <JsonDetails title="Raw health response" payload={healthResponse} />
            ) : null}
            {tab === "dreams" ? (
              <>
                {dreamDiary ? (
                  <div className="deckgo-surface-tile deck-ui-memory-surface">
                    <p className="deckgo-surface-label">{dreamDiary.path}</p>
                    <pre className="deckgo-code deck-ui-memory-code deck-ui-memory-code-wrap">
                      {dreamDiary.content || "No dream diary content returned."}
                    </pre>
                  </div>
                ) : (
                  <p className="deckgo-note deck-ui-memory-empty">
                    Read the dream diary to inspect its content.
                  </p>
                )}
                {dreamsResult ? (
                  <JsonDetails title="Dream diary action result" payload={dreamsResult} />
                ) : null}
              </>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

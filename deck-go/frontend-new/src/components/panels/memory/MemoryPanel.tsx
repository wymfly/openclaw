import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DeckGoAgentSummary,
  DeckGoMemoryDreamAction,
  DeckGoMemoryDreamActionResult,
  DeckGoMemoryDreamDiaryResult,
  DeckGoMemoryDreamsResult,
  DeckGoMemoryFileNode,
  DeckGoMemoryHealthEntry,
  DeckGoMemoryHealthResponse,
  DeckGoMemorySearchResponse,
  DeckGoMemorySearchResult,
  DeckGoMemorySearchScope,
} from "../../../api";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import { useAgentsListQuery } from "../../../data/modules/agents";
import {
  memoryBrowseQueryOptions,
  memoryFileQueryOptions,
  memoryHealthQueryOptions,
  memorySearchQueryOptions,
  useMemoryHealthQuery,
  useRunMemoryDreamsMutation,
} from "../../../data/modules/memory";
import { Markdown } from "../../../design-system/atoms/Markdown";
import { ProgressBar } from "../../../design-system/atoms/ProgressBar";
import {
  IconAlert,
  IconArrowD,
  IconArrowR,
  IconBook,
  IconCheck,
  IconCopy,
  IconFile,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconShield,
  IconTrash,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import "./memory-panel.css";

type MemoryTab = "browse" | "search" | "health" | "dreams";
type LoadState = "idle" | "loading" | "ready";
type ActionState = "idle" | "browse" | "read" | "search" | "health" | "dreams";
type PendingDreamAction = {
  id: Extract<DeckGoMemoryDreamAction, "reset" | "resetShortTerm">;
  label: string;
  hint: string;
};

const MEMORY_TABS: Array<{ id: MemoryTab; labelKey: string; icon: ReactNode }> = [
  { id: "browse", labelKey: "browseTab", icon: <IconBook /> },
  { id: "search", labelKey: "searchTab", icon: <IconSearch /> },
  { id: "health", labelKey: "health", icon: <IconShield /> },
  { id: "dreams", labelKey: "dreams.tab", icon: <IconInfo /> },
];

const DANGEROUS_DREAM_ACTIONS = new Set<DeckGoMemoryDreamAction>(["reset", "resetShortTerm"]);

function normalizeApiPath(path?: string) {
  return (path ?? "").replace(/^\/+/u, "").replace(/\/+$/u, "");
}

function displayMemoryPath(path?: string) {
  const normalized = normalizeApiPath(path);
  return normalized ? `/${normalized}` : "/";
}

function formatMemorySize(value?: number) {
  if (typeof value !== "number") {
    return "n/a";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
  if (response.agentId || response.provider || response.embedding || response.error) {
    return [
      {
        agentId: response.agentId || "main",
        provider: response.provider || "unknown",
        embeddingStatus: response.embedding?.ok ? "ok" : response.error ? "error" : "unknown",
        error: response.embedding?.error || response.error,
      },
    ];
  }
  return [];
}

function isDreamDiaryResult(
  result: DeckGoMemoryDreamsResult,
): result is DeckGoMemoryDreamDiaryResult {
  return !("action" in result);
}

function isDreamActionResult(
  result: DeckGoMemoryDreamsResult | null,
): result is DeckGoMemoryDreamActionResult {
  return Boolean(result && "action" in result);
}

function flattenDirectoryCache(cache: Record<string, DeckGoMemoryFileNode[]>) {
  const seen = new Map<string, DeckGoMemoryFileNode>();
  for (const files of Object.values(cache)) {
    for (const file of files) {
      seen.set(file.path, file);
    }
  }
  return Array.from(seen.values());
}

function memoryErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function dreamResultEntries(result: DeckGoMemoryDreamActionResult) {
  const entries: Array<[string, string | number | boolean]> = [];
  const fields: Array<[keyof DeckGoMemoryDreamActionResult, string]> = [
    ["scannedFiles", "scannedFiles"],
    ["written", "written"],
    ["replaced", "replaced"],
    ["removedEntries", "removedEntries"],
    ["removedShortTermEntries", "removedShortTermEntries"],
    ["dedupedEntries", "dedupedEntries"],
    ["keptEntries", "keptEntries"],
    ["changed", "changed"],
    ["archiveDir", "archiveDir"],
    ["archivedDreamsDiary", "archivedDreamsDiary"],
    ["archivedSessionCorpus", "archivedSessionCorpus"],
    ["archivedSessionIngestion", "archivedSessionIngestion"],
  ];
  for (const [field, label] of fields) {
    const value = result[field];
    if (value !== undefined && value !== null && value !== "") {
      entries.push([label, String(value)]);
    }
  }
  if (result.warnings && result.warnings.length > 0) {
    entries.push(["warnings", result.warnings.join(", ")]);
  }
  return entries;
}

function AgentLabel(props: { agent?: Pick<DeckGoAgentSummary, "id" | "name">; fallback: string }) {
  return (
    <span className="memory-agent-dot">
      <span className="memory-agent-dot__bullet" aria-hidden="true" />
      <span>{props.agent?.name || props.fallback}</span>
    </span>
  );
}

function StatusDot(props: { status: DeckGoMemoryHealthEntry["embeddingStatus"] }) {
  return <span className={`memory-status-dot is-${props.status}`} aria-hidden="true" />;
}

function SizeChip(props: { value?: number }) {
  return <span className="memory-size-chip">{formatMemorySize(props.value)}</span>;
}

function RelevanceBar(props: { value: number }) {
  const value = Number.isFinite(props.value) ? Math.max(0, Math.min(1, props.value)) : 0;
  return (
    <span className="memory-score">
      <ProgressBar value={value} aria-label="memory relevance" className="memory-score__bar" />
      <span className="memory-score__label">{Math.round(value * 100)}%</span>
    </span>
  );
}

function DecayBar(props: { value?: number }) {
  const value = typeof props.value === "number" ? Math.max(0, Math.min(1, props.value)) : 0;
  const tone = value > 0.6 ? "err" : value > 0.2 ? "warn" : "ok";
  const bucket = Math.round(value * 10) * 10;
  return (
    <span className={`memory-decay is-${tone} is-pct-${bucket}`}>
      <span className="memory-decay__track">
        <span className="memory-decay__fill" />
      </span>
    </span>
  );
}

export function MemoryPanel() {
  const t = useTranslations("memory");
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const agentsQuery = useAgentsListQuery();
  const healthQuery = useMemoryHealthQuery();
  const runDreamsMutation = useRunMemoryDreamsMutation();
  const [activeTab, setActiveTab] = useState<MemoryTab>(() => {
    if (typeof window === "undefined") {
      return "browse";
    }
    const hash = window.location.hash.replace("#/", "");
    return MEMORY_TABS.some((tab) => tab.id === hash) ? (hash as MemoryTab) : "browse";
  });
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [agentId, setAgentId] = useState("main");
  const [dreamAgentId, setDreamAgentId] = useState("main");
  const [directoryCache, setDirectoryCache] = useState<Record<string, DeckGoMemoryFileNode[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([""]));
  const [selectedPath, setSelectedPath] = useState("");
  const [selectedContent, setSelectedContent] = useState("");
  const [copiedPath, setCopiedPath] = useState(false);
  const [healthResponse, setHealthResponse] = useState<DeckGoMemoryHealthResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<DeckGoMemorySearchScope>("all");
  const [searchResponse, setSearchResponse] = useState<DeckGoMemorySearchResponse | null>(null);
  const [dreamDiary, setDreamDiary] = useState<DeckGoMemoryDreamDiaryResult | null>(null);
  const [dreamResult, setDreamResult] = useState<DeckGoMemoryDreamsResult | null>(null);
  const [pendingDreamAction, setPendingDreamAction] = useState<PendingDreamAction | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState("");

  const activeAgent = agents.find((agent) => agent.id === agentId);
  const activeDreamAgent = agents.find((agent) => agent.id === dreamAgentId);
  const healthEntries = useMemo(() => normalizeHealthEntries(healthResponse), [healthResponse]);
  const allKnownFiles = useMemo(() => flattenDirectoryCache(directoryCache), [directoryCache]);
  const totalKnownFiles = allKnownFiles.filter((file) => file.type === "file").length;
  const healthErrors = healthEntries.filter((entry) => entry.embeddingStatus === "error");
  const searchResults = searchResponse?.results ?? [];
  const currentFiles = directoryCache[""] ?? [];
  const selectedContentPath = selectedPath ? displayMemoryPath(selectedPath) : t("noSelection");
  const selectedTab = MEMORY_TABS.find((tab) => tab.id === activeTab) ?? MEMORY_TABS[0];

  const loadDirectory = async (path = "", force = false) => {
    const normalizedPath = normalizeApiPath(path);
    if (!force && directoryCache[normalizedPath]) {
      return;
    }
    setActionState("browse");
    try {
      const result = await queryClient.fetchQuery({
        ...memoryBrowseQueryOptions(bff, agentId, normalizedPath || undefined),
        staleTime: force ? 0 : undefined,
      });
      setDirectoryCache((current) => ({
        ...current,
        [normalizedPath]: result.files ?? [],
      }));
      setLoadState("ready");
      setError("");
    } catch (loadError) {
      setLoadState("idle");
      setError(memoryErrorMessage(loadError, t("failedBrowse")));
    } finally {
      setActionState("idle");
    }
  };

  const refreshHealth = async () => {
    setActionState("health");
    try {
      const result = await queryClient.fetchQuery({
        ...memoryHealthQueryOptions(bff),
        staleTime: 0,
      });
      setHealthResponse(result);
      setError("");
    } catch (loadError) {
      setError(memoryErrorMessage(loadError, t("failedHealth")));
    } finally {
      setActionState("idle");
    }
  };

  const selectFile = async (path: string) => {
    const normalizedPath = normalizeApiPath(path);
    setSelectedPath(normalizedPath);
    setActionState("read");
    try {
      const result = await queryClient.fetchQuery(
        memoryFileQueryOptions(bff, agentId, normalizedPath),
      );
      if (typeof result.content !== "string") {
        throw new Error(t("missingFileContent"));
      }
      setSelectedContent(result.content);
      setError("");
    } catch (readError) {
      setSelectedContent("");
      setError(memoryErrorMessage(readError, t("failedRead")));
    } finally {
      setActionState("idle");
    }
  };

  const toggleDirectory = async (path: string) => {
    const normalizedPath = normalizeApiPath(path);
    if (expandedPaths.has(normalizedPath)) {
      setExpandedPaths((current) => {
        const next = new Set(current);
        next.delete(normalizedPath);
        return next;
      });
      return;
    }
    setExpandedPaths((current) => new Set(current).add(normalizedPath));
    await loadDirectory(normalizedPath);
  };

  const copySelectedPath = async () => {
    if (!selectedPath) {
      return;
    }
    try {
      await navigator.clipboard?.writeText(displayMemoryPath(selectedPath));
      setCopiedPath(true);
      window.setTimeout(() => setCopiedPath(false), 1400);
    } catch {
      setCopiedPath(false);
    }
  };

  const submitSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setError(t("searchRequired"));
      return;
    }
    setActionState("search");
    try {
      const result = await queryClient.fetchQuery({
        ...memorySearchQueryOptions(bff, {
          query,
          scope: searchScope,
          agentId: searchScope === "agent" ? agentId : undefined,
        }),
        staleTime: 0,
      });
      setSearchResponse(result);
      setError("");
    } catch (searchError) {
      setSearchResponse(null);
      setError(memoryErrorMessage(searchError, t("failedSearch")));
    } finally {
      setActionState("idle");
    }
  };

  const readDreamDiary = async (targetAgentId = dreamAgentId) => {
    setActionState("dreams");
    try {
      const result = await runDreamsMutation.mutateAsync({
        action: "read",
        agentId: targetAgentId,
      });
      if (isDreamDiaryResult(result)) {
        setDreamDiary(result);
      } else {
        setDreamResult(result);
      }
      setError("");
    } catch (dreamError) {
      setError(memoryErrorMessage(dreamError, t("failedDreamRead")));
    } finally {
      setActionState("idle");
    }
  };

  const runDreamAction = async (action: DeckGoMemoryDreamAction) => {
    if (action === "read") {
      await readDreamDiary();
      return;
    }
    if (DANGEROUS_DREAM_ACTIONS.has(action)) {
      setPendingDreamAction({
        id: action as PendingDreamAction["id"],
        label: action === "reset" ? t("dreamReset") : t("dreamResetShortTerm"),
        hint: action === "reset" ? t("dreamResetHint") : t("dreamResetShortTermHint"),
      });
      return;
    }
    await executeDreamAction(action);
  };

  const executeDreamAction = async (action: DeckGoMemoryDreamAction) => {
    setPendingDreamAction(null);
    setActionState("dreams");
    try {
      const result = await runDreamsMutation.mutateAsync({ action, agentId: dreamAgentId });
      setDreamResult(result);
      if (action !== "read") {
        const diaryResult = await runDreamsMutation.mutateAsync({
          action: "read",
          agentId: dreamAgentId,
        });
        if (isDreamDiaryResult(diaryResult)) {
          setDreamDiary(diaryResult);
        }
      }
      setError("");
    } catch (dreamError) {
      setError(memoryErrorMessage(dreamError, t("failedDreamAction")));
    } finally {
      setActionState("idle");
    }
  };

  useEffect(() => {
    const nextAgents = agentsQuery.data?.agents ?? [];
    const fallbackId = agentsQuery.data?.defaultId || nextAgents[0]?.id || "main";
    setAgents(nextAgents);
    setAgentId((current) =>
      nextAgents.some((agent) => agent.id === current) ? current : fallbackId,
    );
    setDreamAgentId((current) =>
      nextAgents.some((agent) => agent.id === current) ? current : fallbackId,
    );
  }, [agentsQuery.data]);

  useEffect(() => {
    if (healthQuery.data) {
      setHealthResponse(healthQuery.data);
    }
    if (healthQuery.error) {
      setError(memoryErrorMessage(healthQuery.error, t("failedHealth")));
    }
  }, [healthQuery.data, healthQuery.error, t]);

  useEffect(() => {
    setDirectoryCache({});
    setExpandedPaths(new Set([""]));
    setSelectedPath("");
    setSelectedContent("");
    setLoadState("loading");
    void loadDirectory("", true);
  }, [agentId]);

  useEffect(() => {
    const firstFile = currentFiles.find((file) => file.type === "file");
    if (!selectedPath && firstFile) {
      void selectFile(firstFile.path);
    }
  }, [currentFiles, selectedPath]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#/${activeTab}`);
    }
    if (activeTab === "health") {
      void refreshHealth();
    }
    if (activeTab === "dreams" && !dreamDiary) {
      void readDreamDiary();
    }
  }, [activeTab]);

  useEffect(() => {
    setPendingDreamAction(null);
    setDreamResult(null);
  }, [dreamAgentId]);

  const setTab = (next: MemoryTab) => setActiveTab(next);

  return (
    <section className="memory-panel" data-testid="memory-panel">
      <header className="memory-topbar">
        <div className="memory-topbar__brand">
          <IconBook />
          <span>{t("title")}</span>
          <span className="memory-muted">{t("brandSubline")}</span>
        </div>

        <nav className="memory-topbar__tabs" role="tablist" aria-label={t("lanesLabel")}>
          {MEMORY_TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`memory-topbar__tab ${active ? "is-active" : ""}`}
                onClick={() => setTab(tab.id)}
              >
                {tab.icon}
                <span>{t(tab.labelKey)}</span>
                {tab.id === "health" && healthErrors.length > 0 ? (
                  <span className="memory-topbar__badge">{healthErrors.length}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="memory-topbar__actions" aria-label={t("summaryLabel")}>
          {agents.length > 0 ? (
            <label className="memory-agent-select">
              <span className="memory-sr">{t("agentSelector")}</span>
              <select
                aria-label={t("agentSelector")}
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
          <span className="memory-topbar__kpi">
            <strong>{totalKnownFiles}</strong> {t("files")}
          </span>
          <span className="memory-topbar__kpi">
            <strong>{healthEntries.length || agents.length}</strong> {t("agents")}
          </span>
          <span className={`memory-topbar__kpi ${healthErrors.length > 0 ? "is-error" : ""}`}>
            <strong>{healthErrors.length}</strong> {t("errors")}
          </span>
        </div>
      </header>

      {error ? (
        <div className="memory-banner is-error" role="alert">
          <IconAlert />
          <span>{error}</span>
        </div>
      ) : null}

      <main className="memory-workspace">
        {activeTab === "browse" ? (
          <MemoryBrowseTab
            actionState={actionState}
            copiedPath={copiedPath}
            directoryCache={directoryCache}
            expandedPaths={expandedPaths}
            files={currentFiles}
            loadState={loadState}
            selectedContent={selectedContent}
            selectedPath={selectedPath}
            t={t}
            onCopyPath={copySelectedPath}
            onRefresh={() => void loadDirectory("", true)}
            onSelectFile={(path) => void selectFile(path)}
            onToggleDirectory={(path) => void toggleDirectory(path)}
          />
        ) : null}

        {activeTab === "search" ? (
          <MemorySearchTab
            actionState={actionState}
            query={searchQuery}
            response={searchResponse}
            results={searchResults}
            scope={searchScope}
            selectedAgent={activeAgent}
            selectedAgentId={agentId}
            t={t}
            onClear={() => {
              setSearchQuery("");
              setSearchResponse(null);
            }}
            onQueryChange={setSearchQuery}
            onScopeChange={setSearchScope}
            onSubmit={() => void submitSearch()}
          />
        ) : null}

        {activeTab === "health" ? (
          <MemoryHealthTab
            actionState={actionState}
            entries={healthEntries}
            response={healthResponse}
            t={t}
            onRefresh={() => void refreshHealth()}
          />
        ) : null}

        {activeTab === "dreams" ? (
          <MemoryDreamsTab
            actionState={actionState}
            agents={agents}
            activeAgent={activeDreamAgent}
            activeAgentId={dreamAgentId}
            diary={dreamDiary}
            pendingAction={pendingDreamAction}
            result={dreamResult}
            t={t}
            onAgentChange={setDreamAgentId}
            onCancelPending={() => setPendingDreamAction(null)}
            onConfirmPending={(action) => void executeDreamAction(action)}
            onRunAction={(action) => void runDreamAction(action)}
          />
        ) : null}
      </main>

      <footer className="memory-footer">
        <span>{t("contractLane")}</span>
        <span>{t("memoryStatus", { state: t(loadState) })}</span>
        <span>{t("agentValue", { agentId })}</span>
        <span>{selectedTab ? t(selectedTab.labelKey) : selectedContentPath}</span>
      </footer>
    </section>
  );
}

function MemoryBrowseTab(props: {
  actionState: ActionState;
  copiedPath: boolean;
  directoryCache: Record<string, DeckGoMemoryFileNode[]>;
  expandedPaths: Set<string>;
  files: DeckGoMemoryFileNode[];
  loadState: LoadState;
  selectedContent: string;
  selectedPath: string;
  t: ReturnType<typeof useTranslations>;
  onCopyPath: () => void;
  onRefresh: () => void;
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  const totalBytes = flattenDirectoryCache(props.directoryCache).reduce(
    (sum, file) => sum + (file.size ?? 0),
    0,
  );
  return (
    <section className="memory-browser" aria-label={props.t("browseTab")}>
      <aside className="memory-browser__tree">
        <div className="memory-browser__tree-head">
          <div>
            <h3>{props.t("fileTree")}</h3>
            <p>
              {props.t("browseTreeMeta", {
                count: props.files.length,
                size: formatMemorySize(totalBytes),
              })}
            </p>
          </div>
          <button className="memory-icon-button" type="button" onClick={props.onRefresh}>
            <IconRefresh />
            <span className="memory-sr">{props.t("refresh")}</span>
          </button>
        </div>
        <div className="memory-browser__tree-body">
          {props.files.length === 0 && props.loadState !== "loading" ? (
            <p className="memory-empty">{props.t("noMemoryFilesLoaded")}</p>
          ) : (
            <MemoryFileTree
              directoryCache={props.directoryCache}
              expandedPaths={props.expandedPaths}
              files={props.files}
              selectedPath={props.selectedPath}
              t={props.t}
              onSelectFile={props.onSelectFile}
              onToggleDirectory={props.onToggleDirectory}
            />
          )}
          {props.actionState === "browse" ? (
            <p className="memory-empty">{props.t("loading")}</p>
          ) : null}
        </div>
      </aside>

      <article className="memory-browser__viewer">
        <header className="memory-browser__viewer-head">
          <div className="memory-browser__crumbs">
            {(props.selectedPath ? displayMemoryPath(props.selectedPath) : "/")
              .split("/")
              .filter(Boolean)
              .map((segment, index, array) => (
                <span
                  key={`${segment}-${index}`}
                  className={index === array.length - 1 ? "is-current" : ""}
                >
                  {index > 0 ? <IconArrowR /> : null}
                  {segment}
                </span>
              ))}
            {!props.selectedPath ? <span className="is-current">/</span> : null}
          </div>
          <button
            className="memory-path-chip"
            type="button"
            disabled={!props.selectedPath}
            onClick={props.onCopyPath}
          >
            <IconCopy />
            <span>
              {props.selectedPath ? displayMemoryPath(props.selectedPath) : props.t("noSelection")}
            </span>
            {props.copiedPath ? <strong>{props.t("copied")}</strong> : null}
          </button>
        </header>
        <div className="memory-browser__content">
          {props.selectedContent ? (
            <Markdown content={props.selectedContent} className="memory-markdown" />
          ) : (
            <div className="memory-empty is-centered">
              <IconFile />
              <p>{props.selectedPath ? props.t("failedRead") : props.t("selectFileToRead")}</p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function MemoryFileTree(props: {
  directoryCache: Record<string, DeckGoMemoryFileNode[]>;
  expandedPaths: Set<string>;
  files: DeckGoMemoryFileNode[];
  selectedPath: string;
  t: ReturnType<typeof useTranslations>;
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  return (
    <ul className="memory-tree">
      {props.files.map((file) => (
        <MemoryFileNode key={file.path} depth={0} file={file} {...props} />
      ))}
    </ul>
  );
}

function MemoryFileNode(props: {
  depth: number;
  directoryCache: Record<string, DeckGoMemoryFileNode[]>;
  expandedPaths: Set<string>;
  file: DeckGoMemoryFileNode;
  selectedPath: string;
  t: ReturnType<typeof useTranslations>;
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string) => void;
}) {
  const normalizedPath = normalizeApiPath(props.file.path);
  const expanded = props.expandedPaths.has(normalizedPath);
  const children = props.directoryCache[normalizedPath] ?? [];
  const selected = normalizeApiPath(props.selectedPath) === normalizedPath;
  return (
    <li>
      <button
        type="button"
        className={`memory-tree__row depth-${Math.min(props.depth, 8)} ${selected ? "is-selected" : ""}`}
        onClick={() =>
          props.file.type === "directory"
            ? props.onToggleDirectory(normalizedPath)
            : props.onSelectFile(normalizedPath)
        }
      >
        <span className="memory-tree__chevron" aria-hidden="true">
          {props.file.type === "directory" ? expanded ? <IconArrowD /> : <IconArrowR /> : null}
        </span>
        <span className={`memory-tree__icon is-${props.file.type}`} aria-hidden="true">
          {props.file.type === "directory" ? <IconBook /> : <IconFile />}
        </span>
        <span className="memory-tree__name">{props.file.name}</span>
        {props.file.type === "file" ? <SizeChip value={props.file.size} /> : null}
      </button>
      {props.file.type === "directory" && expanded && children.length > 0 ? (
        <ul className="memory-tree">
          {children.map((child) => (
            <MemoryFileNode key={child.path} {...props} depth={props.depth + 1} file={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MemorySearchTab(props: {
  actionState: ActionState;
  query: string;
  response: DeckGoMemorySearchResponse | null;
  results: DeckGoMemorySearchResult[];
  scope: DeckGoMemorySearchScope;
  selectedAgent?: DeckGoAgentSummary;
  selectedAgentId: string;
  t: ReturnType<typeof useTranslations>;
  onClear: () => void;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: DeckGoMemorySearchScope) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="memory-search" aria-label={props.t("searchTab")}>
      <form
        className="memory-search__form"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <label className="memory-search__input">
          <IconSearch />
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={props.t("searchMemoryPlaceholder")}
          />
          {props.query ? (
            <button type="button" onClick={props.onClear} aria-label={props.t("clearSearch")}>
              <IconX />
            </button>
          ) : null}
        </label>
        <div className="memory-search__scope" role="group" aria-label={props.t("scope")}>
          {(["all", "global", "agent"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              className={`memory-scope-button ${props.scope === scope ? "is-active" : ""}`}
              onClick={() => props.onScopeChange(scope)}
            >
              {scope === "all"
                ? props.t("scopeAll")
                : scope === "global"
                  ? props.t("scopeGlobalValue")
                  : props.t("scopeAgentValue")}
            </button>
          ))}
        </div>
        <button
          className="memory-button is-primary"
          type="submit"
          disabled={!props.query.trim() || props.actionState === "search"}
        >
          {props.actionState === "search" ? props.t("searching") : props.t("searchMemory")}
        </button>
      </form>

      {props.scope === "agent" ? (
        <p className="memory-note">
          <AgentLabel agent={props.selectedAgent} fallback={props.selectedAgentId} />
        </p>
      ) : null}

      {!props.response ? (
        <div className="memory-empty is-panel">
          <IconSearch />
          <p>{props.t("searchEmptyDescription")}</p>
        </div>
      ) : (
        <>
          <div className="memory-search__results-head">
            <span>
              {props.t("searchResultCount", { count: props.results.length, scope: props.scope })}
            </span>
            {props.response.lanceDbEnabled === false ? (
              <span className="memory-warning-pill">
                <IconAlert />
                {props.response.unavailableReason || props.t("lancedbDisabled")}
              </span>
            ) : null}
          </div>
          {props.results.length === 0 ? (
            <div className="memory-empty is-panel">
              <p>{props.t("noSearchResultsLoaded")}</p>
            </div>
          ) : (
            <ul className="memory-search__list">
              {props.results.map((result, index) => (
                <li key={`${result.path}-${index}`} className="memory-search__row">
                  <header>
                    <code>{displayMemoryPath(result.path)}</code>
                    <RelevanceBar value={result.relevance} />
                  </header>
                  <p>{result.content}</p>
                  <footer>
                    <span className="memory-pill">{result.tier || props.t("tierWorking")}</span>
                    <span className="memory-pill">{result.scope || props.t("scopeAll")}</span>
                    <DecayBar value={result.decayScore} />
                  </footer>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function MemoryHealthTab(props: {
  actionState: ActionState;
  entries: DeckGoMemoryHealthEntry[];
  response: DeckGoMemoryHealthResponse | null;
  t: ReturnType<typeof useTranslations>;
  onRefresh: () => void;
}) {
  const ok = props.entries.filter((entry) => entry.embeddingStatus === "ok").length;
  const err = props.entries.filter((entry) => entry.embeddingStatus === "error").length;
  const unknown = props.entries.filter((entry) => entry.embeddingStatus === "unknown").length;
  return (
    <section className="memory-health" aria-label={props.t("health")}>
      <header className="memory-section-head">
        <div>
          <h3>{props.t("health")}</h3>
          <p>{props.t("healthLaneDescription")}</p>
        </div>
        <button className="memory-button" type="button" onClick={props.onRefresh}>
          <IconRefresh />
          {props.actionState === "health" ? props.t("loading") : props.t("refresh")}
        </button>
      </header>
      <div className="memory-health__summary">
        <MemoryKpi
          label={props.t("lanceDb")}
          value={props.response?.lanceDbEnabled ? props.t("enabled") : props.t("off")}
          tone={props.response?.lanceDbEnabled ? "ok" : "warn"}
        />
        <MemoryKpi label={props.t("entries")} value={props.entries.length} />
        <MemoryKpi label="ok" value={ok} tone="ok" />
        <MemoryKpi label="error" value={err} tone={err > 0 ? "err" : "neutral"} />
        <MemoryKpi label={props.t("unknown")} value={unknown} />
      </div>
      {props.entries.length === 0 ? (
        <div className="memory-empty is-panel">{props.t("noHealthEntries")}</div>
      ) : (
        <table className="memory-health__table">
          <thead>
            <tr>
              <th>{props.t("agent")}</th>
              <th>{props.t("provider")}</th>
              <th>{props.t("status")}</th>
              <th>{props.t("content")}</th>
            </tr>
          </thead>
          <tbody>
            {props.entries.map((entry, index) => (
              <tr key={`${entry.agentId}-${entry.provider}-${index}`}>
                <td>{entry.agentId || props.t("na")}</td>
                <td>
                  <code>{entry.provider || props.t("na")}</code>
                </td>
                <td>
                  <span className="memory-health__status">
                    <StatusDot status={entry.embeddingStatus} />
                    {entry.embeddingStatus}
                  </span>
                </td>
                <td>{entry.error || props.t("healthy")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <JsonDetails title={props.t("rawHealthResponse")} payload={props.response} />
    </section>
  );
}

function MemoryKpi(props: {
  label: string;
  value: string | number;
  tone?: "neutral" | "ok" | "warn" | "err";
}) {
  return (
    <div className={`memory-kpi ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function MemoryDreamsTab(props: {
  actionState: ActionState;
  activeAgent?: DeckGoAgentSummary;
  activeAgentId: string;
  agents: DeckGoAgentSummary[];
  diary: DeckGoMemoryDreamDiaryResult | null;
  pendingAction: PendingDreamAction | null;
  result: DeckGoMemoryDreamsResult | null;
  t: ReturnType<typeof useTranslations>;
  onAgentChange: (agentId: string) => void;
  onCancelPending: () => void;
  onConfirmPending: (action: DeckGoMemoryDreamAction) => void;
  onRunAction: (action: DeckGoMemoryDreamAction) => void;
}) {
  const resultEntries = isDreamActionResult(props.result) ? dreamResultEntries(props.result) : [];
  const pendingAction = props.pendingAction;
  const actions: Array<{ id: DeckGoMemoryDreamAction; label: string; danger?: boolean }> = [
    { id: "read", label: props.t("dreamRead") },
    { id: "backfill", label: props.t("dreamBackfill") },
    { id: "dedupe", label: props.t("dreamDedupe") },
    { id: "repair", label: props.t("dreamRepair") },
    { id: "resetShortTerm", label: props.t("dreamResetShortTerm"), danger: true },
    { id: "reset", label: props.t("dreamReset"), danger: true },
  ];
  return (
    <section className="memory-dreams" aria-label={props.t("dreams.tab")}>
      <aside className="memory-dreams__side">
        <h3>{props.t("dreams.agent")}</h3>
        <ul className="memory-dreams__agents">
          {(props.agents.length > 0
            ? props.agents
            : [{ id: props.activeAgentId, name: props.activeAgentId }]
          ).map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                className={`memory-dreams__agent ${props.activeAgentId === agent.id ? "is-active" : ""}`}
                onClick={() => props.onAgentChange(agent.id)}
              >
                <AgentLabel agent={agent} fallback={agent.id} />
                <span>
                  {props.diary?.agentId === agent.id && props.diary.found
                    ? props.t("found")
                    : props.t("unknown")}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <h3>{props.t("dreams.actions")}</h3>
        <div className="memory-dreams__actions">
          {actions.map((action) => (
            <button
              key={action.id}
              className={`memory-dreams__action ${action.danger ? "is-danger" : ""}`}
              type="button"
              disabled={props.actionState === "dreams"}
              onClick={() => props.onRunAction(action.id)}
            >
              {action.danger ? <IconTrash /> : <IconCheck />}
              {action.label}
            </button>
          ))}
        </div>
      </aside>

      <article className="memory-dreams__main">
        <header className="memory-section-head">
          <div>
            <h3>{props.t("dreams.title")}</h3>
            <p>{props.diary?.path || props.t("dreamDiaryUnread")}</p>
          </div>
          <span className="memory-pill">
            <AgentLabel agent={props.activeAgent} fallback={props.activeAgentId} />
          </span>
        </header>

        {pendingAction ? (
          <div className="memory-confirm" role="alert">
            <IconAlert />
            <div>
              <strong>{props.t("confirmDreamAction", { action: pendingAction.label })}</strong>
              <p>{pendingAction.hint}</p>
            </div>
            <button
              className="memory-button is-danger"
              type="button"
              onClick={() => props.onConfirmPending(pendingAction.id)}
            >
              {props.t("dreams.yes")}
            </button>
            <button className="memory-button" type="button" onClick={props.onCancelPending}>
              {props.t("dreams.no")}
            </button>
          </div>
        ) : null}

        {isDreamActionResult(props.result) ? (
          <div className="memory-action-result">
            <h4>{props.t("dreamActionResult")}</h4>
            <p>
              {props.t("dreamActionMeta", {
                action: props.result.action,
                agentId: props.result.agentId || props.activeAgentId,
              })}
            </p>
            {resultEntries.length > 0 ? (
              <dl>
                {resultEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        <div className="memory-dreams__diary">
          {props.actionState === "dreams" && !props.diary ? (
            <p className="memory-empty">{props.t("dreams.loading")}</p>
          ) : props.diary?.content ? (
            <Markdown content={props.diary.content} className="memory-markdown" />
          ) : (
            <div className="memory-empty is-centered">
              <IconInfo />
              <p>
                {props.diary?.found === false
                  ? props.t("notFound")
                  : props.t("noDreamDiaryContent")}
              </p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

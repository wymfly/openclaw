import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  createAgent,
  deleteAgent,
  fetchAgentDetail,
  fetchAgentEventStreams,
  fetchAgentFile,
  fetchAgentFiles,
  fetchAgentSkills,
  fetchAgentSubagentConfig,
  fetchAgentSystemPromptPreview,
  fetchAgentToolPolicyPreview,
  normalizeAgentSubagentPermissionOptions,
  saveAgentFile,
  streamEvents,
  updateAgent,
  updateAgentEventStreams,
  updateAgentSkills,
  updateAgentSubagentConfig,
  type DeckGoAgentDetailResponse,
  type DeckGoAgentEventStreamsResponse,
  type DeckGoAgentFile,
  type DeckGoAgentSkillsResponse,
  type DeckGoAgentSubagentConfigResponse,
  type DeckGoAgentSubagentPermissionOption,
  type DeckGoAgentSystemPromptPreviewResponse,
  type DeckGoAgentToolPolicyPreviewResponse,
} from "@/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Input,
  Modal,
  SegmentedControl,
  Spinner,
  Textarea,
  Toggle,
} from "@/design-system/atoms";
import { useAgentsStore, type Agent } from "@/stores/agents";
import {
  AGENT_SECTIONS,
  buildAgentPatch,
  buildCreateAgentRequest,
  formatAgentError,
  formatMaybeCount,
  hasOverviewChanges,
  initialCreateDraft,
  isConflictError,
  nextSectionId,
  overviewDraftFromAgent,
  readSectionFromHash,
  validateCreateStep,
  type AgentSectionId,
  type AgentsFilter,
  type AgentsSort,
  type CreateAgentDraft,
  type OverviewDraft,
} from "./agents-panel-state";
import "./agents-panel.css";

const STREAM_OPTIONS = [
  "agent.status.changed",
  "activity.event",
  "session.message",
  "session.tool",
  "sessions.changed",
];

function readAgentParam(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("agent");
}

function writeAgentParam(agentId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "agents");
  if (agentId) {
    url.searchParams.set("agent", agentId);
  } else {
    url.searchParams.delete("agent");
    url.hash = "";
  }
  window.history.pushState({ panel: "agents", agentId }, "", url);
}

function statusVariant(status: Agent["status"]) {
  if (status === "busy") {
    return "running";
  }
  if (status === "error" || status === "offline") {
    return "err";
  }
  return "neutral";
}

function agentInitial(agent: Agent): string {
  return agent.emoji || agent.name.slice(0, 1).toUpperCase() || agent.id.slice(0, 1).toUpperCase();
}

function matchesFilter(agent: Agent, filter: AgentsFilter): boolean {
  if (filter === "busy") {
    return agent.status === "busy";
  }
  if (filter === "default") {
    return Boolean(agent.isDefault);
  }
  return true;
}

function lastActive(agent: Agent): number {
  return agent.lastActiveAtMs ?? 0;
}

function sortAgents(agents: Agent[], sort: AgentsSort) {
  const next = [...agents];
  next.sort((left, right) => {
    if (sort === "name") {
      return left.name.localeCompare(right.name);
    }
    if (sort === "sessions") {
      return (right.sessionCount ?? -1) - (left.sessionCount ?? -1);
    }
    return lastActive(right) - lastActive(left);
  });
  return next;
}

export function AgentsPanel() {
  const t = useTranslations("agentsPanel");
  const list = useAgentsStore((state) => state.agents);
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const status = useAgentsStore((state) => state.status);
  const error = useAgentsStore((state) => state.error);
  const loadAgents = useAgentsStore((state) => state.loadAgents);
  const selectAgent = useAgentsStore((state) => state.selectAgent);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentsFilter>("all");
  const [sort, setSort] = useState<AgentsSort>("name");
  const [streamStatus, setStreamStatus] = useState("connecting");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (status === "idle") {
      void loadAgents();
    }
  }, [loadAgents, status]);

  useEffect(() => {
    const requestedAgentId = readAgentParam();
    if (requestedAgentId) {
      selectAgent(requestedAgentId);
    }
    const handlePopState = () => selectAgent(readAgentParam());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectAgent]);

  useEffect(() => {
    const controller = new AbortController();
    void streamEvents({
      signal: controller.signal,
      onEvent: (event) => useAgentsStore.getState().applyServerEvent(event),
      onStatusChange: setStreamStatus,
      retryDelayMs: 2000,
    }).catch(() => {
      if (!controller.signal.aborted) {
        setStreamStatus("error");
      }
    });
    return () => controller.abort();
  }, []);

  const visibleAgents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = list.filter((agent) => {
      const searchable = `${agent.name} ${agent.id} ${agent.model ?? ""} ${agent.workspace ?? ""}`;
      return searchable.toLowerCase().includes(query) && matchesFilter(agent, filter);
    });
    return sortAgents(filtered, sort);
  }, [filter, list, search, sort]);

  const selectedAgent = list.find((agent) => agent.id === selectedAgentId) ?? null;
  const metrics = useMemo(() => {
    const busy = list.filter((agent) => agent.status === "busy").length;
    const defaultAgent = list.find((agent) => agent.isDefault);
    const sessions = list.reduce(
      (total, agent) =>
        total + (Number.isFinite(agent.sessionCount) ? (agent.sessionCount ?? 0) : 0),
      0,
    );
    const bindings = list.reduce(
      (total, agent) =>
        total + (Number.isFinite(agent.bindingCount) ? (agent.bindingCount ?? 0) : 0),
      0,
    );
    return {
      bindings,
      busy,
      defaultAgent: defaultAgent?.id ?? "-",
      sessions,
      total: list.length,
    };
  }, [list]);

  const openAgent = useCallback(
    (agentId: string) => {
      selectAgent(agentId);
      writeAgentParam(agentId);
      window.location.hash = window.location.hash || "#overview";
    },
    [selectAgent],
  );

  const returnToList = useCallback(() => {
    selectAgent(null);
    writeAgentParam(null);
  }, [selectAgent]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && key === "n") {
        event.preventDefault();
        setCreateOpen(true);
        return;
      }
      if (!selectedAgent && (event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!selectedAgent && !isTextInput && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!selectedAgent && !isTextInput && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setFilter((["all", "busy", "default"] as AgentsFilter[])[Number(event.key) - 1] ?? "all");
      }
      if (selectedAgent && event.key === "Escape" && !createOpen && !deleteTarget) {
        event.preventDefault();
        returnToList();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, deleteTarget, returnToList, selectedAgent]);

  const focusRow = (index: number) => {
    const clamped = Math.max(0, Math.min(visibleAgents.length - 1, index));
    rowRefs.current[clamped]?.focus();
  };

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(index - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const agent = visibleAgents[index];
      if (agent) {
        openAgent(agent.id);
      }
    }
  };

  return (
    <section className="agents-panel" aria-label={t("title")} data-agents-workbench="true">
      <div className="agents-panel__toolbar">
        <div>
          <p className="agents-panel__eyebrow">{t("eyebrow")}</p>
          <h2>{t("title")}</h2>
          <p>{t("subtitle")}</p>
        </div>
        <div className="agents-panel__toolbar-actions">
          <Badge variant={streamStatus === "connected" ? "ok" : "neutral"}>
            {t(`stream.${streamStatus}`)}
          </Badge>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            {t("create.open")}
          </Button>
        </div>
      </div>

      <div className="agents-panel__metrics" aria-label={t("metrics.label")}>
        <MetricTile label={t("metrics.total")} value={String(metrics.total)} />
        <MetricTile label={t("metrics.busy")} value={String(metrics.busy)} />
        <MetricTile label={t("metrics.default")} value={metrics.defaultAgent} />
        <MetricTile label={t("metrics.sessions")} value={String(metrics.sessions)} />
        <MetricTile label={t("metrics.bindings")} value={String(metrics.bindings)} />
      </div>

      <div className="agents-workbench">
        <Card className="agents-panel__list-card agents-list-card" padded={false}>
          <div className="agents-panel__filters">
            <Input
              ref={searchRef}
              value={search}
              aria-label={t("searchLabel")}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <SegmentedControl<AgentsFilter>
              aria-label={t("filterLabel")}
              value={filter}
              onChange={setFilter}
              items={[
                { value: "all", label: t("filters.all") },
                { value: "busy", label: t("filters.busy") },
                { value: "default", label: t("filters.default") },
              ]}
            />
            <SegmentedControl<AgentsSort>
              aria-label={t("sortLabel")}
              value={sort}
              onChange={setSort}
              items={[
                { value: "name", label: t("sort.name") },
                { value: "recent", label: t("sort.recent") },
                { value: "sessions", label: t("sort.sessions") },
              ]}
            />
          </div>

          {status === "loading" ? <LoadingRows label={t("loading")} /> : null}
          {status === "error" ? (
            <Banner variant="error">
              <strong>{t("errors.listTitle")}</strong>
              <span>{error}</span>
              <Button size="sm" onClick={() => void loadAgents()}>
                {t("retry")}
              </Button>
            </Banner>
          ) : null}
          {status === "ready" && visibleAgents.length === 0 ? (
            <div className="agents-panel__empty" role="status">
              <h3>{search ? t("empty.noSearchTitle") : t("empty.noAgentsTitle")}</h3>
              <p>{search ? t("empty.noSearchBody", { query: search }) : t("empty.noAgentsBody")}</p>
              {search ? (
                <Button onClick={() => setSearch("")}>{t("empty.clearSearch")}</Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  {t("create.open")}
                </Button>
              )}
            </div>
          ) : null}

          {visibleAgents.length > 0 ? (
            <div className="agents-table" role="table" aria-label={t("tableLabel")}>
              <div className="agents-table__head" role="row">
                <span role="columnheader">{t("columns.agent")}</span>
                <span role="columnheader">{t("columns.status")}</span>
                <span role="columnheader">{t("columns.sessions")}</span>
                <span role="columnheader">{t("columns.bindings")}</span>
              </div>
              {visibleAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  ref={(node) => {
                    rowRefs.current[index] = node;
                  }}
                  role="row"
                  tabIndex={0}
                  className={
                    selectedAgentId === agent.id
                      ? "agents-table__row agents-table__row--selected"
                      : "agents-table__row"
                  }
                  aria-selected={selectedAgentId === agent.id}
                  onClick={() => openAgent(agent.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                >
                  <span className="agent-cell" role="cell">
                    <span className="agent-avatar" aria-hidden="true">
                      {agentInitial(agent)}
                    </span>
                    <span>
                      <strong>{agent.name}</strong>
                      <small>
                        {agent.id}
                        {agent.workspace ? ` / ${agent.workspace}` : ""}
                      </small>
                    </span>
                    {agent.isDefault ? <Badge variant="ok">{t("defaultBadge")}</Badge> : null}
                  </span>
                  <span role="cell">
                    <StatusBadge agent={agent} />
                  </span>
                  <span role="cell">{formatMaybeCount(agent.sessionCount)}</span>
                  <span role="cell">{formatMaybeCount(agent.bindingCount)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>

        {selectedAgent ? (
          <AgentDetailView
            agent={selectedAgent}
            onBack={returnToList}
            onDelete={() => setDeleteTarget(selectedAgent)}
          />
        ) : (
          <div className="agents-detail-placeholder" role="status">
            <h3>{t("detailPlaceholder.title")}</h3>
            <p>{t("detailPlaceholder.body")}</p>
          </div>
        )}
      </div>

      <CreateAgentWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={openAgent}
      />
      <ConfirmDelete
        agent={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onDeleted={(fallbackId) => {
          setDeleteTarget(null);
          if (fallbackId) {
            openAgent(fallbackId);
          } else {
            returnToList();
          }
        }}
      />
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ agent }: { agent: Agent }) {
  const t = useTranslations("agentsPanel");
  return (
    <Badge variant={statusVariant(agent.status)}>
      <span
        className={`agent-status-dot agent-status-dot--${agent.status}`.trim()}
        role="img"
        aria-label={t("statusLabel", { status: t(`status.${agent.status}`) })}
      />
      {t(`status.${agent.status}`)}
    </Badge>
  );
}

function LoadingRows({ label }: { label: string }) {
  return (
    <div className="agents-panel__loading" role="status" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="agents-panel__skeleton" />
      ))}
    </div>
  );
}

function AgentDetailView({
  agent,
  onBack,
  onDelete,
}: {
  agent: Agent;
  onBack: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("agentsPanel");
  const [section, setSection] = useState<AgentSectionId>(() =>
    readSectionFromHash(window.location.hash),
  );
  const [detail, setDetail] = useState<DeckGoAgentDetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() =>
    overviewDraftFromAgent(agent),
  );
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [skills, setSkills] = useState<DeckGoAgentSkillsResponse | null>(null);
  const [skillsDraft, setSkillsDraft] = useState<{ mode: string; skills: string[] } | null>(null);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsConflict, setSkillsConflict] = useState(false);

  const [subagents, setSubagents] = useState<DeckGoAgentSubagentConfigResponse | null>(null);
  const [subagentRows, setSubagentRows] = useState<DeckGoAgentSubagentPermissionOption[]>([]);
  const [subagentModel, setSubagentModel] = useState("");
  const [subagentSaving, setSubagentSaving] = useState(false);
  const [subagentError, setSubagentError] = useState<string | null>(null);
  const [subagentConflict, setSubagentConflict] = useState(false);

  const [streams, setStreams] = useState<DeckGoAgentEventStreamsResponse | null>(null);
  const [streamDraft, setStreamDraft] = useState<string[]>([]);
  const [streamSaving, setStreamSaving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamConflict, setStreamConflict] = useState(false);

  const [toolPolicy, setToolPolicy] = useState<DeckGoAgentToolPolicyPreviewResponse | null>(null);
  const [toolPolicyError, setToolPolicyError] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState<DeckGoAgentSystemPromptPreviewResponse | null>(
    null,
  );
  const [systemPromptError, setSystemPromptError] = useState<string | null>(null);

  const [files, setFiles] = useState<DeckGoAgentFile[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileDirty, setFileDirty] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const overviewDirty = hasOverviewChanges(agent, overviewDraft);
  const skillsDirty =
    Boolean(skillsDraft && skills) &&
    (skillsDraft?.mode !== skills?.mode ||
      skillsDraft?.skills.join("\n") !== skills?.skills.join("\n"));
  const subagentsDirty =
    Boolean(subagents) &&
    (subagentRows
      .filter((row) => row.allowed)
      .map((row) => row.id)
      .toSorted()
      .join("\n") !== [...(subagents?.allowAgents ?? [])].toSorted().join("\n") ||
      subagentModel !== (subagents?.model ?? ""));
  const streamsDirty = streams
    ? [...streamDraft].toSorted().join("\n") !== [...streams.eventStreams].toSorted().join("\n")
    : false;
  const dirtySections = [
    overviewDirty ? t("sections.overview") : "",
    skillsDirty ? t("sections.skills") : "",
    subagentsDirty ? t("sections.subagents") : "",
    streamsDirty ? t("sections.eventStreams") : "",
    fileDirty ? t("sections.files") : "",
  ].filter(Boolean);

  const changeSection = useCallback((next: AgentSectionId) => {
    setSection(next);
    window.location.hash = next;
  }, []);

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      setDetail(await fetchAgentDetail(agent.id));
    } catch (error) {
      setDetailError(formatAgentError(error));
    } finally {
      setDetailLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    setOverviewDraft(overviewDraftFromAgent(agent));
    setDetail(null);
    setSkills(null);
    setSkillsDraft(null);
    setSubagents(null);
    setSubagentRows([]);
    setStreams(null);
    setToolPolicy(null);
    setSystemPrompt(null);
    setFiles(null);
    setFileName("");
    setFileContent("");
    setFileDirty(false);
    void loadDetail();
  }, [agent, loadDetail]);

  useEffect(() => {
    const handleHash = () => setSection(readSectionFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const reloadSkills = useCallback(async () => {
    setSkillsError(null);
    setSkillsConflict(false);
    try {
      const response = await fetchAgentSkills(agent.id);
      setSkills(response);
      setSkillsDraft({ mode: response.mode, skills: response.skills });
    } catch (error) {
      setSkillsError(formatAgentError(error));
    }
  }, [agent.id]);

  const reloadSubagents = useCallback(async () => {
    setSubagentError(null);
    setSubagentConflict(false);
    try {
      const response = await fetchAgentSubagentConfig(agent.id);
      setSubagents(response);
      setSubagentRows(normalizeAgentSubagentPermissionOptions(response));
      setSubagentModel(response.model ?? "");
    } catch (error) {
      setSubagentError(formatAgentError(error));
    }
  }, [agent.id]);

  const reloadStreams = useCallback(async () => {
    setStreamError(null);
    setStreamConflict(false);
    try {
      const response = await fetchAgentEventStreams(agent.id);
      setStreams(response);
      setStreamDraft(response.eventStreams);
    } catch (error) {
      setStreamError(formatAgentError(error));
    }
  }, [agent.id]);

  const reloadToolPolicy = useCallback(async () => {
    setToolPolicyError(null);
    try {
      setToolPolicy(await fetchAgentToolPolicyPreview(agent.id));
    } catch (error) {
      setToolPolicyError(formatAgentError(error));
    }
  }, [agent.id]);

  const reloadSystemPrompt = useCallback(async () => {
    setSystemPromptError(null);
    try {
      setSystemPrompt(await fetchAgentSystemPromptPreview(agent.id));
    } catch (error) {
      setSystemPromptError(formatAgentError(error));
    }
  }, [agent.id]);

  const reloadFiles = useCallback(async () => {
    setFileError(null);
    try {
      const response = await fetchAgentFiles(agent.id);
      setFiles(response.files);
    } catch (error) {
      setFileError(formatAgentError(error));
    }
  }, [agent.id]);

  useEffect(() => {
    if (section === "skills" && !skills && !skillsError) {
      void reloadSkills();
    } else if (section === "subagents" && !subagents && !subagentError) {
      void reloadSubagents();
    } else if (section === "event-streams" && !streams && !streamError) {
      void reloadStreams();
    } else if (section === "tool-policy" && !toolPolicy && !toolPolicyError) {
      void reloadToolPolicy();
    } else if (section === "system-prompt" && !systemPrompt && !systemPromptError) {
      void reloadSystemPrompt();
    } else if (section === "files" && !files && !fileError) {
      void reloadFiles();
    }
  }, [
    fileError,
    files,
    reloadFiles,
    reloadSkills,
    reloadStreams,
    reloadSubagents,
    reloadSystemPrompt,
    reloadToolPolicy,
    section,
    skills,
    skillsError,
    streamError,
    streams,
    subagentError,
    subagents,
    systemPrompt,
    systemPromptError,
    toolPolicy,
    toolPolicyError,
  ]);

  const saveOverview = useCallback(async () => {
    if (!overviewDirty) {
      return;
    }
    setOverviewSaving(true);
    setOverviewError(null);
    try {
      await updateAgent(agent.id, buildAgentPatch(agent, overviewDraft));
      await useAgentsStore.getState().refreshAgents();
      await loadDetail();
    } catch (error) {
      setOverviewError(formatAgentError(error));
    } finally {
      setOverviewSaving(false);
    }
  }, [agent, loadDetail, overviewDirty, overviewDraft]);

  const saveSkills = useCallback(async () => {
    if (!skills || !skillsDraft) {
      return;
    }
    setSkillsSaving(true);
    setSkillsError(null);
    setSkillsConflict(false);
    try {
      const response = await updateAgentSkills(agent.id, {
        mode: skillsDraft.mode === "whitelist" ? "whitelist" : "all",
        skills: skillsDraft.skills,
        baseHash: skills.configHash,
      });
      setSkills({
        ...skills,
        mode: response.mode ?? skillsDraft.mode,
        skills: response.skills ?? skillsDraft.skills,
        configHash: response.configHash ?? skills.configHash,
      });
    } catch (error) {
      setSkillsConflict(isConflictError(error));
      setSkillsError(formatAgentError(error));
    } finally {
      setSkillsSaving(false);
    }
  }, [agent.id, skills, skillsDraft]);

  const saveSubagents = useCallback(async () => {
    if (!subagents) {
      return;
    }
    setSubagentSaving(true);
    setSubagentError(null);
    setSubagentConflict(false);
    try {
      const allowAgents = subagentRows.filter((row) => row.allowed).map((row) => row.id);
      const response = await updateAgentSubagentConfig(agent.id, {
        allowAgents,
        model: subagentModel.trim() || undefined,
        baseHash: subagents.configHash,
      });
      setSubagents({
        ...subagents,
        allowAgents: response.allowAgents ?? allowAgents,
        model: response.model ?? subagentModel,
        configHash: response.configHash ?? subagents.configHash,
      });
      setSubagentRows((rows) =>
        rows.map((row) => ({ ...row, allowed: allowAgents.includes(row.id) })),
      );
    } catch (error) {
      setSubagentConflict(isConflictError(error));
      setSubagentError(formatAgentError(error));
    } finally {
      setSubagentSaving(false);
    }
  }, [agent.id, subagentModel, subagentRows, subagents]);

  const saveStreams = useCallback(async () => {
    if (!streams) {
      return;
    }
    setStreamSaving(true);
    setStreamError(null);
    setStreamConflict(false);
    try {
      const response = await updateAgentEventStreams(agent.id, streamDraft, streams.configHash);
      setStreams({
        ...streams,
        eventStreams: response.eventStreams ?? streamDraft,
        configHash: response.configHash ?? streams.configHash,
      });
    } catch (error) {
      setStreamConflict(isConflictError(error));
      setStreamError(formatAgentError(error));
    } finally {
      setStreamSaving(false);
    }
  }, [agent.id, streamDraft, streams]);

  const openFile = useCallback(
    async (name: string) => {
      setFileError(null);
      try {
        const response = await fetchAgentFile(agent.id, name);
        setFileName(response.file.name);
        setFileContent(response.file.content ?? "");
        setFileDirty(false);
      } catch (error) {
        setFileError(formatAgentError(error));
      }
    },
    [agent.id],
  );

  const saveFile = useCallback(async () => {
    if (!fileName.trim()) {
      setFileError(t("errors.fileNameRequired"));
      return;
    }
    setFileSaving(true);
    setFileError(null);
    try {
      await saveAgentFile(agent.id, fileName.trim(), fileContent);
      setFileDirty(false);
      await reloadFiles();
    } catch (error) {
      setFileError(formatAgentError(error));
    } finally {
      setFileSaving(false);
    }
  }, [agent.id, fileContent, fileName, reloadFiles, t]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (section === "overview") {
          void saveOverview();
        } else if (section === "skills") {
          void saveSkills();
        } else if (section === "subagents") {
          void saveSubagents();
        } else if (section === "event-streams") {
          void saveStreams();
        } else if (section === "files") {
          void saveFile();
        }
        return;
      }
      if (!isTextInput && /^[1-7]$/.test(event.key)) {
        event.preventDefault();
        const next = AGENT_SECTIONS[Number(event.key) - 1]?.id;
        if (next) {
          changeSection(next);
        }
        return;
      }
      if (!isTextInput && event.key.toLowerCase() === "j") {
        event.preventDefault();
        changeSection(nextSectionId(section, 1));
      } else if (!isTextInput && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeSection(nextSectionId(section, -1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeSection, saveFile, saveOverview, saveSkills, saveStreams, saveSubagents, section]);

  return (
    <section className="agents-detail" aria-label={t("detailLabel", { name: agent.name })}>
      <aside className="agents-detail__nav" aria-label={t("sectionNavLabel")}>
        <Button size="sm" variant="ghost" onClick={onBack}>
          {t("backToList")}
        </Button>
        <div className="agents-detail__identity">
          <span className="agent-avatar agent-avatar--large" aria-hidden="true">
            {agentInitial(agent)}
          </span>
          <div>
            <h2>{agent.name}</h2>
            <p>{agent.id}</p>
          </div>
          <StatusBadge agent={agent} />
        </div>
        <nav className="agents-detail__sections" aria-label={t("sectionNavLabel")}>
          {AGENT_SECTIONS.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              role="link"
              aria-current={entry.id === section ? "page" : undefined}
              className={
                entry.id === section
                  ? "agents-detail__section agents-detail__section--active"
                  : "agents-detail__section"
              }
              onClick={() => changeSection(entry.id)}
            >
              <span>{t(entry.labelKey)}</span>
              <small>{index + 1}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="agents-detail__main">
        {dirtySections.length > 0 ? (
          <Banner variant="info">{t("dirtyBanner", { sections: dirtySections.join(", ") })}</Banner>
        ) : null}
        {detailLoading ? (
          <Banner>
            <Spinner size="sm" aria-label={t("loading")} />
            {t("loading")}
          </Banner>
        ) : null}
        {detailError ? (
          <Banner variant="error">
            <strong>{t("errors.detailTitle")}</strong>
            <span>{detailError}</span>
            <Button size="sm" onClick={() => void loadDetail()}>
              {t("retry")}
            </Button>
          </Banner>
        ) : null}

        {section === "overview" ? (
          <OverviewSection
            agent={agent}
            detail={detail}
            draft={overviewDraft}
            dirty={overviewDirty}
            saving={overviewSaving}
            error={overviewError}
            onDraftChange={setOverviewDraft}
            onSave={saveOverview}
            onDelete={onDelete}
          />
        ) : null}
        {section === "skills" ? (
          <SkillsSection
            data={skills}
            draft={skillsDraft}
            dirty={skillsDirty}
            saving={skillsSaving}
            error={skillsError}
            conflict={skillsConflict}
            onReload={reloadSkills}
            onDraftChange={setSkillsDraft}
            onSave={saveSkills}
          />
        ) : null}
        {section === "subagents" ? (
          <SubagentsSection
            rows={subagentRows}
            model={subagentModel}
            loaded={Boolean(subagents)}
            dirty={subagentsDirty}
            saving={subagentSaving}
            error={subagentError}
            conflict={subagentConflict}
            onReload={reloadSubagents}
            onRowsChange={setSubagentRows}
            onModelChange={setSubagentModel}
            onSave={saveSubagents}
          />
        ) : null}
        {section === "tool-policy" ? (
          <ToolPolicySection
            preview={toolPolicy}
            error={toolPolicyError}
            onReload={reloadToolPolicy}
          />
        ) : null}
        {section === "system-prompt" ? (
          <SystemPromptSection
            preview={systemPrompt}
            error={systemPromptError}
            onReload={reloadSystemPrompt}
          />
        ) : null}
        {section === "files" ? (
          <FilesSection
            files={files}
            fileName={fileName}
            content={fileContent}
            dirty={fileDirty}
            saving={fileSaving}
            error={fileError}
            onReload={reloadFiles}
            onOpen={openFile}
            onFileNameChange={setFileName}
            onContentChange={(next) => {
              setFileContent(next);
              setFileDirty(true);
            }}
            onSave={saveFile}
          />
        ) : null}
        {section === "event-streams" ? (
          <StreamsSection
            data={streams}
            draft={streamDraft}
            dirty={streamsDirty}
            saving={streamSaving}
            error={streamError}
            conflict={streamConflict}
            onReload={reloadStreams}
            onDraftChange={setStreamDraft}
            onSave={saveStreams}
          />
        ) : null}
      </main>
    </section>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="agent-section" padded>
      <header className="agent-section__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </Card>
  );
}

function OverviewSection({
  agent,
  detail,
  draft,
  dirty,
  saving,
  error,
  onDraftChange,
  onSave,
  onDelete,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
  draft: OverviewDraft;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onDraftChange: (draft: OverviewDraft) => void;
  onSave: () => Promise<void>;
  onDelete: () => void;
}) {
  const t = useTranslations("agentsPanel");
  const update = (patch: Partial<OverviewDraft>) => onDraftChange({ ...draft, ...patch });
  return (
    <SectionCard title={t("sections.overview")} description={t("overview.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      <div className="agent-form-grid">
        <label>
          <span>{t("fields.name")}</span>
          <Input value={draft.name} onChange={(event) => update({ name: event.target.value })} />
        </label>
        <label>
          <span>{t("fields.model")}</span>
          <Input value={draft.model} onChange={(event) => update({ model: event.target.value })} />
        </label>
        <label>
          <span>{t("fields.workspace")}</span>
          <Input
            value={draft.workspace}
            onChange={(event) => update({ workspace: event.target.value })}
          />
        </label>
        <label>
          <span>{t("fields.emoji")}</span>
          <Input value={draft.emoji} onChange={(event) => update({ emoji: event.target.value })} />
        </label>
        <label>
          <span>{t("fields.avatar")}</span>
          <Input
            value={draft.avatar}
            onChange={(event) => update({ avatar: event.target.value })}
          />
        </label>
      </div>
      <div className="agent-meta-strip">
        <Chip>{t("meta.sessions", { count: formatMaybeCount(agent.sessionCount) })}</Chip>
        <Chip>{t("meta.bindings", { count: formatMaybeCount(agent.bindingCount) })}</Chip>
        <Chip>{t("meta.default", { value: agent.isDefault ? t("yes") : t("no") })}</Chip>
        {detail ? (
          <Chip>{t("meta.activeSubagents", { count: detail.activeSubagentCount })}</Chip>
        ) : null}
      </div>
      <footer className="agent-section__actions">
        <Button variant="danger" onClick={onDelete}>
          {t("delete.open")}
        </Button>
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </footer>
    </SectionCard>
  );
}

function SkillsSection({
  data,
  draft,
  dirty,
  saving,
  error,
  conflict,
  onReload,
  onDraftChange,
  onSave,
}: {
  data: DeckGoAgentSkillsResponse | null;
  draft: { mode: string; skills: string[] } | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  onReload: () => Promise<void>;
  onDraftChange: (draft: { mode: string; skills: string[] }) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  return (
    <SectionCard title={t("sections.skills")} description={t("skills.description")}>
      {error ? (
        <Banner variant={conflict ? "warn" : "error"}>
          <strong>{conflict ? t("errors.conflictTitle") : t("errors.saveTitle")}</strong>
          <span>{error}</span>
          <Button size="sm" onClick={() => void onReload()}>
            {t("reload")}
          </Button>
        </Banner>
      ) : null}
      {!data || !draft ? (
        <LoadingRows label={t("loading")} />
      ) : (
        <>
          <SegmentedControl
            aria-label={t("skills.modeLabel")}
            value={draft.mode === "whitelist" ? "whitelist" : "all"}
            onChange={(mode) => onDraftChange({ ...draft, mode })}
            items={[
              { value: "all", label: t("skills.all") },
              { value: "whitelist", label: t("skills.whitelist") },
            ]}
          />
          <div className="agent-option-list">
            {data.available.length === 0 ? <p>{t("skills.empty")}</p> : null}
            {data.available.map((skill) => {
              const enabled = draft.skills.includes(skill.key);
              return (
                <div key={skill.key} className="agent-option-row">
                  <div>
                    <strong>{skill.name}</strong>
                    <small>{skill.key}</small>
                  </div>
                  <Toggle
                    aria-label={t("skills.toggle", { name: skill.name })}
                    checked={enabled}
                    disabled={!skill.eligible || draft.mode !== "whitelist"}
                    onCheckedChange={(next) => {
                      const skills = next
                        ? [...draft.skills, skill.key]
                        : draft.skills.filter((key) => key !== skill.key);
                      onDraftChange({ ...draft, skills });
                    }}
                  />
                </div>
              );
            })}
          </div>
          <footer className="agent-section__actions">
            <Button disabled={saving} onClick={() => void onReload()}>
              {t("reload")}
            </Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </footer>
        </>
      )}
    </SectionCard>
  );
}

function SubagentsSection({
  rows,
  model,
  loaded,
  dirty,
  saving,
  error,
  conflict,
  onReload,
  onRowsChange,
  onModelChange,
  onSave,
}: {
  rows: DeckGoAgentSubagentPermissionOption[];
  model: string;
  loaded: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  onReload: () => Promise<void>;
  onRowsChange: (rows: DeckGoAgentSubagentPermissionOption[]) => void;
  onModelChange: (model: string) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  return (
    <SectionCard title={t("sections.subagents")} description={t("subagents.description")}>
      {error ? (
        <Banner variant={conflict ? "warn" : "error"}>
          <strong>{conflict ? t("errors.conflictTitle") : t("errors.saveTitle")}</strong>
          <span>{error}</span>
          <Button size="sm" onClick={() => void onReload()}>
            {t("reload")}
          </Button>
        </Banner>
      ) : null}
      {!loaded ? (
        <LoadingRows label={t("loading")} />
      ) : (
        <>
          <label className="agent-field">
            <span>{t("fields.model")}</span>
            <Input value={model} onChange={(event) => onModelChange(event.target.value)} />
          </label>
          <div className="agent-option-list">
            {rows.length === 0 ? <p>{t("subagents.empty")}</p> : null}
            {rows.map((row) => (
              <div key={row.id} className="agent-option-row">
                <div>
                  <strong>{row.name || row.id}</strong>
                  <small>{row.id}</small>
                </div>
                <Toggle
                  aria-label={t("subagents.toggle", { name: row.name || row.id })}
                  checked={row.allowed}
                  onCheckedChange={(allowed) =>
                    onRowsChange(
                      rows.map((entry) => (entry.id === row.id ? { ...entry, allowed } : entry)),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <footer className="agent-section__actions">
            <Button disabled={saving} onClick={() => void onReload()}>
              {t("reload")}
            </Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </footer>
        </>
      )}
    </SectionCard>
  );
}

function StreamsSection({
  data,
  draft,
  dirty,
  saving,
  error,
  conflict,
  onReload,
  onDraftChange,
  onSave,
}: {
  data: DeckGoAgentEventStreamsResponse | null;
  draft: string[];
  dirty: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  onReload: () => Promise<void>;
  onDraftChange: (streams: string[]) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  const options = Array.from(new Set([...STREAM_OPTIONS, ...draft, ...(data?.eventStreams ?? [])]));
  return (
    <SectionCard title={t("sections.eventStreams")} description={t("streams.description")}>
      {error ? (
        <Banner variant={conflict ? "warn" : "error"}>
          <strong>{conflict ? t("errors.conflictTitle") : t("errors.saveTitle")}</strong>
          <span>{error}</span>
          <Button size="sm" onClick={() => void onReload()}>
            {t("reload")}
          </Button>
        </Banner>
      ) : null}
      {!data ? (
        <LoadingRows label={t("loading")} />
      ) : (
        <>
          <div className="agent-option-list">
            {options.map((option) => (
              <div key={option} className="agent-option-row">
                <div>
                  <strong>{option}</strong>
                  <small>{t("streams.optionDescription")}</small>
                </div>
                <Toggle
                  aria-label={t("streams.toggle", { name: option })}
                  checked={draft.includes(option)}
                  onCheckedChange={(checked) =>
                    onDraftChange(
                      checked ? [...draft, option] : draft.filter((entry) => entry !== option),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <footer className="agent-section__actions">
            <Button disabled={saving} onClick={() => void onReload()}>
              {t("reload")}
            </Button>
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </footer>
        </>
      )}
    </SectionCard>
  );
}

function ToolPolicySection({
  preview,
  error,
  onReload,
}: {
  preview: DeckGoAgentToolPolicyPreviewResponse | null;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  return (
    <SectionCard title={t("sections.toolPolicy")} description={t("toolPolicy.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!preview ? <LoadingRows label={t("loading")} /> : null}
      {preview?.layers?.map((layer) => (
        <div key={layer.label} className="agent-preview-row">
          <strong>{layer.label}</strong>
          <span>{t("toolPolicy.layer", { count: layer.ruleCount, effect: layer.effect })}</span>
        </div>
      ))}
      {preview?.tools?.map((tool) => (
        <div key={tool.name} className="agent-preview-row">
          <strong>{tool.name}</strong>
          <Badge variant={tool.allowed ? "ok" : "err"}>
            {tool.allowed ? t("allowed") : t("denied")}
          </Badge>
          {tool.decisiveLayer ? <small>{tool.decisiveLayer}</small> : null}
        </div>
      ))}
      <footer className="agent-section__actions">
        <Button onClick={() => void onReload()}>{t("recompute")}</Button>
      </footer>
    </SectionCard>
  );
}

function SystemPromptSection({
  preview,
  error,
  onReload,
}: {
  preview: DeckGoAgentSystemPromptPreviewResponse | null;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  return (
    <SectionCard title={t("sections.systemPrompt")} description={t("systemPrompt.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!preview ? <LoadingRows label={t("loading")} /> : null}
      {preview ? (
        <div className="agent-prompt-preview">
          <Chip>{t("systemPrompt.totalChars", { count: preview.totalChars ?? 0 })}</Chip>
          {preview.layers?.map((layer) => (
            <div key={`${layer.label}-${layer.source}`} className="agent-preview-row">
              <strong>{layer.label}</strong>
              <span>{layer.source}</span>
              <small>
                {t("systemPrompt.layerMeta", { chars: layer.charCount, files: layer.fileCount })}
              </small>
            </div>
          ))}
          {preview.bootstrapFiles?.map((file) => (
            <div key={file.name} className="agent-preview-row">
              <strong>{file.name}</strong>
              <Badge variant={file.exists ? "ok" : "warn"}>
                {file.exists ? t("exists") : t("missing")}
              </Badge>
              <small>{file.charCount}</small>
            </div>
          ))}
        </div>
      ) : null}
      <footer className="agent-section__actions">
        <Button onClick={() => void onReload()}>{t("recompute")}</Button>
      </footer>
    </SectionCard>
  );
}

function FilesSection({
  files,
  fileName,
  content,
  dirty,
  saving,
  error,
  onReload,
  onOpen,
  onFileNameChange,
  onContentChange,
  onSave,
}: {
  files: DeckGoAgentFile[] | null;
  fileName: string;
  content: string;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onOpen: (name: string) => Promise<void>;
  onFileNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  return (
    <SectionCard title={t("sections.files")} description={t("files.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!files ? <LoadingRows label={t("loading")} /> : null}
      <div className="agent-files-layout">
        <div className="agent-option-list">
          {files?.length === 0 ? <p>{t("files.empty")}</p> : null}
          {files?.map((file) => (
            <button
              key={file.name}
              type="button"
              className="agent-file-row"
              onClick={() => void onOpen(file.name)}
            >
              <strong>{file.name}</strong>
              <small>{formatMaybeCount(file.size)}</small>
            </button>
          ))}
        </div>
        <div className="agent-file-editor">
          <label>
            <span>{t("files.name")}</span>
            <Input
              value={fileName}
              onChange={(event) => onFileNameChange(event.currentTarget.value)}
            />
          </label>
          <Textarea
            value={content}
            rows={12}
            aria-label={t("files.content")}
            onChange={(event) => onContentChange(event.currentTarget.value)}
          />
        </div>
      </div>
      <footer className="agent-section__actions">
        <Button disabled={saving} onClick={() => void onReload()}>
          {t("reload")}
        </Button>
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </footer>
    </SectionCard>
  );
}

function CreateAgentWizard({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (agentId: string) => void;
}) {
  const t = useTranslations("agentsPanel");
  const [draft, setDraft] = useState<CreateAgentDraft>(initialCreateDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setDraft(initialCreateDraft());
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const validationKey = validateCreateStep(draft);
  const update = (patch: Partial<CreateAgentDraft>) => setDraft({ ...draft, ...patch });
  const advance = () => {
    if (validationKey) {
      setError(t(validationKey));
      return;
    }
    setError(null);
    update({ step: Math.min(2, draft.step + 1) as CreateAgentDraft["step"] });
  };
  const submit = async () => {
    if (validationKey) {
      setError(t(validationKey));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await createAgent(buildCreateAgentRequest(draft));
      await useAgentsStore.getState().refreshAgents();
      onClose();
      onCreated(response.id ?? draft.name.trim());
    } catch (submitError) {
      setError(formatAgentError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      aria-labelledby="agent-create-title"
      aria-describedby="agent-create-description"
    >
      <div className="agent-modal">
        <header>
          <h2 id="agent-create-title">{t("create.title")}</h2>
          <p id="agent-create-description">{t("create.description")}</p>
        </header>
        <div className="agent-wizard-steps" aria-label={t("create.stepsLabel")}>
          {[0, 1, 2].map((step) => (
            <Chip key={step} active={draft.step === step}>
              {t(`create.step${step}`)}
            </Chip>
          ))}
        </div>
        {error ? <Banner variant="error">{error}</Banner> : null}
        {draft.step === 0 ? (
          <div className="agent-form-grid">
            <label>
              <span>{t("fields.name")}</span>
              <Input
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
              />
            </label>
            <label>
              <span>{t("fields.emoji")}</span>
              <Input
                value={draft.emoji}
                onChange={(event) => update({ emoji: event.target.value })}
              />
            </label>
            <label>
              <span>{t("fields.avatar")}</span>
              <Input
                value={draft.avatar}
                onChange={(event) => update({ avatar: event.target.value })}
              />
            </label>
          </div>
        ) : null}
        {draft.step === 1 ? (
          <div className="agent-form-grid">
            <label>
              <span>{t("fields.workspace")}</span>
              <Input
                value={draft.workspace}
                onChange={(event) => update({ workspace: event.target.value })}
              />
            </label>
            <label>
              <span>{t("fields.model")}</span>
              <Input
                value={draft.model}
                onChange={(event) => update({ model: event.target.value })}
              />
            </label>
            <Banner>{t("create.followUp")}</Banner>
          </div>
        ) : null}
        {draft.step === 2 ? (
          <div className="agent-review">
            <div>
              <span>{t("fields.name")}</span>
              <strong>{draft.name || "-"}</strong>
            </div>
            <div>
              <span>{t("fields.workspace")}</span>
              <strong>{draft.workspace || t("inherit")}</strong>
            </div>
            <div>
              <span>{t("fields.model")}</span>
              <strong>{draft.model || t("create.afterCreate")}</strong>
            </div>
          </div>
        ) : null}
        <footer className="agent-modal__actions">
          <Button onClick={onClose}>{t("cancel")}</Button>
          {draft.step > 0 ? (
            <Button onClick={() => update({ step: (draft.step - 1) as CreateAgentDraft["step"] })}>
              {t("create.back")}
            </Button>
          ) : null}
          {draft.step < 2 ? (
            <Button variant="primary" onClick={advance}>
              {t("create.next")}
            </Button>
          ) : (
            <Button variant="primary" disabled={submitting} onClick={() => void submit()}>
              {submitting ? t("saving") : t("create.submit")}
            </Button>
          )}
        </footer>
      </div>
    </Modal>
  );
}

function ConfirmDelete({
  agent,
  onCancel,
  onDeleted,
}: {
  agent: Agent | null;
  onCancel: () => void;
  onDeleted: (fallbackId: string | null) => void;
}) {
  const t = useTranslations("agentsPanel");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) {
      setDeleting(false);
      setError(null);
    }
  }, [agent]);

  const confirm = async () => {
    if (!agent) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAgent(agent.id);
      useAgentsStore.getState().removeAgent(agent.id);
      await useAgentsStore.getState().refreshAgents();
      onDeleted(useAgentsStore.getState().selectedAgentId);
    } catch (deleteError) {
      setError(formatAgentError(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={Boolean(agent)}
      onClose={onCancel}
      size="sm"
      dismissOnScrimClick={false}
      aria-labelledby="agent-delete-title"
      aria-describedby="agent-delete-body"
    >
      <div className="agent-modal">
        <header>
          <h2 id="agent-delete-title">{t("delete.title")}</h2>
          <p id="agent-delete-body">{agent ? t("delete.body", { name: agent.name }) : ""}</p>
        </header>
        {error ? <Banner variant="error">{error}</Banner> : null}
        <footer className="agent-modal__actions">
          <Button onClick={onCancel}>{t("cancel")}</Button>
          <Button variant="danger" disabled={deleting} onClick={() => void confirm()}>
            {deleting ? t("saving") : t("delete.confirm")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

import { useQueryClient } from "@tanstack/react-query";
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
  normalizeAgentSubagentPermissionOptions,
  type DeckGoAgentDetailResponse,
  type DeckGoAgentEventStreamsResponse,
  type DeckGoAgentFile,
  type DeckGoAgentSkillsResponse,
  type DeckGoAgentSubagentPermissionOption,
  type DeckGoAgentSystemPromptPreviewResponse,
  type DeckGoAgentToolPolicyPreviewResponse,
} from "@/api";
import type { DeckGoRuntimeConfiguredModel, DeckGoServerEvent } from "@/api-types";
import {
  applyAgentStatusInvalidation,
  isProtectedAgentDeleteTarget,
  useAgentDetailQuery,
  useAgentEventStreamsQuery,
  useAgentFileQuery,
  useAgentFilesQuery,
  useAgentsConfiguredModelsQuery,
  useAgentsListQuery,
  useAgentSkillsQuery,
  useAgentSubagentsQuery,
  useAgentSystemPromptQuery,
  useAgentToolPolicyQuery,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  useSaveAgentEventStreamsMutation,
  useSaveAgentFileMutation,
  useSaveAgentSkillsMutation,
  useSaveAgentSubagentsMutation,
  useUpdateAgentMutation,
} from "@/data/modules/agents";
import {
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Spinner,
  Textarea,
  Toggle,
} from "@/design-system/atoms";
import { useLiveProjectionSubscription } from "@/hooks/useLiveProjectionSubscription";
import { normalizeAgentSummary, useAgentsStore, type Agent } from "@/stores/agents";
import {
  AGENT_SECTIONS,
  buildAgentIdentityPatch,
  buildAgentRuntimePatch,
  buildCreateAgentRequest,
  formatAgentError,
  formatMaybeCount,
  hasOverviewChanges,
  hasRuntimeChanges,
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

function configuredModelRef(model: DeckGoRuntimeConfiguredModel): string {
  return model.id || model.model || model.modelIdentifier || model.name || "";
}

function configuredModelLabel(model: DeckGoRuntimeConfiguredModel): string {
  const ref = configuredModelRef(model);
  const provider = model.provider ? `${model.provider} · ` : "";
  return `${provider}${model.name || ref}`.trim() || ref;
}

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
  if (filter === "idle") {
    return agent.status === "idle";
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
  const queryClient = useQueryClient();
  const agentsQuery = useAgentsListQuery();
  const selectedAgentId = useAgentsStore((state) => state.selectedAgentId);
  const selectAgent = useAgentsStore((state) => state.selectAgent);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentsFilter>("all");
  const [sort, setSort] = useState<AgentsSort>("recent");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const handleServerEvent = useCallback(
    (event: DeckGoServerEvent) => {
      void applyAgentStatusInvalidation(queryClient, event);
    },
    [queryClient],
  );
  const liveProjection = useLiveProjectionSubscription({
    projectionId: "agent-status",
    onEvent: handleServerEvent,
    retryDelayMs: 2_000,
  });
  const streamStatus = liveProjection.status;
  const list = useMemo(
    () => (agentsQuery.data?.agents ?? []).map(normalizeAgentSummary),
    [agentsQuery.data?.agents],
  );
  const hasListData = Boolean(agentsQuery.data);
  const status =
    !hasListData && agentsQuery.isPending
      ? "loading"
      : !hasListData && agentsQuery.isError
        ? "error"
        : "ready";
  const error = agentsQuery.error ? formatAgentError(agentsQuery.error) : null;
  const retryAgentsList = useCallback(async () => {
    await agentsQuery.refetch();
  }, [agentsQuery]);

  useEffect(() => {
    const requestedAgentId = readAgentParam();
    if (requestedAgentId) {
      selectAgent(requestedAgentId);
    }
    const handlePopState = () => selectAgent(readAgentParam());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectAgent]);

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
    const defaultAgent = list.find((agent) => agent.isConfiguredDefault ?? agent.isDefault);
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
        setFilter((["all", "busy", "idle"] as AgentsFilter[])[Number(event.key) - 1] ?? "all");
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

  const handleRowKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
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
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>
        <div className="agents-panel__toolbar-actions">
          {!selectedAgent ? (
            <div className="agents-search">
              <Input
                ref={searchRef}
                value={search}
                aria-label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <span className="agents-keyhint">⌘K</span>
            </div>
          ) : null}
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            {t("create.open")}
          </Button>
        </div>
      </div>

      {selectedAgent ? (
        <AgentDetailView
          agent={selectedAgent}
          onBack={returnToList}
          onDelete={() => setDeleteTarget(selectedAgent)}
        />
      ) : (
        <div className="agents-list-view">
          <div className="agents-panel__filters">
            <span>
              {visibleAgents.length} of {list.length}{" "}
              {list.length === 1 ? t("count.agent") : t("count.agents")}
            </span>
            <div className="agents-panel__filter-groups">
              <SegmentedControl<AgentsFilter>
                aria-label={t("filterLabel")}
                value={filter}
                onChange={setFilter}
                items={[
                  { value: "all", label: t("filters.all") },
                  { value: "busy", label: t("filters.busy") },
                  { value: "idle", label: t("filters.idle") },
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
          </div>

          {status === "loading" ? <LoadingRows label={t("loading")} /> : null}
          {status === "error" ? (
            <Banner variant="error">
              <strong>{t("errors.listTitle")}</strong>
              <span>{error}</span>
              <Button size="sm" onClick={() => void retryAgentsList()}>
                {t("retry")}
              </Button>
            </Banner>
          ) : null}
          {hasListData && agentsQuery.isError ? (
            <Banner variant="warn">
              <strong>{t("errors.listTitle")}</strong>
              <span>{error}</span>
              <Button size="sm" onClick={() => void retryAgentsList()}>
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
            <div className="agents-list" role="list" aria-label={t("tableLabel")}>
              {visibleAgents.map((agent, index) => (
                <div key={agent.id} role="listitem">
                  <button
                    ref={(node) => {
                      rowRefs.current[index] = node;
                    }}
                    type="button"
                    className="agents-list__row"
                    onClick={() => openAgent(agent.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, index)}
                  >
                    <span
                      className={
                        (agent.isConfiguredDefault ?? agent.isDefault)
                          ? "agent-avatar agent-avatar--accent"
                          : "agent-avatar"
                      }
                      aria-hidden="true"
                    >
                      {agentInitial(agent)}
                    </span>
                    <span className="agents-list__main">
                      <span className="agents-list__name">
                        <strong>{agent.name}</strong>
                        {(agent.isConfiguredDefault ?? agent.isDefault) ? (
                          <Badge variant="ok">{t("defaultBadge")}</Badge>
                        ) : null}
                        {agent.isMainProtected ? (
                          <Badge variant="warn">{t("protectedBadge")}</Badge>
                        ) : null}
                      </span>
                      <span className="agents-list__meta">
                        <span>{agent.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{agent.model || t("missingModel")}</span>
                        <span aria-hidden="true">·</span>
                        <span>{agent.workspace || t("missingWorkspace")}</span>
                      </span>
                    </span>
                    <span className="agents-list__status">
                      <span className="agents-list__counts">
                        <span>
                          <strong>{formatMaybeCount(agent.sessionCount)}</strong>
                          {t("columns.sessions").toLowerCase()}
                        </span>
                        <span>
                          <strong>{formatMaybeCount(agent.bindingCount)}</strong>
                          {t("columns.bindings").toLowerCase()}
                        </span>
                      </span>
                      <StatusBadge agent={agent} />
                    </span>
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <footer className="agents-list-footer">
            <span>{t("footer.summary", { total: list.length, busy: metrics.busy })}</span>
            <span>
              <span className={`agent-status-dot agent-status-dot--${streamStatus}`} />
              {t(`stream.${streamStatus}`)}
            </span>
          </footer>
        </div>
      )}

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
  const detailQuery = useAgentDetailQuery(agent.id);
  const detail = detailQuery.data ?? null;
  const detailError = detailQuery.error ? formatAgentError(detailQuery.error) : null;
  const detailLoading = detailQuery.isPending && !detailQuery.data;
  const [overviewDraft, setOverviewDraft] = useState<OverviewDraft>(() =>
    overviewDraftFromAgent(agent),
  );
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const skillsQuery = useAgentSkillsQuery(agent.id, { enabled: section === "skills" });
  const skills = skillsQuery.data ?? null;
  const [skillsDraft, setSkillsDraft] = useState<{ mode: string; skills: string[] } | null>(null);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsConflict, setSkillsConflict] = useState(false);

  const subagentsQuery = useAgentSubagentsQuery(agent.id, { enabled: section === "subagents" });
  const subagents = subagentsQuery.data ?? null;
  const [subagentRows, setSubagentRows] = useState<DeckGoAgentSubagentPermissionOption[]>([]);
  const [subagentAllowAny, setSubagentAllowAny] = useState(false);
  const [subagentModel, setSubagentModel] = useState("");
  const [subagentSaving, setSubagentSaving] = useState(false);
  const [subagentError, setSubagentError] = useState<string | null>(null);
  const [subagentConflict, setSubagentConflict] = useState(false);

  const streamsQuery = useAgentEventStreamsQuery(agent.id, {
    enabled: section === "event-streams",
  });
  const streams = streamsQuery.data ?? null;
  const [streamDraft, setStreamDraft] = useState<string[]>([]);
  const [streamSaving, setStreamSaving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamConflict, setStreamConflict] = useState(false);

  const toolPolicyQuery = useAgentToolPolicyQuery(agent.id, { enabled: section === "tool-policy" });
  const toolPolicy = toolPolicyQuery.data ?? null;
  const [toolPolicyError, setToolPolicyError] = useState<string | null>(null);
  const systemPromptQuery = useAgentSystemPromptQuery(agent.id, {
    enabled: section === "system-prompt",
  });
  const systemPrompt = systemPromptQuery.data ?? null;
  const [systemPromptError, setSystemPromptError] = useState<string | null>(null);

  const filesQuery = useAgentFilesQuery(agent.id, { enabled: section === "files" });
  const files = filesQuery.data?.files ?? null;
  const [fileName, setFileName] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileQuery = useAgentFileQuery(agent.id, selectedFileName, {
    enabled: section === "files" && Boolean(selectedFileName),
  });
  const [fileContent, setFileContent] = useState("");
  const [fileDirty, setFileDirty] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const updateAgentMutation = useUpdateAgentMutation();
  const saveSkillsMutation = useSaveAgentSkillsMutation();
  const saveSubagentsMutation = useSaveAgentSubagentsMutation();
  const saveStreamsMutation = useSaveAgentEventStreamsMutation();
  const saveFileMutation = useSaveAgentFileMutation();

  const overviewDirty = hasOverviewChanges(agent, overviewDraft);
  const runtimeDirty = hasRuntimeChanges(agent, overviewDraft);
  const skillsDirty =
    Boolean(skillsDraft && skills) &&
    (skillsDraft?.mode !== skills?.mode ||
      skillsDraft?.skills.join("\n") !== skills?.skills.join("\n"));
  const subagentsDirty =
    Boolean(subagents) &&
    ((subagentAllowAny
      ? "*"
      : subagentRows
          .filter((row) => row.allowed)
          .map((row) => row.id)
          .toSorted()
          .join("\n")) !==
      (subagents?.allowAny || subagents?.allowAgents.includes("*")
        ? "*"
        : [...(subagents?.allowAgents ?? [])].toSorted().join("\n")) ||
      subagentModel !== (subagents?.model ?? ""));
  const streamsDirty = streams
    ? [...streamDraft].toSorted().join("\n") !== [...streams.eventStreams].toSorted().join("\n")
    : false;
  const dirtySections = [
    overviewDirty ? t("sections.overview") : "",
    runtimeDirty ? t("sections.runtime") : "",
    skillsDirty ? t("sections.skills") : "",
    subagentsDirty ? t("sections.subagents") : "",
    streamsDirty ? t("sections.eventStreams") : "",
    fileDirty ? t("sections.files") : "",
  ].filter(Boolean);

  const changeSection = useCallback((next: AgentSectionId) => {
    setSection(next);
    window.location.hash = next;
  }, []);

  useEffect(() => {
    setOverviewDraft(overviewDraftFromAgent(agent));
    setSkillsDraft(null);
    setSubagentRows([]);
    setSubagentAllowAny(false);
    setSubagentModel("");
    setStreamDraft([]);
    setFileName("");
    setSelectedFileName("");
    setFileContent("");
    setFileDirty(false);
    setOverviewError(null);
    setRuntimeError(null);
    setSkillsError(null);
    setSubagentError(null);
    setStreamError(null);
    setToolPolicyError(null);
    setSystemPromptError(null);
    setFileError(null);
  }, [agent]);

  useEffect(() => {
    const handleHash = () => setSection(readSectionFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    if (!skills) {
      return;
    }
    setSkillsDraft({ mode: skills.mode, skills: skills.skills });
  }, [skills]);

  useEffect(() => {
    if (!subagents) {
      return;
    }
    setSubagentRows(normalizeAgentSubagentPermissionOptions(subagents));
    setSubagentAllowAny(subagents.allowAny === true || subagents.allowAgents.includes("*"));
    setSubagentModel(subagents.model ?? "");
  }, [subagents]);

  useEffect(() => {
    if (streams) {
      setStreamDraft(streams.eventStreams);
    }
  }, [streams]);

  useEffect(() => {
    const file = fileQuery.data?.file;
    if (!file) {
      return;
    }
    setFileName(file.name);
    setFileContent(file.content ?? "");
    setFileDirty(false);
  }, [fileQuery.data?.file]);

  const reloadSkills = useCallback(async () => {
    setSkillsError(null);
    setSkillsConflict(false);
    await skillsQuery.refetch();
  }, [skillsQuery]);

  const reloadSubagents = useCallback(async () => {
    setSubagentError(null);
    setSubagentConflict(false);
    await subagentsQuery.refetch();
  }, [subagentsQuery]);

  const reloadStreams = useCallback(async () => {
    setStreamError(null);
    setStreamConflict(false);
    await streamsQuery.refetch();
  }, [streamsQuery]);

  const reloadToolPolicy = useCallback(async () => {
    setToolPolicyError(null);
    await toolPolicyQuery.refetch();
  }, [toolPolicyQuery]);

  const reloadSystemPrompt = useCallback(async () => {
    setSystemPromptError(null);
    await systemPromptQuery.refetch();
  }, [systemPromptQuery]);

  const reloadFiles = useCallback(async () => {
    setFileError(null);
    await filesQuery.refetch();
  }, [filesQuery]);

  const skillsDisplayError =
    skillsError ?? (skillsQuery.error ? formatAgentError(skillsQuery.error) : null);
  const subagentDisplayError =
    subagentError ?? (subagentsQuery.error ? formatAgentError(subagentsQuery.error) : null);
  const streamDisplayError =
    streamError ?? (streamsQuery.error ? formatAgentError(streamsQuery.error) : null);
  const toolPolicyDisplayError =
    toolPolicyError ?? (toolPolicyQuery.error ? formatAgentError(toolPolicyQuery.error) : null);
  const systemPromptDisplayError =
    systemPromptError ??
    (systemPromptQuery.error ? formatAgentError(systemPromptQuery.error) : null);
  const fileDisplayError =
    fileError ??
    (filesQuery.error ? formatAgentError(filesQuery.error) : null) ??
    (fileQuery.error ? formatAgentError(fileQuery.error) : null);

  const saveOverview = useCallback(async () => {
    if (!overviewDirty) {
      return;
    }
    setOverviewSaving(true);
    setOverviewError(null);
    try {
      await updateAgentMutation.mutateAsync({
        agentId: agent.id,
        patch: buildAgentIdentityPatch(agent, overviewDraft),
      });
      await detailQuery.refetch();
    } catch (error) {
      setOverviewError(formatAgentError(error));
    } finally {
      setOverviewSaving(false);
    }
  }, [agent, detailQuery, overviewDirty, overviewDraft, updateAgentMutation]);

  const saveRuntime = useCallback(async () => {
    if (!runtimeDirty) {
      return;
    }
    setRuntimeSaving(true);
    setRuntimeError(null);
    try {
      await updateAgentMutation.mutateAsync({
        agentId: agent.id,
        patch: buildAgentRuntimePatch(agent, overviewDraft),
      });
      await detailQuery.refetch();
    } catch (error) {
      setRuntimeError(formatAgentError(error));
    } finally {
      setRuntimeSaving(false);
    }
  }, [agent, detailQuery, runtimeDirty, overviewDraft, updateAgentMutation]);

  const saveSkills = useCallback(async () => {
    if (!skills || !skillsDraft) {
      return;
    }
    setSkillsSaving(true);
    setSkillsError(null);
    setSkillsConflict(false);
    try {
      const response = await saveSkillsMutation.mutateAsync({
        agentId: agent.id,
        baseHash: skills.configHash,
        mode: skillsDraft.mode === "whitelist" ? "whitelist" : "all",
        skills: skillsDraft.skills,
      });
      setSkillsDraft({
        mode: response.mode ?? skillsDraft.mode,
        skills: response.skills ?? skillsDraft.skills,
      });
      await skillsQuery.refetch();
    } catch (error) {
      setSkillsConflict(isConflictError(error));
      setSkillsError(formatAgentError(error));
    } finally {
      setSkillsSaving(false);
    }
  }, [agent.id, saveSkillsMutation, skills, skillsDraft, skillsQuery]);

  const saveSubagents = useCallback(async () => {
    if (!subagents) {
      return;
    }
    setSubagentSaving(true);
    setSubagentError(null);
    setSubagentConflict(false);
    try {
      const allowAgents = subagentAllowAny
        ? ["*"]
        : subagentRows.filter((row) => row.allowed).map((row) => row.id);
      const response = await saveSubagentsMutation.mutateAsync({
        agentId: agent.id,
        allowAgents,
        baseHash: subagents.configHash,
        model: subagentModel.trim() || undefined,
      });
      const nextAllowAgents = response.allowAgents ?? allowAgents;
      setSubagentAllowAny(nextAllowAgents.includes("*"));
      setSubagentRows((rows) =>
        rows.map((row) => ({
          ...row,
          allowed: nextAllowAgents.includes("*") || nextAllowAgents.includes(row.id),
        })),
      );
      setSubagentModel(response.model ?? subagentModel);
      await subagentsQuery.refetch();
    } catch (error) {
      setSubagentConflict(isConflictError(error));
      setSubagentError(formatAgentError(error));
    } finally {
      setSubagentSaving(false);
    }
  }, [
    agent.id,
    saveSubagentsMutation,
    subagentAllowAny,
    subagentModel,
    subagentRows,
    subagents,
    subagentsQuery,
  ]);

  const saveStreams = useCallback(async () => {
    if (!streams) {
      return;
    }
    setStreamSaving(true);
    setStreamError(null);
    setStreamConflict(false);
    try {
      const response = await saveStreamsMutation.mutateAsync({
        agentId: agent.id,
        baseHash: streams.configHash,
        eventStreams: streamDraft,
      });
      setStreamDraft(response.eventStreams ?? streamDraft);
      await streamsQuery.refetch();
    } catch (error) {
      setStreamConflict(isConflictError(error));
      setStreamError(formatAgentError(error));
    } finally {
      setStreamSaving(false);
    }
  }, [agent.id, saveStreamsMutation, streamDraft, streams, streamsQuery]);

  const openFile = useCallback((name: string) => {
    setFileError(null);
    setSelectedFileName(name);
  }, []);

  const saveFile = useCallback(async () => {
    if (!fileName.trim()) {
      setFileError(t("errors.fileNameRequired"));
      return;
    }
    setFileSaving(true);
    setFileError(null);
    try {
      await saveFileMutation.mutateAsync({
        agentId: agent.id,
        content: fileContent,
        name: fileName.trim(),
      });
      setFileDirty(false);
      await reloadFiles();
    } catch (error) {
      setFileError(formatAgentError(error));
    } finally {
      setFileSaving(false);
    }
  }, [agent.id, fileContent, fileName, reloadFiles, saveFileMutation, t]);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (section === "overview") {
          void saveOverview();
        } else if (section === "runtime") {
          void saveRuntime();
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
      if (!isTextInput && /^[1-9]$/.test(event.key)) {
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
  }, [
    changeSection,
    saveFile,
    saveOverview,
    saveRuntime,
    saveSkills,
    saveStreams,
    saveSubagents,
    section,
  ]);

  const detailModel = detail?.model ?? agent.model ?? t("missingModel");
  const detailWorkspace = detail?.workspace ?? agent.workspace ?? "/";
  const isMainProtected = detail?.isMainProtected ?? agent.isMainProtected;
  const isConfiguredDefault =
    detail?.isConfiguredDefault ?? agent.isConfiguredDefault ?? agent.isDefault;
  const mainKey = detail?.mainKey ?? agent.mainKey;
  const skillCount =
    detail && Array.isArray(detail.effectiveSkills)
      ? `${detail.effectiveSkills.length}/${detail.totalAvailableSkills}`
      : null;

  return (
    <section className="agents-detail" aria-label={t("detailLabel", { name: agent.name })}>
      <Button className="agents-detail__back" size="sm" variant="ghost" onClick={onBack}>
        {t("backToList")}
      </Button>

      <header className="agents-detail__hero">
        <div className="agents-detail__identity">
          <span
            className={
              isConfiguredDefault
                ? "agent-avatar agent-avatar--large agent-avatar--accent"
                : "agent-avatar agent-avatar--large"
            }
            aria-hidden="true"
          >
            {agentInitial(agent)}
          </span>
          <div className="agents-detail__identity-main">
            <h2>
              {agent.name}
              {isConfiguredDefault ? <Badge variant="ok">{t("defaultBadge")}</Badge> : null}
              {isMainProtected ? <Badge variant="warn">{t("protectedBadge")}</Badge> : null}
              <StatusBadge agent={agent} />
            </h2>
            <p>
              {agent.id} <span aria-hidden="true">·</span> {detailModel}{" "}
              <span aria-hidden="true">·</span> {detailWorkspace}
            </p>
            <div className="agent-meta-strip">
              <Chip>{t("meta.sessions", { count: formatMaybeCount(agent.sessionCount) })}</Chip>
              <Chip>{t("meta.bindings", { count: formatMaybeCount(agent.bindingCount) })}</Chip>
              {mainKey ? <Chip>{t("meta.mainKey", { value: mainKey })}</Chip> : null}
              {detail ? (
                <Chip>{t("meta.activeSubagents", { count: detail.activeSubagentCount })}</Chip>
              ) : null}
              {skillCount ? <Chip>{t("meta.skills", { count: skillCount })}</Chip> : null}
            </div>
          </div>
        </div>
        <div className="agents-detail__actions">
          {isMainProtected ? (
            <Banner variant="warn">{t("delete.protectedMain")}</Banner>
          ) : (
            <Button variant="danger" onClick={onDelete}>
              {t("delete.open")}
            </Button>
          )}
        </div>
      </header>

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
          <Button size="sm" onClick={() => void detailQuery.refetch()}>
            {t("retry")}
          </Button>
        </Banner>
      ) : null}

      <nav className="agents-detail__tabs" role="tablist" aria-label={t("sectionNavLabel")}>
        {AGENT_SECTIONS.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === section}
            className={
              entry.id === section
                ? "agents-detail__tab agents-detail__tab--active"
                : "agents-detail__tab"
            }
            onClick={() => changeSection(entry.id)}
          >
            <span className="agents-detail__tab-index">{index + 1}</span>
            {t(entry.labelKey)}
          </button>
        ))}
      </nav>

      <main className="agents-detail__main">
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
          />
        ) : null}
        {section === "runtime" ? (
          <RuntimeSection
            agent={agent}
            detail={detail}
            draft={overviewDraft}
            dirty={runtimeDirty}
            saving={runtimeSaving}
            error={runtimeError}
            onDraftChange={setOverviewDraft}
            onSave={saveRuntime}
          />
        ) : null}
        {section === "skills" ? (
          <SkillsSection
            data={skills}
            draft={skillsDraft}
            dirty={skillsDirty}
            saving={skillsSaving}
            error={skillsDisplayError}
            conflict={skillsConflict}
            onReload={reloadSkills}
            onDraftChange={setSkillsDraft}
            onSave={saveSkills}
          />
        ) : null}
        {section === "subagents" ? (
          <SubagentsSection
            rows={subagentRows}
            allowAny={subagentAllowAny}
            model={subagentModel}
            loaded={Boolean(subagents)}
            dirty={subagentsDirty}
            saving={subagentSaving}
            error={subagentDisplayError}
            conflict={subagentConflict}
            onReload={reloadSubagents}
            onAllowAnyChange={setSubagentAllowAny}
            onRowsChange={setSubagentRows}
            onModelChange={setSubagentModel}
            onSave={saveSubagents}
          />
        ) : null}
        {section === "tool-policy" ? (
          <ToolPolicySection
            preview={toolPolicy}
            error={toolPolicyDisplayError}
            onReload={reloadToolPolicy}
          />
        ) : null}
        {section === "system-prompt" ? (
          <SystemPromptSection
            preview={systemPrompt}
            error={systemPromptDisplayError}
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
            error={fileDisplayError}
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
            error={streamDisplayError}
            conflict={streamConflict}
            onReload={reloadStreams}
            onDraftChange={setStreamDraft}
            onSave={saveStreams}
          />
        ) : null}
        {section === "routing" ? <RoutingImpactSection agent={agent} detail={detail} /> : null}
        {section === "danger" ? (
          <DangerZoneSection agent={agent} detail={detail} onDelete={onDelete} />
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
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
  draft: OverviewDraft;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onDraftChange: (draft: OverviewDraft) => void;
  onSave: () => Promise<void>;
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
      {agent.isMainProtected || detail?.isMainProtected ? (
        <Banner variant="warn">{t("overview.protectedIdentity")}</Banner>
      ) : null}
      <div className="agent-meta-strip">
        <Chip>{t("meta.sessions", { count: formatMaybeCount(agent.sessionCount) })}</Chip>
        <Chip>{t("meta.bindings", { count: formatMaybeCount(agent.bindingCount) })}</Chip>
        <Chip>
          {t("meta.default", {
            value: (detail?.isConfiguredDefault ?? agent.isConfiguredDefault) ? t("yes") : t("no"),
          })}
        </Chip>
        {detail ? (
          <Chip>{t("meta.activeSubagents", { count: detail.activeSubagentCount })}</Chip>
        ) : null}
      </div>
      <footer className="agent-section__actions">
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving ? t("saving") : t("saveChanges")}
        </Button>
      </footer>
    </SectionCard>
  );
}

function RuntimeSection({
  agent,
  detail,
  draft,
  dirty,
  saving,
  error,
  onDraftChange,
  onSave,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
  draft: OverviewDraft;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  onDraftChange: (draft: OverviewDraft) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  const modelsQuery = useAgentsConfiguredModelsQuery();
  const models = modelsQuery.data?.payload?.models ?? modelsQuery.data?.payload?.items ?? [];
  const modelLoadError = modelsQuery.error ? formatAgentError(modelsQuery.error) : null;
  const update = (patch: Partial<OverviewDraft>) => onDraftChange({ ...draft, ...patch });
  const isProtected = detail?.isMainProtected ?? agent.isMainProtected;
  const modelOptions = models
    .map((model) => ({ value: configuredModelRef(model), label: configuredModelLabel(model) }))
    .filter((model) => model.value);

  return (
    <SectionCard title={t("sections.runtime")} description={t("runtime.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {isProtected ? <Banner variant="warn">{t("runtime.protectedMain")}</Banner> : null}
      <div className="agent-impact-grid">
        <div>
          <span>{t("runtime.modelSource")}</span>
          <strong>{detail?.effectiveSources?.model ?? t("unknown")}</strong>
        </div>
        <div>
          <span>{t("runtime.workspaceSource")}</span>
          <strong>{detail?.effectiveSources?.workspace ?? t("unknown")}</strong>
        </div>
        <div>
          <span>{t("runtime.reasoning")}</span>
          <strong>{detail?.reasoningDefault ?? t("unknown")}</strong>
        </div>
        <div>
          <span>{t("runtime.fastMode")}</span>
          <strong>{detail?.fastModeDefault === true ? t("yes") : t("no")}</strong>
        </div>
      </div>
      <div className="agent-form-grid">
        <label>
          <span>{t("fields.model")}</span>
          {modelOptions.length > 0 ? (
            <Select
              value={draft.model}
              onChange={(event) => update({ model: event.currentTarget.value })}
            >
              <option value="">{t("runtime.inheritModel")}</option>
              {modelOptions.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              value={draft.model}
              onChange={(event) => update({ model: event.target.value })}
            />
          )}
        </label>
        <label>
          <span>{t("fields.workspace")}</span>
          <Input
            value={draft.workspace}
            onChange={(event) => update({ workspace: event.target.value })}
          />
        </label>
      </div>
      {modelLoadError ? (
        <Banner variant="warn">{t("runtime.modelFallback", { error: modelLoadError })}</Banner>
      ) : null}
      <div className="agent-guarded-list" aria-label={t("runtime.guardsLabel")}>
        {(detail?.guardedEdits ?? []).map((guard) => (
          <div key={guard.field} className="agent-preview-row">
            <strong>{guard.field}</strong>
            <Badge variant={guard.risk === "high" ? "warn" : "neutral"}>{guard.risk}</Badge>
            <small>{guard.reason}</small>
          </div>
        ))}
      </div>
      <footer className="agent-section__actions">
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving ? t("saving") : t("runtime.saveGuarded")}
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
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "assigned" | "unassigned" | "ineligible">("all");
  const visibleSkills = useMemo(() => {
    if (!data || !draft) {
      return [];
    }
    const normalized = query.trim().toLowerCase();
    return data.available
      .filter((skill) => {
        const assigned = draft.skills.includes(skill.key);
        if (view === "assigned" && !assigned) {
          return false;
        }
        if (view === "unassigned" && assigned) {
          return false;
        }
        if (view === "ineligible" && skill.eligible) {
          return false;
        }
        if (!normalized) {
          return true;
        }
        return `${skill.name} ${skill.key}`.toLowerCase().includes(normalized);
      })
      .toSorted((left, right) => {
        const leftAssigned = draft.skills.includes(left.key) ? 0 : 1;
        const rightAssigned = draft.skills.includes(right.key) ? 0 : 1;
        return leftAssigned - rightAssigned || left.name.localeCompare(right.name);
      });
  }, [data, draft, query, view]);
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
          <div className="agent-section-toolbar">
            <Input
              value={query}
              aria-label={t("skills.searchLabel")}
              placeholder={t("skills.searchPlaceholder")}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <SegmentedControl
              aria-label={t("skills.filterLabel")}
              value={view}
              onChange={setView}
              items={[
                { value: "all", label: t("filters.all") },
                { value: "assigned", label: t("skills.assigned") },
                { value: "unassigned", label: t("skills.unassigned") },
                { value: "ineligible", label: t("skills.ineligible") },
              ]}
            />
          </div>
          <div className="agent-option-list">
            {data.available.length === 0 ? <p>{t("skills.empty")}</p> : null}
            {data.available.length > 0 && visibleSkills.length === 0 ? (
              <p>{t("skills.noMatches")}</p>
            ) : null}
            {visibleSkills.map((skill) => {
              const enabled = draft.skills.includes(skill.key);
              return (
                <div key={skill.key} className="agent-option-row">
                  <div>
                    <strong>{skill.name}</strong>
                    <small>
                      {skill.eligible
                        ? skill.key
                        : t("skills.ineligibleReason", { key: skill.key })}
                    </small>
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
  allowAny,
  model,
  loaded,
  dirty,
  saving,
  error,
  conflict,
  onReload,
  onAllowAnyChange,
  onRowsChange,
  onModelChange,
  onSave,
}: {
  rows: DeckGoAgentSubagentPermissionOption[];
  allowAny: boolean;
  model: string;
  loaded: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  onReload: () => Promise<void>;
  onAllowAnyChange: (allowAny: boolean) => void;
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
          <SegmentedControl
            aria-label={t("subagents.modeLabel")}
            value={allowAny ? "any" : "explicit"}
            onChange={(value) => onAllowAnyChange(value === "any")}
            items={[
              { value: "any", label: t("subagents.allowAny") },
              { value: "explicit", label: t("subagents.explicit") },
            ]}
          />
          {!allowAny ? (
            <Banner variant="warn">{t("subagents.narrowingWarning")}</Banner>
          ) : (
            <Banner>{t("subagents.allowAnyDescription")}</Banner>
          )}
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
                  disabled={allowAny}
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
  onOpen: (name: string) => void;
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
              onClick={() => onOpen(file.name)}
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

function RoutingImpactSection({
  agent,
  detail,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
}) {
  const t = useTranslations("agentsPanel");
  const bindingCount = detail?.impact?.bindingCount ?? detail?.bindingCount ?? agent.bindingCount;
  const sessionCount = detail?.impact?.sessionCount ?? detail?.sessionCount ?? agent.sessionCount;
  return (
    <SectionCard title={t("sections.routing")} description={t("routing.description")}>
      <div className="agent-impact-grid">
        <div>
          <span>{t("columns.bindings")}</span>
          <strong>{formatMaybeCount(bindingCount)}</strong>
        </div>
        <div>
          <span>{t("columns.sessions")}</span>
          <strong>{formatMaybeCount(sessionCount)}</strong>
        </div>
        <div>
          <span>{t("routing.defaultState")}</span>
          <strong>
            {(detail?.isConfiguredDefault ?? agent.isConfiguredDefault) ? t("yes") : t("no")}
          </strong>
        </div>
        <div>
          <span>{t("meta.mainKey", { value: detail?.mainKey ?? agent.mainKey ?? "-" })}</span>
          <strong>{detail?.mainKey ?? agent.mainKey ?? "-"}</strong>
        </div>
      </div>
      <Banner>{t("routing.ownerCopy")}</Banner>
      <footer className="agent-section__actions">
        <Button
          onClick={() => {
            window.location.href = `/?panel=routing&agentId=${encodeURIComponent(agent.id)}`;
          }}
        >
          {t("routing.openRouting")}
        </Button>
      </footer>
    </SectionCard>
  );
}

function DangerZoneSection({
  agent,
  detail,
  onDelete,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
  onDelete: () => void;
}) {
  const t = useTranslations("agentsPanel");
  const isProtected = detail?.isMainProtected ?? agent.isMainProtected;
  return (
    <SectionCard title={t("sections.danger")} description={t("danger.description")}>
      {isProtected ? (
        <Banner variant="warn">{t("delete.protectedMain")}</Banner>
      ) : (
        <>
          <div className="agent-impact-grid">
            <div>
              <span>{t("columns.bindings")}</span>
              <strong>{formatMaybeCount(detail?.bindingCount ?? agent.bindingCount)}</strong>
            </div>
            <div>
              <span>{t("columns.sessions")}</span>
              <strong>{formatMaybeCount(detail?.sessionCount ?? agent.sessionCount)}</strong>
            </div>
            <div>
              <span>{t("danger.deleteFiles")}</span>
              <strong>{t("no")}</strong>
            </div>
            <div>
              <span>{t("danger.configuredDefault")}</span>
              <strong>
                {(detail?.isConfiguredDefault ?? agent.isConfiguredDefault) ? t("yes") : t("no")}
              </strong>
            </div>
          </div>
          <Banner variant="warn">{t("danger.deleteImpact")}</Banner>
          <footer className="agent-section__actions">
            <Button variant="danger" onClick={onDelete}>
              {t("delete.open")}
            </Button>
          </footer>
        </>
      )}
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
  const modelsQuery = useAgentsConfiguredModelsQuery({ enabled: open });
  const createAgentMutation = useCreateAgentMutation();
  const models = modelsQuery.data?.payload?.models ?? modelsQuery.data?.payload?.items ?? [];
  const modelLoadError = modelsQuery.error ? formatAgentError(modelsQuery.error) : null;

  useEffect(() => {
    if (!open) {
      setDraft(initialCreateDraft());
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const validationKey = validateCreateStep(draft);
  const update = (patch: Partial<CreateAgentDraft>) => setDraft({ ...draft, ...patch });
  const modelOptions = models
    .map((model) => ({ value: configuredModelRef(model), label: configuredModelLabel(model) }))
    .filter((model) => model.value);
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
      const response = await createAgentMutation.mutateAsync(buildCreateAgentRequest(draft));
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
              {modelOptions.length > 0 ? (
                <Select
                  value={draft.model}
                  onChange={(event) => update({ model: event.currentTarget.value })}
                >
                  <option value="">{t("runtime.inheritModel")}</option>
                  {modelOptions.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={draft.model}
                  onChange={(event) => update({ model: event.target.value })}
                />
              )}
            </label>
            <Banner>{t("create.followUp")}</Banner>
            {modelLoadError ? (
              <Banner variant="warn">
                {t("runtime.modelFallback", { error: modelLoadError })}
              </Banner>
            ) : null}
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
              <strong>{draft.model || t("runtime.inheritModel")}</strong>
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
  const deleteAgentMutation = useDeleteAgentMutation();
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
    if (isProtectedAgentDeleteTarget(agent)) {
      setError(t("delete.protectedMain"));
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAgentMutation.mutateAsync({ agent });
      onDeleted(null);
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
        {isProtectedAgentDeleteTarget(agent) ? (
          <Banner variant="warn">{t("delete.protectedMain")}</Banner>
        ) : (
          <Banner variant="warn">{t("danger.deleteImpact")}</Banner>
        )}
        <footer className="agent-modal__actions">
          <Button onClick={onCancel}>{t("cancel")}</Button>
          <Button
            variant="danger"
            disabled={deleting || isProtectedAgentDeleteTarget(agent)}
            onClick={() => void confirm()}
          >
            {deleting ? t("saving") : t("delete.confirm")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

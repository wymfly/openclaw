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
  type DeckGoAgentDefaultsBucket,
  type DeckGoAgentEventStreamsResponse,
  type DeckGoAgentFile,
  type DeckGoAgentImpactSummary,
  type DeckGoAgentModelChoice,
  type DeckGoAgentModelPolicyEntry,
  type DeckGoAgentModelPolicyResponse,
  type DeckGoAgentModelPolicyTarget,
  type DeckGoAgentModelSelection,
  type DeckGoAgentSkillsResponse,
  type DeckGoAgentSubagentPermissionOption,
  type DeckGoAgentSystemPromptPreviewResponse,
  type DeckGoAgentToolPolicyPreviewResponse,
  type DeckGoAgentUnresolvedReferences,
} from "@/api";
import type { DeckGoRuntimeConfiguredModel, DeckGoServerEvent } from "@/api-types";
import {
  applyAgentStatusInvalidation,
  isProtectedAgentDeleteTarget,
  useAgentDetailQuery,
  useAgentEventStreamsQuery,
  useAgentFileQuery,
  useAgentFilesQuery,
  useAgentModelPolicyQuery,
  useAgentsDefaults,
  useAgentsImpactPreview,
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
  useSaveAgentModelPolicyMutation,
  useSaveAgentSkillsMutation,
  useSaveAgentSubagentsMutation,
  useSaveAgentsDefaultsMutation,
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

const AGENT_DEFAULTS_SECTIONS: Array<{
  id: "overview" | "model" | "workspace" | "skills" | "subagents" | "conversation" | "delivery";
  labelKey: string;
}> = [
  { id: "overview", labelKey: "sections.overview" },
  { id: "model", labelKey: "sections.model" },
  { id: "workspace", labelKey: "sections.workspace" },
  { id: "skills", labelKey: "sections.skills" },
  { id: "subagents", labelKey: "sections.subagents" },
  { id: "conversation", labelKey: "sections.conversation" },
  { id: "delivery", labelKey: "sections.delivery" },
];
type AgentDefaultsSectionId = (typeof AGENT_DEFAULTS_SECTIONS)[number]["id"];

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
    url.searchParams.delete("view");
  } else {
    url.searchParams.delete("agent");
    url.hash = "";
  }
  window.history.pushState({ panel: "agents", agentId }, "", url);
}

function readDefaultsViewParam(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("view") === "defaults";
}

function writeDefaultsViewParam(open: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("panel", "agents");
  url.searchParams.delete("agent");
  if (open) {
    url.searchParams.set("view", "defaults");
    url.hash = url.hash || "overview";
  } else {
    url.searchParams.delete("view");
    url.hash = "";
  }
  window.history.pushState({ panel: "agents", view: open ? "defaults" : null }, "", url);
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
  const [defaultsOpen, setDefaultsOpen] = useState(() => readDefaultsViewParam());
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
      setDefaultsOpen(false);
      selectAgent(agentId);
      writeAgentParam(agentId);
      window.location.hash = window.location.hash || "#overview";
    },
    [selectAgent],
  );

  const returnToList = useCallback(() => {
    setDefaultsOpen(false);
    selectAgent(null);
    writeAgentParam(null);
  }, [selectAgent]);

  const openDefaults = useCallback(() => {
    selectAgent(null);
    setDefaultsOpen(true);
    writeDefaultsViewParam(true);
  }, [selectAgent]);

  const closeDefaults = useCallback(() => {
    setDefaultsOpen(false);
    writeDefaultsViewParam(false);
  }, []);

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
      if (!selectedAgent && !defaultsOpen && (event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!selectedAgent && !defaultsOpen && !isTextInput && event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (!selectedAgent && !defaultsOpen && !isTextInput && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        setFilter((["all", "busy", "idle"] as AgentsFilter[])[Number(event.key) - 1] ?? "all");
      }
      if (
        (selectedAgent || defaultsOpen) &&
        event.key === "Escape" &&
        !createOpen &&
        !deleteTarget
      ) {
        event.preventDefault();
        returnToList();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, defaultsOpen, deleteTarget, returnToList, selectedAgent]);

  useEffect(() => {
    const handlePopState = () => setDefaultsOpen(readDefaultsViewParam());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
          {!selectedAgent && !defaultsOpen ? (
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
          {!selectedAgent ? <Button onClick={openDefaults}>{t("defaults.open")}</Button> : null}
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
      ) : defaultsOpen ? (
        <AgentDefaultsEditor onBack={closeDefaults} />
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
  const [unresolvedOpen, setUnresolvedOpen] = useState(false);

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
  const [subagentRequireAgentId, setSubagentRequireAgentId] = useState(false);
  const [subagentSaving, setSubagentSaving] = useState(false);
  const [subagentError, setSubagentError] = useState<string | null>(null);
  const [subagentConflict, setSubagentConflict] = useState(false);

  const streamsQuery = useAgentEventStreamsQuery(agent.id, {
    enabled: section === "delivery",
  });
  const streams = streamsQuery.data ?? null;
  const [streamDraft, setStreamDraft] = useState<string[]>([]);
  const [streamSaving, setStreamSaving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamConflict, setStreamConflict] = useState(false);

  const toolPolicyQuery = useAgentToolPolicyQuery(agent.id, { enabled: section === "tools" });
  const toolPolicy = toolPolicyQuery.data ?? null;
  const [toolPolicyError, setToolPolicyError] = useState<string | null>(null);
  const systemPromptQuery = useAgentSystemPromptQuery(agent.id, {
    enabled: section === "conversation",
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
  const subagentsPermissionDirty =
    Boolean(subagents) &&
    (subagentAllowAny
      ? "*"
      : subagentRows
          .filter((row) => row.allowed)
          .map((row) => row.id)
          .toSorted()
          .join("\n")) !==
      (subagents?.allowAny || subagents?.allowAgents.includes("*")
        ? "*"
        : [...(subagents?.allowAgents ?? [])].toSorted().join("\n"));
  const subagentsRequireAgentIdDirty =
    Boolean(subagents) && subagentRequireAgentId !== (subagents?.requireAgentId === true);
  const subagentsDirty = subagentsPermissionDirty || subagentsRequireAgentIdDirty;
  const streamsDirty = streams
    ? [...streamDraft].toSorted().join("\n") !== [...streams.eventStreams].toSorted().join("\n")
    : false;
  const dirtySections = [
    overviewDirty ? t("sections.overview") : "",
    runtimeDirty ? t("sections.workspace") : "",
    skillsDirty ? t("sections.skills") : "",
    subagentsDirty ? t("sections.subagents") : "",
    streamsDirty ? t("sections.delivery") : "",
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
    setSubagentRequireAgentId(false);
    setStreamDraft([]);
    setFileName("");
    setSelectedFileName("");
    setFileContent("");
    setFileDirty(false);
    setOverviewError(null);
    setRuntimeError(null);
    setUnresolvedOpen(false);
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
    setSubagentRequireAgentId(subagents.requireAgentId === true);
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
        requireAgentId: subagentRequireAgentId,
      });
      const nextAllowAgents = response.allowAgents ?? allowAgents;
      setSubagentAllowAny(nextAllowAgents.includes("*"));
      setSubagentRequireAgentId(response.requireAgentId ?? subagentRequireAgentId);
      setSubagentRows((rows) =>
        rows.map((row) => ({
          ...row,
          allowed: nextAllowAgents.includes("*") || nextAllowAgents.includes(row.id),
        })),
      );
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
    subagentRequireAgentId,
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
        } else if (section === "workspace") {
          void saveRuntime();
        } else if (section === "skills") {
          void saveSkills();
        } else if (section === "subagents") {
          void saveSubagents();
        } else if (section === "delivery") {
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
  const unresolvedCount = countUnresolvedReferences(detail?.unresolvedReferences);

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
              {unresolvedCount > 0 ? (
                <button
                  type="button"
                  className="agent-unresolved-chip"
                  onClick={() => setUnresolvedOpen(true)}
                >
                  {t("unresolved.chip", { count: unresolvedCount })}
                </button>
              ) : null}
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
      <UnresolvedReferencesModal
        agentId={agent.id}
        open={unresolvedOpen}
        refs={detail?.unresolvedReferences ?? null}
        onClose={() => setUnresolvedOpen(false)}
      />

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
        {section === "model" ? <ModelSection agent={agent} detail={detail} /> : null}
        {section === "workspace" ? (
          <WorkspaceSection
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
            agent={agent}
            detail={detail}
            rows={subagentRows}
            allowAny={subagentAllowAny}
            requireAgentId={subagentRequireAgentId}
            loaded={Boolean(subagents)}
            dirty={subagentsDirty}
            saving={subagentSaving}
            error={subagentDisplayError}
            conflict={subagentConflict}
            onReload={reloadSubagents}
            onAllowAnyChange={setSubagentAllowAny}
            onRequireAgentIdChange={setSubagentRequireAgentId}
            onRowsChange={setSubagentRows}
            onSave={saveSubagents}
          />
        ) : null}
        {section === "tools" ? (
          <ToolPolicySection
            preview={toolPolicy}
            error={toolPolicyDisplayError}
            onReload={reloadToolPolicy}
          />
        ) : null}
        {section === "conversation" ? (
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
        {section === "delivery" ? (
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

type InheritanceField = keyof NonNullable<DeckGoAgentDetailResponse["inherited"]>;

function SourceBadge({
  detail,
  field,
}: {
  detail: DeckGoAgentDetailResponse | null;
  field: InheritanceField;
}) {
  const t = useTranslations("agentsPanel");
  const source = detail?.inherited?.[field]?.source;
  return (
    <Badge variant={source === "agent" ? "ok" : source ? "neutral" : "warn"}>
      {source ? t(`source.${source}`) : t("source.unknown")}
    </Badge>
  );
}

function countUnresolvedReferences(refs: DeckGoAgentUnresolvedReferences | null | undefined) {
  return (
    (refs?.skills?.length ?? 0) +
    (refs?.subagents?.length ?? 0) +
    (refs?.eventStreams?.length ?? 0) +
    (refs?.models?.length ?? 0)
  );
}

function unresolvedEntries(refs: DeckGoAgentUnresolvedReferences | null | undefined) {
  return [
    ...(refs?.skills ?? []).map((entry) => ({
      key: entry.key,
      category: "skills",
      reason: entry.reason,
      target: "skills",
    })),
    ...(refs?.subagents ?? []).map((entry) => ({
      key: entry.agentId,
      category: "subagents",
      reason: entry.reason,
      target: "subagents",
    })),
    ...(refs?.eventStreams ?? []).map((entry) => ({
      key: entry.eventStream,
      category: "eventStreams",
      reason: entry.reason,
      target: "channels",
    })),
    ...(refs?.models ?? []).map((entry) => ({
      key: entry.model,
      category: "models",
      reason: entry.reason,
      target: "models",
    })),
  ];
}

function UnresolvedReferencesModal({
  agentId,
  open,
  refs,
  onClose,
}: {
  agentId: string;
  open: boolean;
  refs: DeckGoAgentUnresolvedReferences | null;
  onClose: () => void;
}) {
  const t = useTranslations("agentsPanel");
  const entries = unresolvedEntries(refs);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) {
      setAcknowledged(new Set());
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      aria-labelledby="agent-unresolved-title"
      aria-describedby="agent-unresolved-description"
    >
      <div className="agent-modal">
        <header>
          <h2 id="agent-unresolved-title">{t("unresolved.title")}</h2>
          <p id="agent-unresolved-description">{t("unresolved.description")}</p>
        </header>
        {entries.length === 0 ? <Banner>{t("unresolved.empty")}</Banner> : null}
        <div className="agent-option-list">
          {entries.map((entry) => {
            const entryKey = `${entry.category}:${entry.key}`;
            const isAcknowledged = acknowledged.has(entryKey);
            return (
              <div key={entryKey} className="agent-option-row agent-option-row--stacked">
                <div>
                  <strong>{entry.key}</strong>
                  <small>
                    {t(`unresolved.category.${entry.category}`)} · {entry.reason}
                  </small>
                </div>
                <div className="agent-section__actions">
                  {entry.category === "skills" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        window.location.href = `/?panel=skills&from=agents&fromAgent=${encodeURIComponent(agentId)}`;
                      }}
                    >
                      {t("unresolved.install")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = `/?panel=${entry.target}&from=agents&fromAgent=${encodeURIComponent(agentId)}`;
                    }}
                  >
                    {t("unresolved.openOwning")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setAcknowledged((current) => new Set([...current, entryKey]))}
                  >
                    {isAcknowledged ? t("unresolved.kept") : t("unresolved.keep")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <footer className="agent-modal__actions">
          <Button onClick={onClose}>{t("cancel")}</Button>
        </footer>
      </div>
    </Modal>
  );
}

function readDefaultsSectionFromHash(hash: string): AgentDefaultsSectionId {
  const section = readSectionFromHash(hash);
  return AGENT_DEFAULTS_SECTIONS.some((entry) => entry.id === section)
    ? (section as AgentDefaultsSectionId)
    : "overview";
}

function defaultsBucketForSection(
  section: AgentDefaultsSectionId,
): DeckGoAgentDefaultsBucket | null {
  if (section === "model") {
    return "cognition";
  }
  if (section === "delivery") {
    return "delivery";
  }
  if (
    section === "workspace" ||
    section === "skills" ||
    section === "subagents" ||
    section === "conversation"
  ) {
    return section;
  }
  return null;
}

function AgentDefaultsEditor({ onBack }: { onBack: () => void }) {
  const t = useTranslations("agentsPanel");
  const [section, setSection] = useState<AgentDefaultsSectionId>(() =>
    readDefaultsSectionFromHash(window.location.hash),
  );
  const changeSection = useCallback((next: AgentDefaultsSectionId) => {
    setSection(next);
    const url = new URL(window.location.href);
    url.hash = next;
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    const handleHash = () => setSection(readDefaultsSectionFromHash(window.location.hash));
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const bucket = defaultsBucketForSection(section);

  return (
    <section className="agents-detail" aria-label={t("defaults.title")}>
      <Button className="agents-detail__back" size="sm" variant="ghost" onClick={onBack}>
        {t("backToList")}
      </Button>
      <header className="agents-detail__hero">
        <div className="agents-detail__identity">
          <span
            className="agent-avatar agent-avatar--large agent-avatar--accent"
            aria-hidden="true"
          >
            D
          </span>
          <div className="agents-detail__identity-main">
            <h2>{t("defaults.title")}</h2>
            <p>{t("defaults.description")}</p>
            <div className="agent-meta-strip">
              <Chip>{t("defaults.schemaTruth")}</Chip>
              <Chip>{t("defaults.sectionsCount", { count: AGENT_DEFAULTS_SECTIONS.length })}</Chip>
            </div>
          </div>
        </div>
      </header>
      <nav className="agents-detail__tabs" role="tablist" aria-label={t("defaults.navLabel")}>
        {AGENT_DEFAULTS_SECTIONS.map((entry, index) => (
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
          <SectionCard title={t("sections.overview")} description={t("defaults.overview")}>
            <Banner>{t("defaults.schemaTruthLong")}</Banner>
          </SectionCard>
        ) : null}
        {section === "model" ? (
          <SectionCard title={t("sections.model")} description={t("defaults.modelDescription")}>
            <DefaultsBucketSummary bucket="cognition" />
            <AgentModelPolicyControls agentId="" context="defaults" isMainProtected={false} />
          </SectionCard>
        ) : null}
        {bucket && section !== "model" ? (
          <DefaultsBucketSection bucket={bucket} section={section} />
        ) : null}
      </main>
    </section>
  );
}

function DefaultsBucketSummary({ bucket }: { bucket: DeckGoAgentDefaultsBucket }) {
  const t = useTranslations("agentsPanel");
  const query = useAgentsDefaults(bucket);
  if (query.isPending) {
    return <LoadingRows label={t("loading")} />;
  }
  if (query.error) {
    return <Banner variant="error">{formatAgentError(query.error)}</Banner>;
  }
  const entries = Object.entries(query.data?.value ?? {});
  return (
    <div className="agent-option-list">
      {entries.length === 0 ? <p>{t("defaults.emptyBucket")}</p> : null}
      {entries.map(([key, value]) => (
        <div key={key} className="agent-preview-row">
          <strong>{key}</strong>
          <code>{formatConfigValue(value)}</code>
        </div>
      ))}
    </div>
  );
}

function DefaultsBucketSection({
  bucket,
  section,
}: {
  bucket: DeckGoAgentDefaultsBucket;
  section: AgentDefaultsSectionId;
}) {
  const t = useTranslations("agentsPanel");
  const query = useAgentsDefaults(bucket);
  const saveMutation = useSaveAgentsDefaultsMutation();
  const descriptors = defaultsFieldDescriptors(bucket);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [baseline, setBaseline] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = buildDefaultsDraft(descriptors, query.data?.value ?? {});
    setDraft(next);
    setBaseline(next);
    setError(null);
  }, [descriptors, query.data?.value]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const saveDefaults = useCallback(async () => {
    if (!query.data?.baseHash) {
      setError(t("errors.hashRequired"));
      return;
    }
    try {
      const value = parseDefaultsDraft(descriptors, draft);
      setError(null);
      await saveMutation.mutateAsync({ bucket, baseHash: query.data.baseHash, value });
      await query.refetch();
    } catch (err) {
      setError(formatAgentError(err));
    }
  }, [bucket, descriptors, draft, query, saveMutation, t]);

  const resetField = useCallback(
    async (field: string) => {
      if (!query.data?.baseHash) {
        setError(t("errors.hashRequired"));
        return;
      }
      try {
        setError(null);
        await saveMutation.mutateAsync({
          bucket,
          baseHash: query.data.baseHash,
          reset: [field],
          value: {},
        });
        await query.refetch();
      } catch (err) {
        setError(formatAgentError(err));
      }
    },
    [bucket, query, saveMutation, t],
  );

  return (
    <SectionCard title={t(`sections.${section}`)} description={t("defaults.bucketDescription")}>
      {query.isPending ? <LoadingRows label={t("loading")} /> : null}
      {query.error ? <Banner variant="error">{formatAgentError(query.error)}</Banner> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {section === "workspace" ? <Banner>{t("defaults.workspaceAbsentFields")}</Banner> : null}
      {section === "conversation" ? (
        <Banner>{t("defaults.conversationAbsentFields")}</Banner>
      ) : null}
      {!query.isPending && !query.error ? (
        <>
          <div className="agent-option-list">
            {descriptors.map((descriptor) => (
              <div key={descriptor.key} className="agent-option-row agent-option-row--stacked">
                <div>
                  <strong>{descriptor.label}</strong>
                  <small>{descriptor.key}</small>
                </div>
                {descriptor.type === "boolean" ? (
                  <Toggle
                    aria-label={descriptor.label}
                    checked={draft[descriptor.key] === true}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, [descriptor.key]: checked }))
                    }
                  />
                ) : descriptor.type === "json" || descriptor.type === "stringList" ? (
                  <Textarea
                    aria-label={descriptor.label}
                    rows={descriptor.type === "json" ? 5 : 3}
                    value={String(draft[descriptor.key] ?? "")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [descriptor.key]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    aria-label={descriptor.label}
                    value={String(draft[descriptor.key] ?? "")}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [descriptor.key]: event.target.value,
                      }))
                    }
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saveMutation.isPending}
                  onClick={() => void resetField(descriptor.key)}
                >
                  {t("reset")}
                </Button>
              </div>
            ))}
          </div>
          <footer className="agent-section__actions">
            <Button
              disabled={!dirty || saveMutation.isPending}
              variant="primary"
              onClick={() => void saveDefaults()}
            >
              {saveMutation.isPending ? t("saving") : t("saveChanges")}
            </Button>
          </footer>
        </>
      ) : null}
    </SectionCard>
  );
}

type DefaultsFieldDescriptor = {
  key: string;
  label: string;
  type: "boolean" | "json" | "string" | "stringList";
};

const DEFAULTS_FIELD_DESCRIPTORS: Record<DeckGoAgentDefaultsBucket, DefaultsFieldDescriptor[]> = {
  cognition: [
    { key: "thinkingDefault", label: "thinkingDefault", type: "string" },
    { key: "verboseDefault", label: "verboseDefault", type: "string" },
    { key: "reasoningDefault", label: "reasoningDefault", type: "string" },
    { key: "fastModeDefault", label: "fastModeDefault", type: "boolean" },
    { key: "memorySearch", label: "memorySearch", type: "json" },
  ],
  workspace: [
    { key: "workspace", label: "workspace", type: "string" },
    { key: "sandbox", label: "sandbox", type: "json" },
    { key: "embeddedHarness", label: "embeddedHarness", type: "json" },
    { key: "embeddedPi", label: "embeddedPi", type: "json" },
    { key: "params", label: "params", type: "json" },
  ],
  skills: [{ key: "skills", label: "skills", type: "stringList" }],
  subagents: [{ key: "subagents", label: "subagents", type: "json" }],
  conversation: [
    { key: "systemPromptOverride", label: "systemPromptOverride", type: "string" },
    { key: "humanDelay", label: "humanDelay", type: "json" },
  ],
  eventStreams: [{ key: "eventStreams", label: "eventStreams", type: "stringList" }],
  delivery: [
    { key: "eventStreams", label: "eventStreams", type: "stringList" },
    { key: "heartbeat", label: "heartbeat", type: "json" },
  ],
};

function defaultsFieldDescriptors(bucket: DeckGoAgentDefaultsBucket) {
  return DEFAULTS_FIELD_DESCRIPTORS[bucket] ?? [];
}

function buildDefaultsDraft(
  descriptors: DefaultsFieldDescriptor[],
  value: Record<string, unknown>,
): Record<string, string | boolean> {
  return Object.fromEntries(
    descriptors.map((descriptor) => [
      descriptor.key,
      formatDefaultsDraftValue(descriptor, value[descriptor.key]),
    ]),
  );
}

function formatDefaultsDraftValue(descriptor: DefaultsFieldDescriptor, value: unknown) {
  if (descriptor.type === "boolean") {
    return value === true;
  }
  if (descriptor.type === "stringList") {
    return Array.isArray(value) ? value.join("\n") : "";
  }
  if (descriptor.type === "json") {
    if (value === null || value === undefined) {
      return "";
    }
    return JSON.stringify(value, null, 2);
  }
  return typeof value === "string" ? value : "";
}

function parseDefaultsDraft(
  descriptors: DefaultsFieldDescriptor[],
  draft: Record<string, string | boolean>,
) {
  const value: Record<string, unknown> = {};
  for (const descriptor of descriptors) {
    const draftValue = draft[descriptor.key];
    if (descriptor.type === "boolean") {
      value[descriptor.key] = draftValue === true;
      continue;
    }
    const text = String(draftValue ?? "").trim();
    if (!text) {
      continue;
    }
    if (descriptor.type === "json") {
      value[descriptor.key] = JSON.parse(text) as unknown;
      continue;
    }
    if (descriptor.type === "stringList") {
      value[descriptor.key] = text
        .split("\n")
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }
    value[descriptor.key] = text;
  }
  return value;
}

function formatConfigValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value || "-";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function impactCount(
  impact: DeckGoAgentImpactSummary | null | undefined,
  bucket: "bindings" | "sessions" | "files",
) {
  if (bucket === "bindings") {
    return impact?.bindings?.count ?? impact?.bindingCount;
  }
  if (bucket === "sessions") {
    return impact?.sessions?.total ?? impact?.sessionCount;
  }
  return impact?.files?.total ?? impact?.workspaceFileCount;
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

function ModelSection({
  agent,
  detail,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
}) {
  const t = useTranslations("agentsPanel");
  const isProtected = Boolean(detail?.isMainProtected ?? agent.isMainProtected);
  return (
    <SectionCard title={t("sections.model")} description={t("model.description")}>
      {isProtected ? <Banner variant="warn">{t("model.protectedMain")}</Banner> : null}
      <div className="agent-impact-grid">
        <div>
          <span>{t("runtime.modelSource")}</span>
          <strong>
            <SourceBadge detail={detail} field="thinkingDefault" />
          </strong>
        </div>
        <div>
          <span>{t("runtime.reasoning")}</span>
          <strong>{detail?.reasoningDefault ?? t("unknown")}</strong>
        </div>
        <div>
          <span>{t("model.thinking")}</span>
          <strong>{detail?.thinkingDefault ?? t("unknown")}</strong>
        </div>
        <div>
          <span>{t("runtime.fastMode")}</span>
          <strong>{detail?.fastModeDefault === true ? t("yes") : t("no")}</strong>
        </div>
      </div>
      <AgentModelPolicyControls
        agentId={agent.id}
        context="agent"
        isMainProtected={isProtected}
        effectiveModel={detail?.model ?? agent.model}
      />
    </SectionCard>
  );
}

function WorkspaceSection({
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
  const isProtected = Boolean(detail?.isMainProtected ?? agent.isMainProtected);
  const [impactConfirmed, setImpactConfirmed] = useState(false);
  const [mainConfirmed, setMainConfirmed] = useState(false);
  const impactQuery = useAgentsImpactPreview(
    { agentId: agent.id, operation: "edit-workspace" },
    { enabled: dirty },
  );

  useEffect(() => {
    if (!dirty) {
      setImpactConfirmed(false);
      setMainConfirmed(false);
    }
  }, [dirty]);

  const saveBlocked =
    dirty && (!impactQuery.data || !impactConfirmed || (isProtected && !mainConfirmed));

  return (
    <SectionCard title={t("sections.workspace")} description={t("workspace.description")}>
      {error ? <Banner variant="error">{error}</Banner> : null}
      {isProtected ? <Banner variant="warn">{t("workspace.protectedMain")}</Banner> : null}
      <div className="agent-impact-grid">
        <div>
          <span>{t("runtime.workspaceSource")}</span>
          <strong>
            <SourceBadge detail={detail} field="workspace" />
          </strong>
        </div>
        <div>
          <span>{t("workspace.agentDir")}</span>
          <strong>{detail?.agentDir ?? t("inherit")}</strong>
        </div>
        <div>
          <span>{t("workspace.runtime")}</span>
          <strong>{detail?.runtime ? t("workspace.runtimeConfigured") : t("inherit")}</strong>
        </div>
      </div>
      <div className="agent-form-grid">
        <label>
          <span>{t("fields.workspace")}</span>
          <Input
            value={draft.workspace}
            onChange={(event) => update({ workspace: event.target.value })}
          />
        </label>
      </div>
      <div className="agent-guarded-list" aria-label={t("runtime.guardsLabel")}>
        {(detail?.guardedEdits ?? []).map((guard) => (
          <div key={guard.field} className="agent-preview-row">
            <strong>{guard.field}</strong>
            <Badge variant={guard.risk === "high" ? "warn" : "neutral"}>{guard.risk}</Badge>
            <small>{guard.reason}</small>
          </div>
        ))}
      </div>
      {dirty ? (
        <div className="agent-risk-checklist" role="group" aria-label={t("risk.confirmLabel")}>
          {impactQuery.isPending ? (
            <Banner>
              <Spinner size="sm" aria-label={t("loading")} />
              {t("impact.loading")}
            </Banner>
          ) : null}
          {impactQuery.error ? (
            <Banner variant="error">{formatAgentError(impactQuery.error)}</Banner>
          ) : null}
          <RiskSpecificsList items={impactQuery.data?.riskSpecifics ?? []} />
          {isProtected ? (
            <label className="agent-checkbox-row">
              <input
                type="checkbox"
                checked={mainConfirmed}
                disabled={!impactQuery.data}
                onChange={(event) => setMainConfirmed(event.currentTarget.checked)}
              />
              <span>{t("risk.confirmMain")}</span>
            </label>
          ) : null}
          <label className="agent-checkbox-row">
            <input
              type="checkbox"
              checked={impactConfirmed}
              disabled={!impactQuery.data}
              onChange={(event) => setImpactConfirmed(event.currentTarget.checked)}
            />
            <span>{t("risk.confirmImpact")}</span>
          </label>
        </div>
      ) : null}
      <footer className="agent-section__actions">
        <Button
          variant="primary"
          disabled={!dirty || saving || saveBlocked}
          onClick={() => void onSave()}
        >
          {saving ? t("saving") : t("workspace.saveGuarded")}
        </Button>
      </footer>
    </SectionCard>
  );
}

type ModelPolicyDraft = {
  mode: "inherit" | "explicit";
  primary: string;
  fallbacks: string[];
};

function policyIdentity(policy: DeckGoAgentModelPolicyEntry) {
  return `${policy.kind}:${policy.key}`;
}

function orderedPolicyEntries(data: DeckGoAgentModelPolicyResponse | null) {
  const policies = data?.policies ?? [];
  const agentPolicies = policies.filter((policy) => policy.kind !== "global-default");
  const globalPolicies = policies.filter((policy) => policy.kind === "global-default");
  return { agentPolicies, globalPolicies };
}

function draftFromPolicy(policy: DeckGoAgentModelPolicyEntry): ModelPolicyDraft {
  const selection = policy.selection ?? policy.effective;
  return {
    mode: policy.kind === "global-default" || policy.selection ? "explicit" : "inherit",
    primary: selection?.primary ?? "",
    fallbacks: selection?.fallbacks ?? [],
  };
}

function sameRefs(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isPolicyDraftDirty(policy: DeckGoAgentModelPolicyEntry, draft: ModelPolicyDraft) {
  if (policy.kind !== "global-default" && draft.mode === "inherit") {
    return Boolean(policy.selection);
  }
  const selection = policy.selection;
  return (
    draft.primary.trim() !== (selection?.primary ?? "") ||
    !sameRefs(draft.fallbacks, selection?.fallbacks ?? [])
  );
}

function policyTarget(
  policy: DeckGoAgentModelPolicyEntry,
  agentId: string,
): DeckGoAgentModelPolicyTarget {
  return {
    kind: policy.kind,
    key: policy.key,
    ...(policy.kind === "global-default" ? {} : { agentId }),
  };
}

function cleanModelSelection(
  draft: ModelPolicyDraft,
  supportsFallbacks: boolean,
): DeckGoAgentModelSelection {
  return {
    primary: draft.primary.trim(),
    ...(supportsFallbacks
      ? { fallbacks: draft.fallbacks.map((ref) => ref.trim()).filter(Boolean) }
      : {}),
  };
}

function modelChoiceLabel(choice: DeckGoAgentModelChoice) {
  return choice.name && choice.name !== choice.model
    ? `${choice.name} · ${choice.ref}`
    : choice.ref;
}

function policyDisplayLabel(
  t: ReturnType<typeof useTranslations>,
  policy: DeckGoAgentModelPolicyEntry,
) {
  const key =
    policy.kind === "agent-model"
      ? "agent"
      : policy.kind === "agent-subagents"
        ? "agentSubagents"
        : policy.key;
  return t(`modelPolicy.targets.${key}`);
}

function ModelRefInput({
  choices,
  label,
  onChange,
  value,
}: {
  choices: readonly DeckGoAgentModelChoice[];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const hasChoice = choices.some((choice) => choice.ref === value);
  if (choices.length === 0) {
    return (
      <Input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    );
  }
  return (
    <Select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      <option value="">{label}</option>
      {value && !hasChoice ? <option value={value}>{value}</option> : null}
      {choices.map((choice) => (
        <option key={choice.ref} value={choice.ref}>
          {modelChoiceLabel(choice)}
        </option>
      ))}
    </Select>
  );
}

function AgentModelPolicyControls({
  agentId,
  context,
  effectiveModel,
  isMainProtected,
}: {
  agentId: string;
  context: "agent" | "defaults";
  effectiveModel?: string;
  isMainProtected: boolean;
}) {
  const t = useTranslations("agentsPanel");
  const policyQuery = useAgentModelPolicyQuery(agentId);
  const savePolicyMutation = useSaveAgentModelPolicyMutation();
  const data = policyQuery.data ?? null;
  const [drafts, setDrafts] = useState<Record<string, ModelPolicyDraft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setDrafts(
      Object.fromEntries(
        data.policies.map((policy) => [policyIdentity(policy), draftFromPolicy(policy)]),
      ),
    );
    setError(null);
    setConflict(false);
  }, [data]);

  const choices = data?.configuredModels ?? [];
  const { agentPolicies, globalPolicies } = orderedPolicyEntries(data);

  const updateDraft = useCallback(
    (policy: DeckGoAgentModelPolicyEntry, patch: Partial<ModelPolicyDraft>) => {
      const id = policyIdentity(policy);
      setDrafts((current) => ({
        ...current,
        [id]: {
          ...(current[id] ?? draftFromPolicy(policy)),
          ...patch,
        },
      }));
    },
    [],
  );

  const savePolicy = useCallback(
    async (policy: DeckGoAgentModelPolicyEntry) => {
      if (!data) {
        return;
      }
      const id = policyIdentity(policy);
      const draft = drafts[id] ?? draftFromPolicy(policy);
      const supportsFallbacks = policy.supportedShape === "agentModelConfig";
      const clear = policy.kind !== "global-default" && draft.mode === "inherit";
      const selection = cleanModelSelection(draft, supportsFallbacks);
      if (!clear && !selection.primary) {
        setError(t("modelPolicy.primaryRequired"));
        return;
      }
      const confirmText = isMainProtected
        ? t("modelPolicy.confirmMain")
        : t("modelPolicy.confirmRuntime");
      if (!window.confirm(confirmText)) {
        return;
      }
      setSavingKey(id);
      setError(null);
      setConflict(false);
      try {
        await savePolicyMutation.mutateAsync({
          target: policyTarget(policy, agentId),
          baseHash: data.configHash,
          ...(clear ? { clear: true } : { selection }),
        });
        await policyQuery.refetch();
      } catch (err) {
        setConflict(isConflictError(err));
        setError(formatAgentError(err));
      } finally {
        setSavingKey(null);
      }
    },
    [agentId, data, drafts, isMainProtected, policyQuery, savePolicyMutation, t],
  );

  const openDefaultsModel = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("panel", "agents");
    url.searchParams.set("view", "defaults");
    url.searchParams.delete("agent");
    url.hash = "model";
    window.location.href = url.toString();
  }, []);

  const openModels = useCallback(() => {
    window.location.href = `/?panel=models&from=agents${agentId ? `&fromAgent=${encodeURIComponent(agentId)}` : ""}`;
  }, [agentId]);

  const renderReadOnlyPolicy = (policy: DeckGoAgentModelPolicyEntry) => (
    <div key={policyIdentity(policy)} className="agent-model-policy-row">
      <div className="agent-model-policy-row__header">
        <div>
          <strong>{policyDisplayLabel(t, policy)}</strong>
          <small>{policy.configPath}</small>
        </div>
        <div className="agent-meta-strip">
          <Badge variant="neutral">{t("modelPolicy.readOnly")}</Badge>
          <Badge variant={policy.source === "missing" ? "warn" : "neutral"}>
            {t(`modelPolicy.source.${policy.source}`)}
          </Badge>
        </div>
      </div>
      <Banner>
        {t("modelPolicy.manageInDefaults", {
          value: policy.effective?.primary ?? policy.selection?.primary ?? t("missingModel"),
        })}
      </Banner>
      <footer className="agent-section__actions">
        <Button onClick={openDefaultsModel}>{t("modelPolicy.manageDefaults")}</Button>
        <Button onClick={openModels}>{t("modelPolicy.manageProviders")}</Button>
      </footer>
    </div>
  );

  const renderUnsupportedPolicy = (policy: { configPath: string; reason: string }) => (
    <div key={policy.configPath} className="agent-model-policy-row">
      <div className="agent-model-policy-row__header">
        <div>
          <strong>{policy.configPath}</strong>
          <small>{policy.reason}</small>
        </div>
        <Badge variant="warn">{t("modelPolicy.schemaAbsent")}</Badge>
      </div>
      <Banner>{t("modelPolicy.summaryReadonly")}</Banner>
    </div>
  );

  const renderEditablePolicy = (policy: DeckGoAgentModelPolicyEntry) => {
    const id = policyIdentity(policy);
    const draft = drafts[id] ?? draftFromPolicy(policy);
    const supportsFallbacks = policy.supportedShape === "agentModelConfig";
    const dirty = isPolicyDraftDirty(policy, draft);
    const disabled = savingKey === id || !policy.editable;
    const unavailableRefs = policy.unavailableRefs ?? [];

    return (
      <div key={id} className="agent-model-policy-row">
        <div className="agent-model-policy-row__header">
          <div>
            <strong>{policyDisplayLabel(t, policy)}</strong>
            <small>{policy.configPath}</small>
          </div>
          <div className="agent-meta-strip">
            <Badge variant={policy.source === "missing" ? "warn" : "neutral"}>
              {t(`modelPolicy.source.${policy.source}`)}
            </Badge>
            <Badge variant={supportsFallbacks ? "ok" : "neutral"}>
              {supportsFallbacks
                ? t("modelPolicy.fallbackSupported")
                : t("modelPolicy.primaryOnly")}
            </Badge>
          </div>
        </div>

        {policy.kind !== "global-default" ? (
          <SegmentedControl
            aria-label={t("modelPolicy.modeLabel")}
            value={draft.mode}
            onChange={(value) =>
              updateDraft(policy, { mode: value === "inherit" ? "inherit" : "explicit" })
            }
            items={[
              { value: "inherit", label: t("modelPolicy.inherit") },
              { value: "explicit", label: t("modelPolicy.override") },
            ]}
          />
        ) : null}

        {draft.mode === "inherit" && policy.kind !== "global-default" ? (
          <Banner>
            {t("modelPolicy.inheritedCopy", {
              value: policy.effective?.primary ?? effectiveModel ?? t("missingModel"),
            })}
          </Banner>
        ) : (
          <div className="agent-model-policy-editor">
            <label>
              <span>{t("modelPolicy.primary")}</span>
              <ModelRefInput
                choices={choices}
                label={t("modelPolicy.selectPrimary")}
                value={draft.primary}
                onChange={(value) => updateDraft(policy, { primary: value })}
              />
            </label>
            {supportsFallbacks ? (
              <div className="agent-model-policy-fallbacks">
                <span>{t("modelPolicy.fallbacks")}</span>
                {draft.fallbacks.length === 0 ? <p>{t("modelPolicy.noFallbacks")}</p> : null}
                {draft.fallbacks.map((fallback, index) => (
                  <div key={`${id}:${index}`} className="agent-model-policy-fallback-row">
                    <ModelRefInput
                      choices={choices}
                      label={t("modelPolicy.selectFallback")}
                      value={fallback}
                      onChange={(value) =>
                        updateDraft(policy, {
                          fallbacks: draft.fallbacks.map((entry, entryIndex) =>
                            entryIndex === index ? value : entry,
                          ),
                        })
                      }
                    />
                    <Button
                      size="sm"
                      disabled={index === 0}
                      onClick={() =>
                        updateDraft(policy, {
                          fallbacks: draft.fallbacks.map((entry, entryIndex, entries) =>
                            entryIndex === index - 1
                              ? entries[index]
                              : entryIndex === index
                                ? entries[index - 1]
                                : entry,
                          ),
                        })
                      }
                    >
                      {t("modelPolicy.moveUp")}
                    </Button>
                    <Button
                      size="sm"
                      disabled={index === draft.fallbacks.length - 1}
                      onClick={() =>
                        updateDraft(policy, {
                          fallbacks: draft.fallbacks.map((entry, entryIndex, entries) =>
                            entryIndex === index
                              ? entries[index + 1]
                              : entryIndex === index + 1
                                ? entries[index]
                                : entry,
                          ),
                        })
                      }
                    >
                      {t("modelPolicy.moveDown")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        updateDraft(policy, {
                          fallbacks: draft.fallbacks.filter(
                            (_, entryIndex) => entryIndex !== index,
                          ),
                        })
                      }
                    >
                      {t("modelPolicy.removeFallback")}
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={() =>
                    updateDraft(policy, {
                      fallbacks: [...draft.fallbacks, choices[0]?.ref ?? ""],
                    })
                  }
                >
                  {t("modelPolicy.addFallback")}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {unavailableRefs.length > 0 ? (
          <Banner variant="warn">
            {t("modelPolicy.unavailable", { refs: unavailableRefs.join(", ") })}
          </Banner>
        ) : null}

        <footer className="agent-section__actions">
          <Button disabled={savingKey !== null} onClick={() => void policyQuery.refetch()}>
            {t("reload")}
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || disabled || savingKey !== null}
            onClick={() => void savePolicy(policy)}
          >
            {savingKey === id ? t("saving") : t("modelPolicy.savePolicy")}
          </Button>
        </footer>
      </div>
    );
  };

  const visibleAgentPolicies = context === "agent" ? agentPolicies : [];
  const readOnlyGlobalPolicies = context === "agent" ? globalPolicies : [];
  const editableGlobalPolicies = context === "defaults" ? globalPolicies : [];

  return (
    <div className="agent-model-policy">
      <header className="agent-model-policy__title">
        <div>
          <h4>{t("modelPolicy.title")}</h4>
          <p>{t("modelPolicy.description")}</p>
        </div>
      </header>
      {policyQuery.isPending ? <LoadingRows label={t("loading")} /> : null}
      {policyQuery.error ? (
        <Banner variant="error">{formatAgentError(policyQuery.error)}</Banner>
      ) : null}
      {error ? (
        <Banner variant={conflict ? "warn" : "error"}>
          <strong>{conflict ? t("errors.conflictTitle") : t("errors.saveTitle")}</strong>
          <span>{error}</span>
        </Banner>
      ) : null}
      {choices.length === 0 && data ? (
        <Banner variant="warn">{t("modelPolicy.noConfiguredModels")}</Banner>
      ) : null}
      {data?.unsupported.length ? (
        <div className="agent-model-policy__group">
          <h5>{t("modelPolicy.unsupportedGroup")}</h5>
          {data.unsupported.map(renderUnsupportedPolicy)}
        </div>
      ) : null}
      {visibleAgentPolicies.length > 0 ? (
        <div className="agent-model-policy__group">
          <h5>{t("modelPolicy.agentGroup")}</h5>
          {visibleAgentPolicies.map(renderEditablePolicy)}
        </div>
      ) : null}
      {readOnlyGlobalPolicies.length > 0 ? (
        <div className="agent-model-policy__group">
          <h5>{t("modelPolicy.globalGroup")}</h5>
          {readOnlyGlobalPolicies.map(renderReadOnlyPolicy)}
        </div>
      ) : null}
      {editableGlobalPolicies.length > 0 ? (
        <div className="agent-model-policy__group">
          <h5>{t("modelPolicy.globalGroup")}</h5>
          {editableGlobalPolicies.map(renderEditablePolicy)}
        </div>
      ) : null}
    </div>
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
  agent,
  detail,
  rows,
  allowAny,
  requireAgentId,
  loaded,
  dirty,
  saving,
  error,
  conflict,
  onReload,
  onAllowAnyChange,
  onRequireAgentIdChange,
  onRowsChange,
  onSave,
}: {
  agent: Agent;
  detail: DeckGoAgentDetailResponse | null;
  rows: DeckGoAgentSubagentPermissionOption[];
  allowAny: boolean;
  requireAgentId: boolean;
  loaded: boolean;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  conflict: boolean;
  onReload: () => Promise<void>;
  onAllowAnyChange: (allowAny: boolean) => void;
  onRequireAgentIdChange: (requireAgentId: boolean) => void;
  onRowsChange: (rows: DeckGoAgentSubagentPermissionOption[]) => void;
  onSave: () => Promise<void>;
}) {
  const t = useTranslations("agentsPanel");
  const isProtected = Boolean(detail?.isMainProtected ?? agent.isMainProtected);
  const [impactConfirmed, setImpactConfirmed] = useState(false);
  const [mainConfirmed, setMainConfirmed] = useState(false);
  const impactQuery = useAgentsImpactPreview(
    { agentId: agent.id, operation: "edit-subagents" },
    { enabled: loaded && dirty },
  );

  useEffect(() => {
    if (!dirty) {
      setImpactConfirmed(false);
      setMainConfirmed(false);
    }
  }, [dirty]);

  const saveBlocked =
    dirty && (!impactQuery.data || !impactConfirmed || (isProtected && !mainConfirmed));

  return (
    <SectionCard title={t("sections.subagents")} description={t("subagents.description")}>
      {isProtected ? <Banner variant="warn">{t("subagents.protectedMain")}</Banner> : null}
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
          <Banner>{t("subagents.modelPolicyMoved")}</Banner>
          <div className="agent-option-row agent-option-row--stacked">
            <div>
              <strong>{t("subagents.requireAgentId")}</strong>
              <small>{t("subagents.requireAgentIdDescription")}</small>
            </div>
            <Toggle
              aria-label={t("subagents.requireAgentId")}
              checked={requireAgentId}
              onCheckedChange={onRequireAgentIdChange}
            />
          </div>
          <div className="agent-meta-strip">
            <SourceBadge detail={detail} field="subagentsAllowAgents" />
            <SourceBadge detail={detail} field="subagentsRequireAgentId" />
          </div>
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
          {dirty ? (
            <div className="agent-risk-checklist" role="group" aria-label={t("risk.confirmLabel")}>
              {impactQuery.isPending ? (
                <Banner>
                  <Spinner size="sm" aria-label={t("loading")} />
                  {t("impact.loading")}
                </Banner>
              ) : null}
              {impactQuery.error ? (
                <Banner variant="error">{formatAgentError(impactQuery.error)}</Banner>
              ) : null}
              <RiskSpecificsList items={impactQuery.data?.riskSpecifics ?? []} />
              {isProtected ? (
                <label className="agent-checkbox-row">
                  <input
                    type="checkbox"
                    checked={mainConfirmed}
                    disabled={!impactQuery.data}
                    onChange={(event) => setMainConfirmed(event.currentTarget.checked)}
                  />
                  <span>{t("risk.confirmMain")}</span>
                </label>
              ) : null}
              <label className="agent-checkbox-row">
                <input
                  type="checkbox"
                  checked={impactConfirmed}
                  disabled={!impactQuery.data}
                  onChange={(event) => setImpactConfirmed(event.currentTarget.checked)}
                />
                <span>{t("risk.confirmImpact")}</span>
              </label>
            </div>
          ) : null}
          <footer className="agent-section__actions">
            <Button disabled={saving} onClick={() => void onReload()}>
              {t("reload")}
            </Button>
            <Button
              variant="primary"
              disabled={!dirty || saving || saveBlocked}
              onClick={() => void onSave()}
            >
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
    <SectionCard title={t("sections.delivery")} description={t("delivery.description")}>
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
    <SectionCard title={t("sections.tools")} description={t("tools.description")}>
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
    <SectionCard title={t("sections.conversation")} description={t("conversation.description")}>
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
  const impact = detail?.impact;
  const bindingCount =
    impactCount(impact, "bindings") ?? detail?.bindingCount ?? agent.bindingCount;
  const sessionCount =
    impactCount(impact, "sessions") ?? detail?.sessionCount ?? agent.sessionCount;
  const samples = impact?.bindings?.samples ?? [];
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
      <div className="agent-option-list">
        {samples.length === 0 ? <p>{t("routing.noSamples")}</p> : null}
        {samples.map((sample) => (
          <div key={sample.bindingIndex} className="agent-preview-row">
            <strong>
              {sample.summary ??
                sample.type ??
                t("routing.binding", { index: sample.bindingIndex })}
            </strong>
            <span>
              {[sample.channel, sample.accountId, sample.guildId, sample.teamId]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {sample.peer ? <code>{formatConfigValue(sample.peer)}</code> : null}
          </div>
        ))}
      </div>
      {impact?.bindings?.truncated ? <Banner>{t("routing.truncated")}</Banner> : null}
      <Banner>{t("routing.ownerCopy")}</Banner>
      <footer className="agent-section__actions">
        <Button
          onClick={() => {
            window.location.href = `/?panel=routing&from=agents&fromAgent=${encodeURIComponent(agent.id)}`;
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
  const impactQuery = useAgentsImpactPreview(
    { agentId: agent?.id ?? "", operation: "delete-agent" },
    { enabled: Boolean(agent && !isProtectedAgentDeleteTarget(agent)) },
  );
  const [typedAgentId, setTypedAgentId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) {
      setDeleting(false);
      setError(null);
      setTypedAgentId("");
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
    if (typedAgentId !== agent.id) {
      setError(t("delete.idMismatch"));
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAgentMutation.mutateAsync({ agent, confirmAgentId: typedAgentId });
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
          <>
            <Banner variant="warn">{t("danger.deleteImpact")}</Banner>
            {impactQuery.isPending ? (
              <Banner>
                <Spinner size="sm" aria-label={t("loading")} />
                {t("impact.loading")}
              </Banner>
            ) : null}
            {impactQuery.error ? (
              <Banner variant="error">{formatAgentError(impactQuery.error)}</Banner>
            ) : null}
            <RiskSpecificsList items={impactQuery.data?.riskSpecifics ?? []} />
            <label>
              <span>{t("delete.confirmIdLabel")}</span>
              <Input
                value={typedAgentId}
                onChange={(event) => setTypedAgentId(event.currentTarget.value)}
              />
            </label>
            {agent && typedAgentId && typedAgentId !== agent.id ? (
              <Banner variant="warn">{t("delete.idMismatch")}</Banner>
            ) : null}
          </>
        )}
        <footer className="agent-modal__actions">
          <Button onClick={onCancel}>{t("cancel")}</Button>
          <Button
            variant="danger"
            disabled={
              deleting ||
              isProtectedAgentDeleteTarget(agent) ||
              !impactQuery.data ||
              !agent ||
              typedAgentId !== agent.id
            }
            onClick={() => void confirm()}
          >
            {deleting ? t("saving") : t("delete.confirm")}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

function RiskSpecificsList({ items }: { items: string[] }) {
  const t = useTranslations("agentsPanel");
  if (items.length === 0) {
    return <Banner>{t("impact.noSpecifics")}</Banner>;
  }
  return (
    <ul className="agent-risk-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

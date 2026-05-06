import { useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  DeckGoAgentSkillsResponse,
  DeckGoAgentSummary,
  DeckGoSkillEntry,
  DeckGoSkillHubDetailResponse,
  DeckGoSkillHubSearchResult,
  DeckGoSkillsResponse,
} from "../../../api";
import {
  fetchAgentSkills,
  fetchAgentsList,
  fetchSkillHubBins,
  fetchSkillHubDetail,
  fetchSkills,
  installSkill,
  installSkillHub,
  searchSkillHub,
  updateAgentSkills,
  updateSkill,
  updateSkillHub,
} from "../../../api";
import { navigateToAgent } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  IconAlert,
  IconArrowL,
  IconArrowR,
  IconBolt,
  IconCheck,
  IconClock,
  IconFile,
  IconHash,
  IconInfo,
  IconRefresh,
  IconSearch,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import {
  formatHubDate,
  normalizeAgentSkillMode,
  normalizeSkill,
  sortSkillKeys,
  type PanelState,
  type SkillStatus,
  type SkillStatusFilter,
} from "./skill-model";
import { SkillMatrixTab } from "./SkillMatrixTab";
import { SkillMetric } from "./SkillMetric";
import "./skills-panel.css";

type SkillsMode = "installed" | "hub";
type SourceFilter = DeckGoSkillEntry["source"] | "all";
type DetailTab = "overview" | "setup" | "triggers" | "bins" | "files" | "audit";
type ActiveDialog = "configure" | "install" | "disable" | "files" | "hub-detail" | null;

const STATUS_FILTERS: SkillStatusFilter[] = ["all", "ready", "needs-setup", "disabled"];
const SOURCE_FILTERS: SourceFilter[] = ["all", "bundled", "managed", "plugin"];
const DETAIL_TABS: DetailTab[] = ["overview", "setup", "triggers", "bins", "files", "audit"];

export function SkillsPanel() {
  const t = useTranslations("skills");
  const ui = useDeckUI();
  const [payload, setPayload] = useState<DeckGoSkillsResponse | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState("");
  const [view, setView] = useState<"list" | "detail">("list");
  const [mode, setMode] = useState<SkillsMode>("installed");
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "installing" | "updating">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [envDraft, setEnvDraft] = useState("{}");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [hubBins, setHubBins] = useState<string[]>([]);
  const [selectedHubBin, setSelectedHubBin] = useState("");
  const [hubResults, setHubResults] = useState<DeckGoSkillHubSearchResult[]>([]);
  const [hubDetail, setHubDetail] = useState<DeckGoSkillHubDetailResponse | null>(null);
  const [hubState, setHubState] = useState<PanelState>("idle");
  const [hubDetailState, setHubDetailState] = useState<PanelState>("idle");
  const [hubActionState, setHubActionState] = useState<"idle" | "installing" | "updating">("idle");
  const [hubActionResult, setHubActionResult] = useState<unknown>(null);
  const [hubError, setHubError] = useState("");
  const [agents, setAgents] = useState<DeckGoAgentSummary[]>([]);
  const [agentSkillsByAgent, setAgentSkillsByAgent] = useState<
    Record<string, DeckGoAgentSkillsResponse>
  >({});
  const [matrixState, setMatrixState] = useState<PanelState>("idle");
  const [matrixActionKey, setMatrixActionKey] = useState("");
  const [matrixActionResult, setMatrixActionResult] = useState<unknown>(null);
  const [matrixError, setMatrixError] = useState("");

  const refresh = async (preferredSkillKey?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchSkills();
      setPayload(next);
      setLoadState("ready");
      setError("");
      const normalized = (next.skills ?? []).map(normalizeSkill);
      const preferred = preferredSkillKey?.trim();
      setSelectedSkillKey((current) => {
        if (preferred && normalized.some((skill) => skill.key === preferred)) {
          return preferred;
        }
        if (current && normalized.some((skill) => skill.key === current)) {
          return current;
        }
        return normalized[0]?.key ?? "";
      });
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load skills");
    }
  };

  const refreshAgentSkillMatrix = async () => {
    setMatrixState("loading");
    setMatrixError("");
    try {
      const nextAgents = await fetchAgentsList();
      const nextAgentList = nextAgents.agents ?? [];
      const entries = await Promise.all(
        nextAgentList.map(async (agent) => {
          try {
            const config = await fetchAgentSkills(agent.id);
            return [agent.id, config] as const;
          } catch {
            return [agent.id, null] as const;
          }
        }),
      );
      setAgents(nextAgentList);
      setAgentSkillsByAgent(
        Object.fromEntries(
          entries.filter((entry): entry is readonly [string, DeckGoAgentSkillsResponse] =>
            Boolean(entry[1]),
          ),
        ),
      );
      setMatrixState("ready");
    } catch (loadError) {
      setMatrixState("idle");
      setMatrixError(
        loadError instanceof Error ? loadError.message : "failed to load agent skill matrix",
      );
    }
  };

  useEffect(() => {
    void refresh();
    void refreshAgentSkillMatrix();
  }, []);

  useEffect(() => {
    const loadBins = async () => {
      try {
        const next = await fetchSkillHubBins();
        setHubBins(next.bins ?? []);
      } catch {
        setHubBins([]);
      }
    };
    void loadBins();
  }, []);

  const skills = useMemo(() => (payload?.skills ?? []).map(normalizeSkill), [payload]);
  const selectedSkill = skills.find((skill) => skill.key === selectedSkillKey) ?? skills[0] ?? null;
  const readyCount = skills.filter((skill) => skill.status === "ready" && skill.enabled).length;
  const setupCount = skills.filter((skill) => skill.status === "needs-setup").length;
  const managedCount = skills.filter((skill) => skill.source === "managed").length;
  const disabledCount = skills.filter((skill) => skill.status === "disabled").length;
  const payloadWithMeta = payload as (DeckGoSkillsResponse & { managedSkillsDir?: unknown }) | null;
  const managedDir =
    typeof payloadWithMeta?.managedSkillsDir === "string"
      ? payloadWithMeta.managedSkillsDir
      : t("notAvailable");

  const filteredSkills = useMemo(() => {
    const search = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (statusFilter !== "all" && skill.status !== statusFilter) {
        return false;
      }
      if (sourceFilter !== "all" && skill.source !== sourceFilter) {
        return false;
      }
      if (!search || mode !== "installed") {
        return true;
      }
      return [
        skill.key,
        skill.name,
        skill.description,
        skill.primaryEnv,
        skill.source,
        skill.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [mode, query, skills, sourceFilter, statusFilter]);

  const filteredHubResults = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) {
      return hubResults;
    }
    return hubResults.filter((result) =>
      [result.slug, result.displayName, result.summary, result.version]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [hubResults, query]);

  useEffect(() => {
    const config = selectedSkill?.config ?? {};
    const env =
      typeof config.env === "object" && config.env !== null
        ? (config.env as Record<string, string>)
        : {};
    setApiKeyDraft(typeof config.apiKey === "string" ? config.apiKey : "");
    setEnvDraft(JSON.stringify(env, null, 2));
  }, [selectedSkill?.key, selectedSkill?.config]);

  const openDetail = (skillKey: string) => {
    setSelectedSkillKey(skillKey);
    setActiveTab("overview");
    setView("detail");
  };

  const runToggle = async (enabled: boolean) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateSkill(selectedSkill.key, { enabled });
      setActionResult(result);
      setError("");
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runConfigSave = async () => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      const rawEnv = JSON.parse(envDraft) as Record<string, unknown>;
      const env = Object.fromEntries(
        Object.entries(rawEnv)
          .filter(([key]) => key.trim())
          .map(([key, value]) => [key.trim(), String(value)]),
      );
      const result = await updateSkill(selectedSkill.key, {
        apiKey: apiKeyDraft,
        env,
      });
      setActionResult(result);
      setError("");
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill config update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runInstall = async (installId: string) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("installing");
    try {
      const result = await installSkill(selectedSkill.name, installId);
      setActionResult(result);
      setError("");
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill install failed");
    } finally {
      setActionState("idle");
    }
  };

  const runHubSearch = async (queryOverride?: string) => {
    const search = (queryOverride ?? query).trim();
    if (!search) {
      return;
    }
    setHubState("loading");
    setHubError("");
    setHubDetail(null);
    try {
      const result = await searchSkillHub(search, 20);
      setHubResults(result.results ?? []);
      setHubState("ready");
    } catch (actionError) {
      setHubState("idle");
      setHubError(actionError instanceof Error ? actionError.message : "skill hub search failed");
    }
  };

  const selectHubBin = (bin: string) => {
    const next = selectedHubBin === bin ? "" : bin;
    setSelectedHubBin(next);
    setQuery(next);
    if (next) {
      void runHubSearch(next);
    }
  };

  const openHubDetail = async (slug: string) => {
    setHubDetailState("loading");
    setHubError("");
    setActiveDialog("hub-detail");
    try {
      const detail = await fetchSkillHubDetail(slug);
      setHubDetail(detail);
      setHubDetailState("ready");
    } catch (actionError) {
      setHubDetail(null);
      setHubDetailState("idle");
      setHubError(actionError instanceof Error ? actionError.message : "skill hub detail failed");
    }
  };

  const runHubInstall = async () => {
    const skill = hubDetail?.skill;
    if (!skill) {
      return;
    }
    setHubActionState("installing");
    setHubActionResult(null);
    try {
      const result = await installSkillHub(skill.slug, hubDetail.latestVersion?.version);
      setHubActionResult(result);
      setHubError("");
      setActiveDialog(null);
      await refresh(selectedSkillKey);
    } catch (actionError) {
      setHubError(actionError instanceof Error ? actionError.message : "skill hub install failed");
    } finally {
      setHubActionState("idle");
    }
  };

  const runHubUpdateAll = async () => {
    setHubActionState("updating");
    setHubActionResult(null);
    try {
      const result = await updateSkillHub();
      setHubActionResult(result);
      setHubError("");
      await refresh(selectedSkillKey);
    } catch (actionError) {
      setHubError(actionError instanceof Error ? actionError.message : "skill hub update failed");
    } finally {
      setHubActionState("idle");
    }
  };

  const toggleMatrixSkill = async (agent: DeckGoAgentSummary, skill: DeckGoSkillEntry) => {
    const config = agentSkillsByAgent[agent.id];
    const modeValue = normalizeAgentSkillMode(config?.mode);
    if (!config || modeValue !== "whitelist") {
      return;
    }
    const actionKey = `${agent.id}:${skill.key}`;
    const assigned = config.skills.includes(skill.key);
    const nextSkills = sortSkillKeys(
      assigned
        ? config.skills.filter((skillKey) => skillKey !== skill.key)
        : [...config.skills, skill.key],
    );
    setMatrixActionKey(actionKey);
    try {
      const result = await updateAgentSkills(agent.id, {
        mode: modeValue,
        skills: nextSkills,
        baseHash: config.configHash,
      });
      const savedSkills = sortSkillKeys(result.skills ?? nextSkills);
      const savedAssigned = new Set(savedSkills);
      setAgentSkillsByAgent((current) => ({
        ...current,
        [agent.id]: {
          ...config,
          agentId: result.agentId ?? agent.id,
          mode: normalizeAgentSkillMode(result.mode ?? modeValue),
          skills: savedSkills,
          available: config.available.map((entry) => ({
            ...entry,
            assigned: savedAssigned.has(entry.key),
          })),
          configHash: result.configHash ?? config.configHash,
        },
      }));
      setMatrixActionResult(result);
      setMatrixError("");
    } catch (actionError) {
      setMatrixError(
        actionError instanceof Error ? actionError.message : "agent skill matrix update failed",
      );
    } finally {
      setMatrixActionKey("");
    }
  };

  return (
    <section className="skills-panel" data-testid="skills-panel">
      {view === "list" ? (
        <SkillsListView
          disabledCount={disabledCount}
          error={error}
          filteredHubResults={filteredHubResults}
          filteredSkills={filteredSkills}
          hubActionState={hubActionState}
          hubBins={hubBins}
          hubCount={hubResults.length}
          hubError={hubError}
          hubState={hubState}
          loadState={loadState}
          managedCount={managedCount}
          managedDir={managedDir}
          mode={mode}
          query={query}
          readyCount={readyCount}
          selectedHubBin={selectedHubBin}
          selectedSkillKey={selectedSkill?.key ?? ""}
          setupCount={setupCount}
          skills={skills}
          sourceFilter={sourceFilter}
          statusFilter={statusFilter}
          onHubPreview={(slug) => void openHubDetail(slug)}
          onHubSearch={() => void runHubSearch()}
          onModeChange={(nextMode) => {
            setMode(nextMode);
            setQuery("");
          }}
          onQueryChange={setQuery}
          onRefresh={() => void refresh(selectedSkillKey)}
          onSelectHubBin={selectHubBin}
          onSelectSkill={openDetail}
          onSourceFilterChange={setSourceFilter}
          onStatusFilterChange={setStatusFilter}
          onUpdateAll={() => void runHubUpdateAll()}
        />
      ) : selectedSkill ? (
        <SkillsDetailView
          actionResult={actionResult}
          actionState={actionState}
          activeTab={activeTab}
          error={error}
          hubActionResult={hubActionResult}
          matrixProps={{
            agents,
            agentSkillsByAgent,
            matrixActionKey,
            matrixActionResult,
            matrixError,
            matrixState,
            skills,
            onNavigateAgent: (agentId) => navigateToAgent(ui, agentId, "skills"),
            onRefresh: () => void refreshAgentSkillMatrix(),
            onToggle: (agent, skill) => void toggleMatrixSkill(agent, skill),
          }}
          selectedSkill={selectedSkill}
          onBack={() => setView("list")}
          onConfigure={() => setActiveDialog("configure")}
          onDisable={() => setActiveDialog("disable")}
          onEnable={() => void runToggle(true)}
          onInstall={() => setActiveDialog("install")}
          onOpenFiles={() => setActiveDialog("files")}
          onTabChange={setActiveTab}
        />
      ) : (
        <p className="skills-panel__note">{t("selectSkillHint")}</p>
      )}

      {activeDialog === "configure" && selectedSkill ? (
        <ConfigureSkillDialog
          actionState={actionState}
          apiKeyDraft={apiKeyDraft}
          envDraft={envDraft}
          selectedSkill={selectedSkill}
          onApiKeyChange={setApiKeyDraft}
          onClose={() => setActiveDialog(null)}
          onEnvChange={setEnvDraft}
          onSave={() => void runConfigSave()}
        />
      ) : null}

      {activeDialog === "install" && selectedSkill ? (
        <InstallOptionsDialog
          actionState={actionState}
          selectedSkill={selectedSkill}
          onClose={() => setActiveDialog(null)}
          onInstall={(installId) => void runInstall(installId)}
        />
      ) : null}

      {activeDialog === "disable" && selectedSkill ? (
        <DisableSkillDialog
          actionState={actionState}
          selectedSkill={selectedSkill}
          onClose={() => setActiveDialog(null)}
          onDisable={() => void runToggle(false)}
        />
      ) : null}

      {activeDialog === "files" && selectedSkill ? (
        <FilesDialog selectedSkill={selectedSkill} onClose={() => setActiveDialog(null)} />
      ) : null}

      {activeDialog === "hub-detail" ? (
        <HubDetailDialog
          error={hubError}
          hubActionState={hubActionState}
          hubDetail={hubDetail}
          hubDetailState={hubDetailState}
          onClose={() => setActiveDialog(null)}
          onInstall={() => void runHubInstall()}
        />
      ) : null}
    </section>
  );
}

function SkillsListView(props: {
  disabledCount: number;
  error: string;
  filteredHubResults: DeckGoSkillHubSearchResult[];
  filteredSkills: DeckGoSkillEntry[];
  hubActionState: "idle" | "installing" | "updating";
  hubBins: string[];
  hubCount: number;
  hubError: string;
  hubState: PanelState;
  loadState: PanelState;
  managedCount: number;
  managedDir: string;
  mode: SkillsMode;
  query: string;
  readyCount: number;
  selectedHubBin: string;
  selectedSkillKey: string;
  setupCount: number;
  skills: DeckGoSkillEntry[];
  sourceFilter: SourceFilter;
  statusFilter: SkillStatusFilter;
  onHubPreview: (slug: string) => void;
  onHubSearch: () => void;
  onModeChange: (mode: SkillsMode) => void;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  onSelectHubBin: (bin: string) => void;
  onSelectSkill: (skillKey: string) => void;
  onSourceFilterChange: (filter: SourceFilter) => void;
  onStatusFilterChange: (filter: SkillStatusFilter) => void;
  onUpdateAll: () => void;
}) {
  const t = useTranslations("skills");
  return (
    <div className="skills-panel__list-view">
      <header className="skills-panel__page-header">
        <div>
          <p className="skills-panel__eyebrow">{t("catalogEyebrow")}</p>
          <h1 className="skills-panel__title">{t("title")}</h1>
          <p className="skills-panel__description">{t("catalogDescription")}</p>
        </div>
        <div className="skills-panel__header-pills">
          <span className={`skills-panel__pill ${props.loadState === "ready" ? "is-good" : ""}`}>
            {t("loadStates." + props.loadState)}
          </span>
          <span className="skills-panel__pill">
            {t("managedDir")}: {props.managedDir}
          </span>
        </div>
      </header>

      <div className="skills-panel__kpi-strip">
        <SkillMetric label={t("installedKpi")} value={props.skills.length} />
        <SkillMetric label={t("readyKpi")} value={`${props.readyCount}/${props.skills.length}`} />
        <SkillMetric label={t("needsSetupKpi")} value={props.setupCount} />
        <SkillMetric label={t("managedKpi")} value={props.managedCount} />
        <SkillMetric label={t("hubKpi")} value={props.hubCount} />
        <SkillMetric label={t("disabledKpi")} value={props.disabledCount} />
      </div>

      <div className="skills-panel__toolbar">
        <label className="skills-panel__search">
          <IconSearch size={16} />
          <input
            aria-label={t("searchSkills")}
            type="search"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && props.mode === "hub") {
                props.onHubSearch();
              }
            }}
            placeholder={props.mode === "installed" ? t("searchInstalledLong") : t("searchHubLong")}
          />
        </label>
        <SegmentedGroup label={t("modeLabel")}>
          {(["installed", "hub"] as const).map((mode) => (
            <button
              key={mode}
              className={`skills-panel__segment ${props.mode === mode ? "is-active" : ""}`}
              type="button"
              aria-selected={props.mode === mode}
              role="tab"
              onClick={() => props.onModeChange(mode)}
            >
              {t(`modes.${mode}`)}
            </button>
          ))}
        </SegmentedGroup>
        {props.mode === "installed" ? (
          <>
            <SegmentedGroup label={t("statusLabel")}>
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  className={`skills-panel__segment ${
                    props.statusFilter === status ? "is-active" : ""
                  }`}
                  type="button"
                  aria-selected={props.statusFilter === status}
                  role="tab"
                  onClick={() => props.onStatusFilterChange(status)}
                >
                  {statusFilterLabel(t, status)}
                </button>
              ))}
            </SegmentedGroup>
            <SegmentedGroup label={t("sourceLabel")}>
              {SOURCE_FILTERS.map((source) => (
                <button
                  key={source}
                  className={`skills-panel__segment ${
                    props.sourceFilter === source ? "is-active" : ""
                  }`}
                  type="button"
                  aria-selected={props.sourceFilter === source}
                  role="tab"
                  onClick={() => props.onSourceFilterChange(source)}
                >
                  {sourceFilterLabel(t, source)}
                </button>
              ))}
            </SegmentedGroup>
          </>
        ) : (
          <button
            className="skills-panel__button is-primary"
            type="button"
            onClick={props.onHubSearch}
            disabled={props.hubState === "loading" || !props.query.trim()}
          >
            {props.hubState === "loading" ? t("searching") : t("searchHub")}
          </button>
        )}
        <button className="skills-panel__button" type="button" onClick={props.onRefresh}>
          <IconRefresh size={14} />
          {t("refreshSkills")}
        </button>
      </div>

      {props.mode === "installed" ? (
        <InstalledSkillsTable
          error={props.error}
          filteredSkills={props.filteredSkills}
          loadState={props.loadState}
          selectedSkillKey={props.selectedSkillKey}
          skills={props.skills}
          onSelect={props.onSelectSkill}
        />
      ) : (
        <HubList
          bins={props.hubBins}
          error={props.hubError}
          hubActionState={props.hubActionState}
          hubState={props.hubState}
          results={props.filteredHubResults}
          selectedBin={props.selectedHubBin}
          onPreview={props.onHubPreview}
          onSelectBin={props.onSelectHubBin}
          onUpdateAll={props.onUpdateAll}
        />
      )}
    </div>
  );
}

function InstalledSkillsTable(props: {
  error: string;
  filteredSkills: DeckGoSkillEntry[];
  loadState: PanelState;
  selectedSkillKey: string;
  skills: DeckGoSkillEntry[];
  onSelect: (skillKey: string) => void;
}) {
  const t = useTranslations("skills");
  if (props.error) {
    return <StateBlock tone="danger" icon={<IconAlert />} title={props.error} />;
  }
  if (props.loadState === "loading") {
    return <StateBlock icon={<IconRefresh className="is-spinning" />} title={t("loadingSkills")} />;
  }
  if (props.skills.length === 0) {
    return <StateBlock icon={<IconBolt />} title={t("noSkillsReported")} />;
  }
  if (props.filteredSkills.length === 0) {
    return <StateBlock icon={<IconSearch />} title={t("noInstalledSkillsMatch")} />;
  }
  return (
    <div className="skills-panel__table-shell">
      <div className="skills-panel__row-head" aria-hidden="true">
        <span />
        <span>{t("skill")}</span>
        <span>{t("description")}</span>
        <span>{t("source")}</span>
        <span>{t("config")}</span>
        <span>{t("setup")}</span>
        <span>{t("status")}</span>
        <span />
      </div>
      <ul className="skills-panel__rows" aria-label="installed skill list">
        {props.filteredSkills.map((skill) => (
          <li key={skill.key}>
            <button
              className={`skills-panel__row ${
                props.selectedSkillKey === skill.key ? "is-selected" : ""
              } ${skill.enabled ? "" : "is-muted"}`}
              type="button"
              aria-label={t("openSkillDetail", { name: skill.name })}
              onClick={() => props.onSelect(skill.key)}
            >
              <span className="skills-panel__glyph" aria-hidden="true">
                {skill.emoji || skill.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="skills-panel__row-identity">
                <strong>{skill.name}</strong>
                <span>
                  <code>{skill.key}</code>
                  {skill.primaryEnv ? ` · ${skill.primaryEnv}` : ""}
                </span>
              </span>
              <span className="skills-panel__row-description">
                {skill.description || t("noDescription")}
              </span>
              <SourcePill source={skill.source} />
              <span className="skills-panel__count-pill">
                {Object.keys(skill.config ?? {}).length || "-"}
              </span>
              <span
                className={`skills-panel__count-pill ${
                  skill.missingRequirements?.length ? "is-warn" : ""
                }`}
              >
                {skill.missingRequirements?.length ? skill.missingRequirements.length : t("clean")}
              </span>
              <StatusPill status={skill.status} />
              <IconArrowR size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HubList(props: {
  bins: string[];
  error: string;
  hubActionState: "idle" | "installing" | "updating";
  hubState: PanelState;
  results: DeckGoSkillHubSearchResult[];
  selectedBin: string;
  onPreview: (slug: string) => void;
  onSelectBin: (bin: string) => void;
  onUpdateAll: () => void;
}) {
  const t = useTranslations("skills");
  return (
    <div className="skills-panel__hub">
      <div className="skills-panel__hub-head">
        <div>
          <h2 className="skills-panel__title is-compact">ClawHub</h2>
          <p className="skills-panel__description">{t("clawHubDescription")}</p>
        </div>
        <button
          className="skills-panel__button"
          type="button"
          onClick={props.onUpdateAll}
          disabled={props.hubActionState !== "idle"}
        >
          {props.hubActionState === "updating" ? t("updating") : t("updateAllClawHub")}
        </button>
      </div>
      {props.bins.length ? (
        <div className="skills-panel__bin-strip" aria-label={t("hubBins")}>
          {props.bins.map((bin) => (
            <button
              className={`skills-panel__chip ${props.selectedBin === bin ? "is-active" : ""}`}
              key={bin}
              type="button"
              onClick={() => props.onSelectBin(bin)}
            >
              <IconHash size={13} />
              {bin}
            </button>
          ))}
        </div>
      ) : null}
      {props.error ? <p className="skills-panel__note is-danger">{props.error}</p> : null}
      {props.hubState === "loading" ? (
        <StateBlock icon={<IconRefresh className="is-spinning" />} title={t("searching")} />
      ) : props.results.length === 0 ? (
        <StateBlock icon={<IconInfo />} title={t("noClawHubResults")} />
      ) : (
        <ul className="skills-panel__hub-list" aria-label={t("hubResults")}>
          {props.results.map((result) => (
            <li key={result.slug} className="skills-panel__hub-row">
              <div>
                <div className="skills-panel__hub-title">
                  <strong>{result.displayName}</strong>
                  <code>{result.slug}</code>
                  {result.version ? <span>v{result.version}</span> : null}
                </div>
                <p>{result.summary || t("noDescription")}</p>
                <div className="skills-panel__meta-line">
                  {typeof result.score === "number" ? (
                    <span>
                      {t("score")}: {result.score.toFixed(2)}
                    </span>
                  ) : null}
                  {result.updatedAt ? (
                    <span>
                      {t("updated")}: {formatHubDate(result.updatedAt, t("notAvailable"))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="skills-panel__row-actions">
                <button
                  className="skills-panel__button"
                  type="button"
                  onClick={() => props.onPreview(result.slug)}
                >
                  {t("preview")}
                </button>
                <button
                  className="skills-panel__button is-primary"
                  type="button"
                  onClick={() => props.onPreview(result.slug)}
                >
                  {t("install")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillsDetailView(props: {
  actionResult: unknown;
  actionState: "idle" | "installing" | "updating";
  activeTab: DetailTab;
  error: string;
  hubActionResult: unknown;
  matrixProps: Parameters<typeof SkillMatrixTab>[0];
  selectedSkill: DeckGoSkillEntry;
  onBack: () => void;
  onConfigure: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onInstall: () => void;
  onOpenFiles: () => void;
  onTabChange: (tab: DetailTab) => void;
}) {
  const t = useTranslations("skills");
  const skill = props.selectedSkill;
  return (
    <div className="skills-panel__detail">
      <header className="skills-panel__detail-hero">
        <button className="skills-panel__back" type="button" onClick={props.onBack}>
          <IconArrowL size={16} />
          {t("title")}
        </button>
        <div className="skills-panel__detail-main">
          <span className="skills-panel__glyph is-large" aria-hidden="true">
            {skill.emoji || skill.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="skills-panel__detail-title-row">
              <h1 className="skills-panel__title">{skill.name}</h1>
              <StatusPill status={skill.status} />
              <SourcePill source={skill.source} />
            </div>
            <p className="skills-panel__meta-line">
              <code>{skill.key}</code>
              {skill.primaryEnv ? <span>{skill.primaryEnv}</span> : null}
              {skill.homepage ? <span>{skill.homepage}</span> : null}
            </p>
          </div>
        </div>
        <div className="skills-panel__detail-actions">
          <button className="skills-panel__button" type="button" onClick={props.onOpenFiles}>
            <IconFile size={14} />
            {t("files")}
          </button>
          <button className="skills-panel__button" type="button" onClick={props.onConfigure}>
            {t("configure")}
          </button>
          {skill.installOptions?.length ? (
            <button className="skills-panel__button" type="button" onClick={props.onInstall}>
              {t("install")}
            </button>
          ) : null}
          {skill.enabled ? (
            <button
              className="skills-panel__button is-danger"
              type="button"
              onClick={props.onDisable}
            >
              {t("disable")}
            </button>
          ) : (
            <button
              className="skills-panel__button is-primary"
              type="button"
              onClick={props.onEnable}
              disabled={props.actionState !== "idle"}
            >
              {props.actionState === "updating" ? t("updating") : t("enable")}
            </button>
          )}
        </div>
      </header>

      <div className="skills-panel__tabs" role="tablist" aria-label={t("skillSections")}>
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`skills-panel__tab ${props.activeTab === tab ? "is-active" : ""}`}
            aria-selected={props.activeTab === tab}
            onClick={() => props.onTabChange(tab)}
          >
            {t(`detailTabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className="skills-panel__detail-body">
        {props.activeTab === "overview" ? <OverviewTab skill={skill} /> : null}
        {props.activeTab === "setup" ? (
          <SetupTab skill={skill} onConfigure={props.onConfigure} />
        ) : null}
        {props.activeTab === "triggers" ? <TriggersTab skill={skill} /> : null}
        {props.activeTab === "bins" ? <BinsTab skill={skill} onInstall={props.onInstall} /> : null}
        {props.activeTab === "files" ? (
          <FilesProjectionTab onOpenFiles={props.onOpenFiles} />
        ) : null}
        {props.activeTab === "audit" ? <AuditTab actionResult={props.actionResult} /> : null}
      </div>

      <details className="skills-panel__matrix-details">
        <summary>{t("agentSkillMatrix")}</summary>
        <SkillMatrixTab {...props.matrixProps} />
      </details>

      {props.error ? <p className="skills-panel__note is-danger">{props.error}</p> : null}
      {props.actionResult ? (
        <JsonDetails title={t("lastSkillAction")} payload={props.actionResult} />
      ) : null}
      {props.hubActionResult ? (
        <JsonDetails title={t("lastHubAction")} payload={props.hubActionResult} />
      ) : null}
    </div>
  );
}

function OverviewTab({ skill }: { skill: DeckGoSkillEntry }) {
  const t = useTranslations("skills");
  const configKeys = Object.keys(skill.config ?? {});
  return (
    <section className="skills-panel__section">
      <h2>{t("overviewIdentity")}</h2>
      <div className="skills-panel__field-grid">
        <FieldRow label={t("key")} value={<code>{skill.key}</code>} />
        <FieldRow label={t("source")} value={<SourcePill source={skill.source} />} />
        <FieldRow label={t("status")} value={<StatusPill status={skill.status} />} />
        <FieldRow label={t("enabled")} value={skill.enabled ? t("yes") : t("no")} />
        <FieldRow label={t("primaryEnv")} value={skill.primaryEnv || t("notAvailable")} />
        <FieldRow
          label={t("configKeys")}
          value={configKeys.length ? configKeys.join(", ") : t("notAvailable")}
        />
      </div>
      <h2>{t("description")}</h2>
      <p className="skills-panel__prose">{skill.description || t("noDescription")}</p>
    </section>
  );
}

function SetupTab(props: { skill: DeckGoSkillEntry; onConfigure: () => void }) {
  const t = useTranslations("skills");
  const requirements = props.skill.missingRequirements ?? [];
  return (
    <section className="skills-panel__section">
      <h2>{t("setupHeading")}</h2>
      {requirements.length === 0 && props.skill.status === "ready" ? (
        <StateBlock tone="good" icon={<IconCheck />} title={t("setupComplete")} />
      ) : requirements.length === 0 ? (
        <StateBlock icon={<IconInfo />} title={t("noRequirementsButDisabled")} />
      ) : (
        <div className="skills-panel__checklist">
          {requirements.map((requirement) => (
            <div className="skills-panel__check-row" key={requirement}>
              <IconAlert size={15} />
              <span>{requirement}</span>
            </div>
          ))}
        </div>
      )}
      {props.skill.primaryEnv ? (
        <p className="skills-panel__note">{t("primaryEnvHint", { env: props.skill.primaryEnv })}</p>
      ) : null}
      <button className="skills-panel__button is-primary" type="button" onClick={props.onConfigure}>
        {t("configure")}
      </button>
    </section>
  );
}

function TriggersTab({ skill }: { skill: DeckGoSkillEntry }) {
  const t = useTranslations("skills");
  const triggers = buildProjectedTriggers(skill);
  return (
    <section className="skills-panel__section">
      <div className="skills-panel__section-head">
        <h2>{t("triggersHeading")}</h2>
        <span className="skills-panel__pill is-projected">{t("projected")}</span>
      </div>
      <p className="skills-panel__note">{t("projectedTriggers")}</p>
      {triggers.length ? (
        <div className="skills-panel__chip-list">
          {triggers.map((trigger) => (
            <span className="skills-panel__chip" key={trigger}>
              <IconHash size={13} />
              {trigger}
            </span>
          ))}
        </div>
      ) : (
        <StateBlock icon={<IconHash />} title={t("noTriggerProjection")} />
      )}
    </section>
  );
}

function BinsTab(props: { skill: DeckGoSkillEntry; onInstall: () => void }) {
  const t = useTranslations("skills");
  const options = props.skill.installOptions ?? [];
  if (!options.length) {
    return (
      <section className="skills-panel__section">
        <StateBlock icon={<IconBolt />} title={t("noBinsProjection")} />
      </section>
    );
  }
  return (
    <section className="skills-panel__section">
      <div className="skills-panel__section-head">
        <h2>{t("binsHeading")}</h2>
        <button className="skills-panel__button" type="button" onClick={props.onInstall}>
          {t("install")}
        </button>
      </div>
      <div className="skills-panel__install-grid">
        {options.map((option) => (
          <div className="skills-panel__install-card" key={option.id}>
            <div>
              <strong>{option.label}</strong>
              <code>{option.id}</code>
            </div>
            <div className="skills-panel__chip-list">
              {option.bins.length ? (
                option.bins.map((bin) => (
                  <span className="skills-panel__chip" key={bin}>
                    {bin}
                  </span>
                ))
              ) : (
                <span className="skills-panel__note">{t("notAvailable")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FilesProjectionTab({ onOpenFiles }: { onOpenFiles: () => void }) {
  const t = useTranslations("skills");
  return (
    <section className="skills-panel__section">
      <div className="skills-panel__section-head">
        <h2>{t("filesHeading")}</h2>
        <span className="skills-panel__pill is-projected">{t("unavailableProjection")}</span>
      </div>
      <StateBlock icon={<IconFile />} title={t("filesProjectionUnavailable")} />
      <button className="skills-panel__button" type="button" onClick={onOpenFiles}>
        {t("openFiles")}
      </button>
    </section>
  );
}

function AuditTab({ actionResult }: { actionResult: unknown }) {
  const t = useTranslations("skills");
  return (
    <section className="skills-panel__section">
      <div className="skills-panel__section-head">
        <h2>{t("auditHeading")}</h2>
        <span className="skills-panel__pill is-projected">{t("unavailableProjection")}</span>
      </div>
      {actionResult ? (
        <JsonDetails title={t("lastSkillAction")} payload={actionResult} />
      ) : (
        <StateBlock icon={<IconClock />} title={t("auditProjectionUnavailable")} />
      )}
    </section>
  );
}

function ConfigureSkillDialog(props: {
  actionState: "idle" | "installing" | "updating";
  apiKeyDraft: string;
  envDraft: string;
  selectedSkill: DeckGoSkillEntry;
  onApiKeyChange: (value: string) => void;
  onClose: () => void;
  onEnvChange: (value: string) => void;
  onSave: () => void;
}) {
  const t = useTranslations("skills");
  return (
    <DialogFrame
      label={t("configureSkill")}
      title={props.selectedSkill.name}
      onClose={props.onClose}
    >
      <p className="skills-panel__note">{t("configureDescription")}</p>
      <label className="skills-panel__field">
        <span>{t("apiKey")}</span>
        <input
          className="skills-panel__input"
          type="password"
          value={props.apiKeyDraft}
          onChange={(event) => props.onApiKeyChange(event.target.value)}
          placeholder={props.selectedSkill.primaryEnv || "api key"}
        />
      </label>
      <label className="skills-panel__field">
        <span>{t("environmentJson")}</span>
        <textarea
          aria-label="skill env json"
          className="skills-panel__textarea"
          value={props.envDraft}
          onChange={(event) => props.onEnvChange(event.target.value)}
        />
      </label>
      <div className="skills-panel__modal-actions">
        <button className="skills-panel__button" type="button" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button
          className="skills-panel__button is-primary"
          type="button"
          onClick={props.onSave}
          disabled={props.actionState !== "idle"}
        >
          {props.actionState === "updating" ? t("saving") : t("saveConfig")}
        </button>
      </div>
    </DialogFrame>
  );
}

function InstallOptionsDialog(props: {
  actionState: "idle" | "installing" | "updating";
  selectedSkill: DeckGoSkillEntry;
  onClose: () => void;
  onInstall: (installId: string) => void;
}) {
  const t = useTranslations("skills");
  return (
    <DialogFrame
      label={t("installDialogTitle")}
      title={props.selectedSkill.name}
      onClose={props.onClose}
    >
      {props.selectedSkill.installOptions?.length ? (
        <div className="skills-panel__install-grid">
          {props.selectedSkill.installOptions.map((option) => (
            <div className="skills-panel__install-card" key={option.id}>
              <div>
                <strong>{option.label}</strong>
                <code>{option.id}</code>
                <p className="skills-panel__note">
                  {t("bins")}: {option.bins.length ? option.bins.join(", ") : t("notAvailable")}
                </p>
              </div>
              <button
                className="skills-panel__button is-primary"
                type="button"
                onClick={() => props.onInstall(option.id)}
                disabled={props.actionState !== "idle"}
              >
                {props.actionState === "installing" ? t("installing") : option.label}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <StateBlock icon={<IconInfo />} title={t("noInstallableSkills")} />
      )}
    </DialogFrame>
  );
}

function DisableSkillDialog(props: {
  actionState: "idle" | "installing" | "updating";
  selectedSkill: DeckGoSkillEntry;
  onClose: () => void;
  onDisable: () => void;
}) {
  const t = useTranslations("skills");
  const body =
    props.selectedSkill.source === "managed" ? t("disableManagedBody") : t("disableSkillBody");
  return (
    <DialogFrame
      label={t("disableSkillDialog")}
      title={t("disableSkillTitle", { name: props.selectedSkill.name })}
      onClose={props.onClose}
    >
      <p className="skills-panel__note">{body}</p>
      <div className="skills-panel__modal-actions">
        <button className="skills-panel__button" type="button" onClick={props.onClose}>
          {t("cancel")}
        </button>
        <button
          className="skills-panel__button is-danger"
          type="button"
          onClick={props.onDisable}
          disabled={props.actionState !== "idle"}
        >
          {props.actionState === "updating" ? t("updating") : t("confirmDisable")}
        </button>
      </div>
    </DialogFrame>
  );
}

function FilesDialog(props: { selectedSkill: DeckGoSkillEntry; onClose: () => void }) {
  const t = useTranslations("skills");
  return (
    <DialogFrame label={t("skillFiles")} title={props.selectedSkill.name} onClose={props.onClose}>
      <StateBlock icon={<IconFile />} title={t("filesProjectionUnavailable")} />
      <p className="skills-panel__note">{t("projectedFileNote")}</p>
    </DialogFrame>
  );
}

function HubDetailDialog(props: {
  error: string;
  hubActionState: "idle" | "installing" | "updating";
  hubDetail: DeckGoSkillHubDetailResponse | null;
  hubDetailState: PanelState;
  onClose: () => void;
  onInstall: () => void;
}) {
  const t = useTranslations("skills");
  const skill = props.hubDetail?.skill;
  return (
    <DialogFrame
      label={t("hubPreview")}
      title={skill?.displayName ?? t("hubPreview")}
      onClose={props.onClose}
    >
      {props.hubDetailState === "loading" ? (
        <StateBlock icon={<IconRefresh className="is-spinning" />} title={t("loadingDetail")} />
      ) : props.error ? (
        <StateBlock tone="danger" icon={<IconAlert />} title={props.error} />
      ) : skill ? (
        <>
          <p className="skills-panel__prose">{skill.summary || t("noDescription")}</p>
          <div className="skills-panel__field-grid">
            <FieldRow label={t("slug")} value={<code>{skill.slug}</code>} />
            <FieldRow
              label={t("version")}
              value={props.hubDetail?.latestVersion?.version ?? t("notAvailable")}
            />
            <FieldRow
              label={t("owner")}
              value={
                props.hubDetail?.owner?.displayName ||
                props.hubDetail?.owner?.handle ||
                t("notAvailable")
              }
            />
            <FieldRow
              label={t("platforms")}
              value={props.hubDetail?.metadata?.os?.join(", ") || t("notAvailable")}
            />
          </div>
          {props.hubDetail?.latestVersion?.changelog ? (
            <JsonDetails
              title={t("hubChangelog")}
              payload={props.hubDetail.latestVersion.changelog}
            />
          ) : null}
          <div className="skills-panel__modal-actions">
            <button className="skills-panel__button" type="button" onClick={props.onClose}>
              {t("cancel")}
            </button>
            <button
              className="skills-panel__button is-primary"
              type="button"
              onClick={props.onInstall}
              disabled={props.hubActionState !== "idle"}
            >
              {props.hubActionState === "installing" ? t("installing") : t("installFromClawHub")}
            </button>
          </div>
        </>
      ) : (
        <StateBlock icon={<IconInfo />} title={t("searchHubHint")} />
      )}
    </DialogFrame>
  );
}

function DialogFrame(props: {
  children: ReactNode;
  label: string;
  title: string;
  onClose: () => void;
}) {
  const t = useTranslations("skills");
  return (
    <div className="skills-panel__modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="skills-panel__modal"
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="skills-panel__modal-head">
          <div>
            <p className="skills-panel__eyebrow">{props.label}</p>
            <h2>{props.title}</h2>
          </div>
          <button
            className="skills-panel__icon-button"
            type="button"
            aria-label={t("close")}
            onClick={props.onClose}
          >
            <IconX size={16} />
          </button>
        </div>
        <div className="skills-panel__modal-body">{props.children}</div>
      </div>
    </div>
  );
}

function SegmentedGroup(props: { children: ReactNode; label: string }) {
  return (
    <div className="skills-panel__segments" role="tablist" aria-label={props.label}>
      {props.children}
    </div>
  );
}

function FieldRow(props: { label: string; value: ReactNode }) {
  return (
    <div className="skills-panel__field-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: SkillStatus }) {
  const t = useTranslations("skills");
  return (
    <span className={`skills-panel__pill ${statusPillClass(status)}`}>
      {status === "ready" ? <IconCheck size={13} /> : null}
      {status === "needs-setup" ? <IconAlert size={13} /> : null}
      {status === "disabled" ? <IconX size={13} /> : null}
      {statusFilterLabel(t, status)}
    </span>
  );
}

function SourcePill({ source }: { source: DeckGoSkillEntry["source"] }) {
  const t = useTranslations("skills");
  return (
    <span className={`skills-panel__source is-${source}`}>{sourceFilterLabel(t, source)}</span>
  );
}

function StateBlock(props: { icon: ReactNode; title: string; tone?: "danger" | "good" }) {
  return (
    <div className={`skills-panel__state ${props.tone ? `is-${props.tone}` : ""}`}>
      {props.icon}
      <strong>{props.title}</strong>
    </div>
  );
}

function statusPillClass(status: SkillStatus) {
  if (status === "ready") {
    return "is-good";
  }
  if (status === "needs-setup") {
    return "is-warn";
  }
  return "";
}

function statusFilterLabel(t: ReturnType<typeof useTranslations>, status: SkillStatusFilter) {
  return t(`statusFilters.${status}`);
}

function sourceFilterLabel(t: ReturnType<typeof useTranslations>, source: SourceFilter) {
  return t(`sourceFilters.${source}`);
}

function buildProjectedTriggers(skill: DeckGoSkillEntry) {
  const seeds = [
    skill.key,
    skill.name,
    skill.primaryEnv,
    ...(skill.description ?? "").split(/\s+/).filter((word) => word.length > 4),
  ];
  return [
    ...new Set(
      seeds.filter((entry): entry is string => Boolean(entry)).map((entry) => entry.toLowerCase()),
    ),
  ].slice(0, 5);
}

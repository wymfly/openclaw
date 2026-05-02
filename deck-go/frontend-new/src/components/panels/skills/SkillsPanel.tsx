import { useEffect, useMemo, useState } from "react";
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
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";
import { InstallSkillDialog } from "./InstallSkillDialog";
import {
  formatHubDate,
  normalizeAgentSkillMode,
  normalizeSkill,
  sortSkillKeys,
  type PanelState,
  type SkillStatusFilter,
} from "./skill-model";
import { SkillConfig } from "./SkillConfig";
import { SkillHubTab } from "./SkillHubTab";
import { SkillInfoTab } from "./SkillInfoTab";
import { SkillList } from "./SkillList";
import { SkillMatrixTab } from "./SkillMatrixTab";

export function SkillsPanel() {
  const t = useTranslations("skills");
  const ui = useDeckUI();
  const [payload, setPayload] = useState<DeckGoSkillsResponse | null>(null);
  const [selectedSkillKey, setSelectedSkillKey] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "installing" | "updating">("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [envDraft, setEnvDraft] = useState("{}");
  const [error, setError] = useState("");
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [skillStatusFilter, setSkillStatusFilter] = useState<SkillStatusFilter>("all");
  const [hubQuery, setHubQuery] = useState("");
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
      const skills = (next.skills ?? []).map(normalizeSkill);
      const fallbackKey = preferredSkillKey?.trim() || skills[0]?.key || "";
      setSelectedSkillKey((current) =>
        fallbackKey && skills.some((skill) => skill.key === fallbackKey)
          ? fallbackKey
          : current && skills.some((skill) => skill.key === current)
            ? current
            : skills[0]?.key || "",
      );
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load skills");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

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
  const filteredSkills = useMemo(() => {
    const query = skillSearchQuery.trim().toLowerCase();
    return skills.filter((skill) => {
      if (skillStatusFilter !== "all" && skill.status !== skillStatusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.key.toLowerCase().includes(query) ||
        (skill.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [skillSearchQuery, skillStatusFilter, skills]);
  const selectedSkill = skills.find((skill) => skill.key === selectedSkillKey) ?? skills[0] ?? null;
  const readyCount = skills.filter((skill) => skill.status === "ready").length;
  const setupCount = skills.filter((skill) => skill.status === "needs-setup").length;

  useEffect(() => {
    const config = selectedSkill?.config ?? {};
    const env =
      typeof config.env === "object" && config.env !== null
        ? (config.env as Record<string, string>)
        : {};
    setApiKeyDraft(typeof config.apiKey === "string" ? config.apiKey : "");
    setEnvDraft(JSON.stringify(env, null, 2));
  }, [selectedSkill?.key, selectedSkill?.config]);

  const runToggle = async (enabled: boolean) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateSkill(selectedSkill.key, { enabled });
      setActionResult(result);
      setError("");
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
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill install failed");
    } finally {
      setActionState("idle");
    }
  };

  const runHubSearch = async (queryOverride?: string) => {
    const query = (queryOverride ?? hubQuery).trim();
    if (!query) {
      return;
    }
    setHubState("loading");
    setHubError("");
    setHubDetail(null);
    try {
      const result = await searchSkillHub(query, 20);
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
    setHubQuery(next);
    if (next) {
      void runHubSearch(next);
    }
  };

  const loadHubDetail = async (slug: string) => {
    setHubDetailState("loading");
    setHubError("");
    try {
      const detail = await fetchSkillHubDetail(slug);
      setHubDetail(detail);
      setHubDetailState("ready");
    } catch (actionError) {
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
    const mode = normalizeAgentSkillMode(config?.mode);
    if (!config || mode !== "whitelist") {
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
        mode,
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
          mode: normalizeAgentSkillMode(result.mode ?? mode),
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
    <section className="deckgo-panel-workspace deck-ui-skills">
      <div className="deckgo-column deck-ui-skills-column">
        <SkillList
          actionState={actionState}
          error={error}
          filteredSkills={filteredSkills}
          loadState={loadState}
          readyCount={readyCount}
          selectedSkill={selectedSkill}
          setupCount={setupCount}
          skillSearchQuery={skillSearchQuery}
          skillStatusFilter={skillStatusFilter}
          skills={skills}
          onRefresh={() => void refresh(selectedSkillKey)}
          onSearchChange={setSkillSearchQuery}
          onSelect={setSelectedSkillKey}
          onStatusFilterChange={setSkillStatusFilter}
          onToggle={(enabled) => void runToggle(enabled)}
        />
        <SkillHubTab
          bins={hubBins}
          error={hubError}
          hubActionState={hubActionState}
          hubQuery={hubQuery}
          hubState={hubState}
          results={hubResults}
          selectedBin={selectedHubBin}
          onHubQueryChange={setHubQuery}
          onLoadDetail={(slug) => void loadHubDetail(slug)}
          onSearch={() => void runHubSearch()}
          onSelectBin={selectHubBin}
          onUpdateAll={() => void runHubUpdateAll()}
        />
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-skills-column">
        <article className="deckgo-card is-float deck-ui-skills-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">{t("selectedSkill")}</h2>
          </div>
          <p className="deckgo-card-subtitle">{t("selectedSkillDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
            {selectedSkill ? (
              <>
                <SkillInfoTab selectedSkill={selectedSkill} />
                <SkillConfig
                  actionState={actionState}
                  apiKeyDraft={apiKeyDraft}
                  envDraft={envDraft}
                  selectedSkill={selectedSkill}
                  onApiKeyChange={setApiKeyDraft}
                  onEnvChange={setEnvDraft}
                  onSave={() => void runConfigSave()}
                />
                <InstallSkillDialog
                  actionState={actionState}
                  selectedSkill={selectedSkill}
                  onInstall={(installId) => void runInstall(installId)}
                />
              </>
            ) : (
              <p className="deckgo-note deck-ui-skills-empty">{t("selectSkillHint")}</p>
            )}
            {actionResult ? (
              <JsonDetails title={t("lastSkillAction")} payload={actionResult} />
            ) : null}
            <SkillMatrixTab
              agents={agents}
              agentSkillsByAgent={agentSkillsByAgent}
              matrixActionKey={matrixActionKey}
              matrixActionResult={matrixActionResult}
              matrixError={matrixError}
              matrixState={matrixState}
              skills={skills}
              onNavigateAgent={(agentId) => navigateToAgent(ui, agentId, "skills")}
              onRefresh={() => void refreshAgentSkillMatrix()}
              onToggle={(agent, skill) => void toggleMatrixSkill(agent, skill)}
            />
            <div className="deckgo-surface-tile deck-ui-skills-surface">
              <p className="deckgo-surface-label">{t("clawHubDetail")}</p>
              {hubDetailState === "loading" ? (
                <p className="deckgo-note">{t("loadingDetail")}</p>
              ) : null}
              {hubDetail?.skill ? (
                <>
                  <div className="deckgo-panel-hero-strip deck-ui-skills-hero">
                    <div>
                      <p className="deckgo-kicker">{t("hubSkill")}</p>
                      <strong>{hubDetail.skill.displayName}</strong>
                      <p className="deckgo-note">
                        {hubDetail.skill.summary || hubDetail.skill.slug}
                      </p>
                    </div>
                    <div className="deckgo-pill-row">
                      <span className="deckgo-pill">
                        {t("slug")}: {hubDetail.skill.slug}
                      </span>
                      <span className="deckgo-pill">
                        {t("version")}: {hubDetail.latestVersion?.version ?? t("notAvailable")}
                      </span>
                    </div>
                  </div>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-skills-detail-stats">
                    <ShellStat
                      label={t("owner")}
                      value={
                        hubDetail.owner?.displayName || hubDetail.owner?.handle || t("notAvailable")
                      }
                    />
                    <ShellStat
                      label={t("updated")}
                      value={formatHubDate(hubDetail.skill.updatedAt, t("notAvailable"))}
                    />
                  </div>
                  {hubDetail.metadata?.os?.length ? (
                    <p className="deckgo-note">
                      {t("platforms")}: {hubDetail.metadata.os.join(", ")}
                    </p>
                  ) : null}
                  {hubDetail.latestVersion?.changelog ? (
                    <JsonDetails
                      title={t("hubChangelog")}
                      payload={hubDetail.latestVersion.changelog}
                    />
                  ) : null}
                  <div className="deckgo-actions deck-ui-skills-actions">
                    <button
                      className="deckgo-button is-primary deck-ui-skills-button"
                      type="button"
                      onClick={() => void runHubInstall()}
                      disabled={hubActionState !== "idle"}
                    >
                      {hubActionState === "installing" ? t("installing") : t("installFromClawHub")}
                    </button>
                  </div>
                </>
              ) : (
                <p className="deckgo-note deck-ui-skills-empty">{t("searchHubHint")}</p>
              )}
            </div>
            {hubActionResult ? (
              <JsonDetails title={t("lastHubAction")} payload={hubActionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

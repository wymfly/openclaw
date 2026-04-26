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
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";
type SkillStatus = "ready" | "needs-setup" | "disabled";
type SkillStatusFilter = SkillStatus | "all";

const VALID_SOURCES = new Set<DeckGoSkillEntry["source"]>(["bundled", "managed", "plugin"]);
const SKILL_STATUS_FILTERS: SkillStatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

function formatHubDate(value?: number) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "n/a" : date.toLocaleDateString();
}

function normalizeSkill(raw: Record<string, unknown>): DeckGoSkillEntry {
  const skillKey =
    typeof raw.skillKey === "string" ? raw.skillKey : typeof raw.name === "string" ? raw.name : "";
  const disabled = raw.disabled === true;
  const eligible = raw.eligible !== false;
  const hasMissing = Array.isArray(raw.missing) && raw.missing.length > 0;

  let status: SkillStatus = "ready";
  if (disabled) {
    status = "disabled";
  } else if (hasMissing || !eligible) {
    status = "needs-setup";
  }

  const source = typeof raw.source === "string" ? raw.source : "bundled";
  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    status,
    source: VALID_SOURCES.has(source as DeckGoSkillEntry["source"])
      ? (source as DeckGoSkillEntry["source"])
      : "bundled",
    enabled: !disabled,
    missingRequirements: Array.isArray(raw.missing) ? (raw.missing as string[]) : undefined,
    config:
      typeof raw.config === "object" && raw.config !== null
        ? (raw.config as Record<string, unknown>)
        : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    emoji: typeof raw.emoji === "string" ? raw.emoji : undefined,
    homepage: typeof raw.homepage === "string" ? raw.homepage : undefined,
    primaryEnv: typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined,
    installOptions: Array.isArray(raw.install)
      ? (raw.install as DeckGoSkillEntry["installOptions"])
      : undefined,
  };
}

function normalizeAgentSkillMode(mode?: string): "all" | "whitelist" {
  return mode === "whitelist" ? "whitelist" : "all";
}

function sortSkillKeys(skills: string[]) {
  return skills.slice().sort((left, right) => left.localeCompare(right));
}

export function SkillsPanel() {
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
        <article className="deckgo-card is-float deck-ui-skills-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Installed skills</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Installed skills, setup state, and enable/disable actions use the current skill routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
            <div className="deckgo-pill-row deck-ui-skills-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Skills {loadState}
              </span>
              <span className="deckgo-pill">{skills.length} installed</span>
              <span className="deckgo-pill">{setupCount} need setup</span>
            </div>
            <div className="deckgo-grid deckgo-grid-3 deck-ui-skills-stats">
              <ShellStat label="installed" value={skills.length} />
              <ShellStat label="ready" value={readyCount} />
              <ShellStat label="needs setup" value={setupCount} />
              <ShellStat label="shown" value={filteredSkills.length} />
            </div>
            <div className="deckgo-actions deck-ui-skills-actions">
              <input
                aria-label="installed skill search"
                className="deckgo-input deck-ui-skills-input"
                value={skillSearchQuery}
                onChange={(event) => setSkillSearchQuery(event.target.value)}
                placeholder="search installed skills"
              />
              <select
                aria-label="installed skill status"
                className="deckgo-input deck-ui-skills-input"
                value={skillStatusFilter}
                onChange={(event) => setSkillStatusFilter(event.target.value as SkillStatusFilter)}
              >
                {SKILL_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="deckgo-actions deck-ui-skills-actions">
              <button
                className="deckgo-button deck-ui-skills-button"
                type="button"
                onClick={() => void refresh(selectedSkillKey)}
              >
                Refresh skills
              </button>
              <button
                className="deckgo-button is-primary deck-ui-skills-button"
                type="button"
                onClick={() => void runToggle(true)}
                disabled={!selectedSkill || actionState !== "idle" || selectedSkill.enabled}
              >
                {actionState === "updating" ? "Updating" : "Enable"}
              </button>
              <button
                className="deckgo-button is-danger deck-ui-skills-button"
                type="button"
                onClick={() => void runToggle(false)}
                disabled={!selectedSkill || actionState !== "idle" || !selectedSkill.enabled}
              >
                {actionState === "updating" ? "Updating" : "Disable"}
              </button>
            </div>
            {error ? <p className="deckgo-note deck-ui-skills-error">{error}</p> : null}
            {skills.length === 0 ? (
              <p className="deckgo-note deck-ui-skills-empty">No skills reported.</p>
            ) : filteredSkills.length === 0 ? (
              <p className="deckgo-note deck-ui-skills-empty">No installed skills match filters.</p>
            ) : (
              <ul
                className="deckgo-shell-list deck-ui-skills-list"
                aria-label="installed skill list"
              >
                {filteredSkills.map((skill) => (
                  <li key={skill.key}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-skills-row ${selectedSkill?.key === skill.key ? "is-selected" : ""}`}
                      onClick={() => setSelectedSkillKey(skill.key)}
                    >
                      <strong>
                        {skill.emoji ? `${skill.emoji} ` : ""}
                        {skill.name}
                      </strong>
                      <div className="deckgo-meta">
                        key: {skill.key} | source: {skill.source} | status: {skill.status}
                      </div>
                      <div className="deckgo-meta">enabled: {skill.enabled ? "yes" : "no"}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
        <article className="deckgo-card is-float deck-ui-skills-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">ClawHub</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Gateway-backed skill hub search, detail, install, bins, and update-all actions.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
            <div className="deckgo-actions deck-ui-skills-actions">
              <input
                aria-label="skill hub search"
                className="deckgo-input deck-ui-skills-input"
                value={hubQuery}
                onChange={(event) => setHubQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void runHubSearch();
                  }
                }}
                placeholder="Search ClawHub skills"
              />
              <button
                className="deckgo-button is-primary deck-ui-skills-button"
                type="button"
                onClick={() => void runHubSearch()}
                disabled={hubState === "loading" || !hubQuery.trim()}
              >
                {hubState === "loading" ? "Searching" : "Search hub"}
              </button>
              <button
                className="deckgo-button deck-ui-skills-button"
                type="button"
                onClick={() => void runHubUpdateAll()}
                disabled={hubActionState !== "idle"}
              >
                {hubActionState === "updating" ? "Updating" : "Update all ClawHub"}
              </button>
            </div>
            {hubBins.length ? (
              <div className="deckgo-pill-row deck-ui-skills-status-row">
                {hubBins.map((bin) => (
                  <button
                    className={`deckgo-pill ${selectedHubBin === bin ? "is-positive" : ""}`}
                    key={bin}
                    type="button"
                    onClick={() => selectHubBin(bin)}
                  >
                    {bin}
                  </button>
                ))}
              </div>
            ) : null}
            {hubError ? <p className="deckgo-note deck-ui-skills-error">{hubError}</p> : null}
            {hubResults.length ? (
              <ul className="deckgo-shell-list deck-ui-skills-list">
                {hubResults.map((result) => (
                  <li key={result.slug}>
                    <button
                      type="button"
                      className="deckgo-selectable-card deck-ui-skills-row"
                      onClick={() => void loadHubDetail(result.slug)}
                    >
                      <strong>{result.displayName}</strong>
                      <div className="deckgo-meta">
                        slug: {result.slug}
                        {result.version ? ` | version: ${result.version}` : ""}
                      </div>
                      {result.summary ? <div className="deckgo-meta">{result.summary}</div> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="deckgo-note deck-ui-skills-empty">No ClawHub results loaded.</p>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-skills-column">
        <article className="deckgo-card is-float deck-ui-skills-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected skill</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Manage inventory, setup visibility, direct enable/disable, hub search, and install
            actions from the live skill inventory.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-skills-body">
            {selectedSkill ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-skills-hero">
                  <div>
                    <p className="deckgo-kicker">Skill</p>
                    <strong>{selectedSkill.name}</strong>
                    <p className="deckgo-note">{selectedSkill.description || "No description"}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">source {selectedSkill.source}</span>
                    <span className="deckgo-pill">status {selectedSkill.status}</span>
                  </div>
                </div>
                <div className="deckgo-grid deckgo-grid-2 deck-ui-skills-detail-stats">
                  <ShellStat label="enabled" value={selectedSkill.enabled ? "yes" : "no"} />
                  <ShellStat label="primary env" value={selectedSkill.primaryEnv || "n/a"} />
                </div>
                {selectedSkill.missingRequirements?.length ? (
                  <JsonDetails
                    title="Missing requirements"
                    payload={selectedSkill.missingRequirements}
                  />
                ) : null}
                <div className="deckgo-surface-tile deck-ui-skills-surface">
                  <p className="deckgo-surface-label">Skill configuration</p>
                  <label className="deckgo-label">
                    <span>API key</span>
                    <input
                      className="deckgo-input deck-ui-skills-input"
                      type="password"
                      value={apiKeyDraft}
                      onChange={(event) => setApiKeyDraft(event.target.value)}
                      placeholder={selectedSkill.primaryEnv || "api key"}
                    />
                  </label>
                  <label className="deckgo-label">
                    <span>Environment JSON</span>
                    <textarea
                      aria-label="skill env json"
                      className="deckgo-textarea deck-ui-skills-textarea"
                      rows={8}
                      value={envDraft}
                      onChange={(event) => setEnvDraft(event.target.value)}
                    />
                  </label>
                  <div className="deckgo-actions deck-ui-skills-actions">
                    <button
                      className="deckgo-button is-primary deck-ui-skills-button"
                      type="button"
                      onClick={() => void runConfigSave()}
                      disabled={!selectedSkill || actionState !== "idle"}
                    >
                      {actionState === "updating" ? "Saving" : "Save config"}
                    </button>
                  </div>
                </div>
                {selectedSkill.installOptions?.length ? (
                  <div className="deckgo-surface-tile deck-ui-skills-surface">
                    <p className="deckgo-surface-label">Install options</p>
                    <ul className="deckgo-shell-list deck-ui-skills-list">
                      {selectedSkill.installOptions.map((option) => (
                        <li key={option.id}>
                          <div className="deckgo-selectable-card deck-ui-skills-row">
                            <strong>{option.label}</strong>
                            <div className="deckgo-meta">
                              id: {option.id} | bins:{" "}
                              {option.bins.length > 0 ? option.bins.join(", ") : "n/a"}
                            </div>
                            <div className="deckgo-actions deck-ui-skills-actions deck-ui-skills-actions-offset">
                              <button
                                className="deckgo-button deck-ui-skills-button"
                                type="button"
                                onClick={() => void runInstall(option.id)}
                                disabled={actionState !== "idle"}
                              >
                                {actionState === "installing" ? "Installing" : "Install"}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <JsonDetails title="Skill payload" payload={selectedSkill} />
              </>
            ) : (
              <p className="deckgo-note deck-ui-skills-empty">Choose a skill to inspect it.</p>
            )}
            {actionResult ? <JsonDetails title="Last skill action" payload={actionResult} /> : null}
            <div className="deckgo-surface-tile deck-ui-skills-surface">
              <p className="deckgo-surface-label">Agent skill matrix</p>
              <p className="deckgo-note">
                Agent skill assignments are loaded from each agent's Gateway-backed skill policy.
              </p>
              <div className="deckgo-actions deck-ui-skills-actions deck-ui-skills-actions-offset">
                <button
                  className="deckgo-button deck-ui-skills-button"
                  type="button"
                  onClick={() => void refreshAgentSkillMatrix()}
                  disabled={matrixState === "loading"}
                >
                  {matrixState === "loading" ? "Loading matrix" : "Refresh matrix"}
                </button>
              </div>
              {matrixError ? <p className="deckgo-note">{matrixError}</p> : null}
              {agents.length && skills.length ? (
                <div className="deck-ui-skills-table-shell">
                  <table className="deckgo-table">
                    <thead>
                      <tr>
                        <th>skill</th>
                        {agents.map((agent) => (
                          <th key={agent.id}>
                            <button
                              className="deckgo-button deck-ui-skills-button"
                              type="button"
                              title={agent.id}
                              onClick={() => navigateToAgent(ui, agent.id, "skills")}
                            >
                              {agent.name || agent.id}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {skills.map((skill) => (
                        <tr key={skill.key}>
                          <td>{skill.name || skill.key}</td>
                          {agents.map((agent) => {
                            const config = agentSkillsByAgent[agent.id];
                            const mode = normalizeAgentSkillMode(config?.mode);
                            const assigned = Boolean(config?.skills.includes(skill.key));
                            const actionKey = `${agent.id}:${skill.key}`;
                            return (
                              <td key={agent.id}>
                                {!config ? (
                                  <span className="deckgo-pill is-muted">n/a</span>
                                ) : mode === "all" ? (
                                  <span className="deckgo-pill is-positive">all skills</span>
                                ) : (
                                  <button
                                    className={`deckgo-pill ${assigned ? "is-positive" : "is-muted"}`}
                                    type="button"
                                    aria-label={`${assigned ? "Remove" : "Add"} ${skill.key} for ${agent.id}`}
                                    disabled={Boolean(matrixActionKey)}
                                    onClick={() => void toggleMatrixSkill(agent, skill)}
                                  >
                                    {matrixActionKey === actionKey
                                      ? "updating"
                                      : assigned
                                        ? "included"
                                        : "excluded"}
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="deckgo-note deck-ui-skills-empty">No agent skill matrix loaded.</p>
              )}
              {matrixActionResult ? (
                <JsonDetails title="Last matrix action" payload={matrixActionResult} />
              ) : null}
            </div>
            <div className="deckgo-surface-tile deck-ui-skills-surface">
              <p className="deckgo-surface-label">ClawHub detail</p>
              {hubDetailState === "loading" ? (
                <p className="deckgo-note">Loading detail...</p>
              ) : null}
              {hubDetail?.skill ? (
                <>
                  <div className="deckgo-panel-hero-strip deck-ui-skills-hero">
                    <div>
                      <p className="deckgo-kicker">Hub skill</p>
                      <strong>{hubDetail.skill.displayName}</strong>
                      <p className="deckgo-note">
                        {hubDetail.skill.summary || hubDetail.skill.slug}
                      </p>
                    </div>
                    <div className="deckgo-pill-row">
                      <span className="deckgo-pill">slug {hubDetail.skill.slug}</span>
                      <span className="deckgo-pill">
                        version {hubDetail.latestVersion?.version ?? "n/a"}
                      </span>
                    </div>
                  </div>
                  <div className="deckgo-grid deckgo-grid-2 deck-ui-skills-detail-stats">
                    <ShellStat
                      label="owner"
                      value={hubDetail.owner?.displayName || hubDetail.owner?.handle || "n/a"}
                    />
                    <ShellStat label="updated" value={formatHubDate(hubDetail.skill.updatedAt)} />
                  </div>
                  {hubDetail.metadata?.os?.length ? (
                    <p className="deckgo-note">platforms: {hubDetail.metadata.os.join(", ")}</p>
                  ) : null}
                  {hubDetail.latestVersion?.changelog ? (
                    <JsonDetails
                      title="Hub changelog"
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
                      {hubActionState === "installing" ? "Installing" : "Install from ClawHub"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="deckgo-note deck-ui-skills-empty">
                  Search ClawHub and select a result to inspect it.
                </p>
              )}
            </div>
            {hubActionResult ? (
              <JsonDetails title="Last hub action" payload={hubActionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

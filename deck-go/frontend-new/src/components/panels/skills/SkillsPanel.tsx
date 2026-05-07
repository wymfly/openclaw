import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { DeckGoSkillEntry, DeckGoSkillHubDetailResponse, DeckGoSkillsResponse } from "../../../api";
import {
  fetchPluginApprovals,
  fetchSkillHubDetail,
  fetchSkills,
  installSkill,
  installSkillHub,
  searchSkillHub,
  updateSkill,
  updateSkillHub,
} from "../../../api";
import { navigateToPanel, navigateToPlugin } from "../../../deck-ui/panel-navigation";
import { useDeckUI } from "../../../deck-ui/ui-store";
import {
  IconAlert,
  IconBolt,
  IconCheck,
  IconRefresh,
  IconSearch,
  IconX,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { AddBinDialog } from "./AddBinDialog";
import { InstallSkillWizard } from "./InstallSkillWizard";
import { SkillAgentUsageSection } from "./SkillAgentUsageSection";
import {
  envRecordToRows,
  envRowsHaveInvalidKeys,
  rowsToEnvRecord,
  SkillEnvKeyValueEditor,
  type SkillEnvRow,
} from "./SkillEnvKeyValueEditor";
import { SkillSecretDialog } from "./SkillSecretDialog";
import { SkillUninstallHandoffBanner } from "./SkillUninstallHandoffBanner";
import { SkillUpdateAllClawHubDrawer } from "./SkillUpdateAllClawHubDrawer";
import {
  normalizeSkill,
  SKILL_STATUS_FILTERS,
  type PanelState,
  type SkillStatusFilter,
} from "./skill-model";
import "./skills-panel.css";

type SourceFilter = DeckGoSkillEntry["source"] | "all";
type ActiveDialog = "secret" | "env" | "bin" | "install" | "updateAll" | null;

const SOURCE_FILTERS: SourceFilter[] = [
  "all",
  "bundled",
  "managed",
  "workspace",
  "extra",
  "personal",
  "project",
  "unknown",
];

export function SkillsPanel() {
  const t = useTranslations("skills");
  const ui = useDeckUI();
  const [payload, setPayload] = useState<DeckGoSkillsResponse | null>(null);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [selectedSkillKey, setSelectedSkillKey] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SkillStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [actionState, setActionState] = useState<"idle" | "installing" | "updating">("idle");
  const [error, setError] = useState("");
  const [approvalCount, setApprovalCount] = useState(0);
  const [hubDetail, setHubDetail] = useState<DeckGoSkillHubDetailResponse | null>(null);
  const [installSetupMessage, setInstallSetupMessage] = useState("");
  const [envRows, setEnvRows] = useState<SkillEnvRow[]>(() => envRecordToRows());

  const refresh = async (preferredSkillKey?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchSkills();
      const normalized = (next.skills ?? []).map(normalizeSkill);
      setPayload({ ...next, skills: normalized });
      setSelectedSkillKey((current) => {
        const preferred = preferredSkillKey?.trim();
        if (preferred && normalized.some((skill) => skill.key === preferred)) {
          return preferred;
        }
        if (current && normalized.some((skill) => skill.key === current)) {
          return current;
        }
        return normalized[0]?.key ?? "";
      });
      setError("");
      setLoadState("ready");
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "skills fetch failed");
    }
  };

  const refreshApprovals = async () => {
    try {
      const approvals = await fetchPluginApprovals();
      const entries = Array.isArray(approvals)
        ? approvals
        : (approvals.entries ?? []);
      setApprovalCount(entries.filter((entry) => !entry.decision && entry.status !== "resolved").length);
    } catch {
      setApprovalCount(0);
    }
  };

  useEffect(() => {
    void refresh();
    void refreshApprovals();
  }, []);

  const skills = useMemo(() => (payload?.skills ?? []).map(normalizeSkill), [payload]);
  const selectedSkill = skills.find((skill) => skill.key === selectedSkillKey) ?? skills[0] ?? null;
  const managedSkills = skills.filter((skill) => skill.source === "managed");
  const visibleSkills = useMemo(() => {
    const search = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (statusFilter !== "all" && skill.status !== statusFilter) {
        return false;
      }
      if (sourceFilter !== "all" && skill.source !== sourceFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [skill.key, skill.name, skill.description, skill.primaryEnv, skill.source, skill.sourceRaw]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [query, skills, sourceFilter, statusFilter]);

  useEffect(() => {
    const env = selectedSkill?.config?.env;
    setEnvRows(
      envRecordToRows(
        typeof env === "object" && env !== null ? (env as Record<string, unknown>) : undefined,
      ),
    );
  }, [selectedSkill?.key, selectedSkill?.config]);

  const runToggle = async (skill: DeckGoSkillEntry, enabled: boolean) => {
    setActionState("updating");
    try {
      await updateSkill(skill.key, { enabled });
      await refresh(skill.key);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runSecretSave = async (apiKey: string) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      await updateSkill(selectedSkill.key, { apiKey });
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill apiKey update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runSecretClear = async () => {
    if (!selectedSkill) {
      return;
    }
    setActionState("updating");
    try {
      await updateSkill(selectedSkill.key, { apiKey: "" });
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill apiKey clear failed");
    } finally {
      setActionState("idle");
    }
  };

  const runEnvSave = async () => {
    if (!selectedSkill || envRowsHaveInvalidKeys(envRows)) {
      return;
    }
    setActionState("updating");
    try {
      await updateSkill(selectedSkill.key, { env: rowsToEnvRecord(envRows) });
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill env update failed");
    } finally {
      setActionState("idle");
    }
  };

  const runInstallRecipe = async (installId: string) => {
    if (!selectedSkill) {
      return;
    }
    setActionState("installing");
    try {
      await installSkill(selectedSkill.name, installId);
      setActiveDialog(null);
      await refresh(selectedSkill.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill install recipe failed");
    } finally {
      setActionState("idle");
    }
  };

  const previewWizardSlug = async (slug: string) => {
    await searchSkillHub(slug, 5);
    const detail = await fetchSkillHubDetail(slug);
    setHubDetail(detail);
  };

  const runWizardInstall = async (input: {
    slug: string;
    apiKey?: string;
    env?: Record<string, string>;
  }) => {
    setActionState("installing");
    setInstallSetupMessage("");
    try {
      const installed = await installSkillHub(input.slug);
      const skillKey = installed.skillKey || installed.slug || input.slug;
      if (input.apiKey || input.env) {
        try {
          await updateSkill(skillKey, {
            ...(input.apiKey ? { apiKey: input.apiKey } : {}),
            ...(input.env ? { env: input.env } : {}),
          });
        } catch {
          setInstallSetupMessage(t("installSetupRecoverable"));
        }
      }
      await refresh(skillKey);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill hub install failed");
    } finally {
      setActionState("idle");
    }
  };

  const runUpdateAll = async () => {
    setActionState("updating");
    try {
      await updateSkillHub();
      setActiveDialog(null);
      await refresh(selectedSkill?.key);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "skill hub update failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="skills-panel" data-testid="skills-panel">
      <header className="skills-panel__page-header">
        <div>
          <p className="skills-panel__eyebrow">{t("catalogEyebrow")}</p>
          <h1 className="skills-panel__title">{t("title")}</h1>
          <p className="skills-panel__description">{t("productDescription")}</p>
        </div>
        <div className="skills-panel__header-pills">
          <button className="skills-panel__button is-primary" type="button" onClick={() => setActiveDialog("install")}>
            {t("installFromClawHub")}
          </button>
          <button className="skills-panel__button" type="button" onClick={() => navigateToPanel(ui, "approvals")}>
            {t("approvalsPending", { count: approvalCount })}
          </button>
        </div>
      </header>

      <div className="skills-panel__kpi-strip">
        <Metric label={t("installedKpi")} value={skills.length} />
        <Metric label={t("readyKpi")} value={skills.filter((skill) => skill.status === "ready").length} />
        <Metric label={t("needsSetupKpi")} value={skills.filter((skill) => skill.status === "needs-setup").length} />
        <Metric label={t("managedKpi")} value={managedSkills.length} />
        <Metric label={t("agentUsage")} value={skills.reduce((sum, skill) => sum + skill.agentUsage.count, 0)} />
        <Metric label={t("disabledKpi")} value={skills.filter((skill) => !skill.enabled).length} />
      </div>

      <div className="skills-panel__toolbar">
        <label className="skills-panel__search">
          <IconSearch size={16} />
          <input
            aria-label={t("searchSkills")}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchInstalledLong")}
          />
        </label>
        <SegmentedGroup label={t("statusLabel")}>
          {SKILL_STATUS_FILTERS.map((status) => (
            <button
              key={status}
              className={`skills-panel__segment ${statusFilter === status ? "is-active" : ""}`}
              type="button"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? t("all") : t(`statusFilters.${status}`)}
            </button>
          ))}
        </SegmentedGroup>
        <SegmentedGroup label={t("sourceLabel")}>
          {SOURCE_FILTERS.map((source) => (
            <button
              key={source}
              className={`skills-panel__segment ${sourceFilter === source ? "is-active" : ""}`}
              type="button"
              onClick={() => setSourceFilter(source)}
            >
              {source === "all" ? t("sourceFilters.all") : t(`sourceFilters.${source}`)}
            </button>
          ))}
        </SegmentedGroup>
        <button className="skills-panel__button" type="button" onClick={() => void refresh(selectedSkill?.key)}>
          <IconRefresh size={14} />
          {t("refreshSkills")}
        </button>
      </div>

      {error ? <p className="skills-panel__note is-danger">{error}</p> : null}

      <div className="skills-panel__workbench">
        <SkillList
          loadState={loadState}
          selectedSkillKey={selectedSkill?.key ?? ""}
          skills={visibleSkills}
          onSelect={setSelectedSkillKey}
        />
        {selectedSkill ? (
          <SkillDetail
            managedSkills={managedSkills}
            selectedSkill={selectedSkill}
            ui={ui}
            actionState={actionState}
            onOpenBin={() => setActiveDialog("bin")}
            onOpenEnv={() => setActiveDialog("env")}
            onOpenSecret={() => setActiveDialog("secret")}
            onOpenUpdateAll={() => setActiveDialog("updateAll")}
            onToggle={(enabled) => void runToggle(selectedSkill, enabled)}
          />
        ) : (
          <p className="skills-panel__note">{t("selectSkillHint")}</p>
        )}
      </div>

      <SkillSecretDialog
        open={activeDialog === "secret"}
        actionState={actionState}
        skill={selectedSkill}
        onClose={() => setActiveDialog(null)}
        onSave={(apiKey) => void runSecretSave(apiKey)}
        onClear={() => void runSecretClear()}
      />

      {activeDialog === "env" && selectedSkill ? (
        <div className="skills-panel__modal-backdrop" role="presentation">
          <section className="skills-panel__modal" role="dialog" aria-modal="true" aria-label={t("editEnv")}>
            <div className="skills-panel__modal-head">
              <div>
                <p className="skills-panel__eyebrow">L1</p>
                <h2>{t("editEnv")}</h2>
              </div>
              <button className="skills-panel__button" type="button" onClick={() => setActiveDialog(null)}>
                {t("close")}
              </button>
            </div>
            <p className="skills-panel__note">{t("envImpactHint", { count: selectedSkill.agentUsage.count })}</p>
            <SkillEnvKeyValueEditor
              rows={envRows}
              keyLabel={t("envKey")}
              valueLabel={t("envValue")}
              rawLabel={t("showRawJson")}
              onRowsChange={setEnvRows}
            />
            <div className="skills-panel__modal-actions">
              <button className="skills-panel__button" type="button" onClick={() => setActiveDialog(null)}>
                {t("cancel")}
              </button>
              <button
                className="skills-panel__button is-primary"
                type="button"
                disabled={envRowsHaveInvalidKeys(envRows) || actionState !== "idle"}
                onClick={() => void runEnvSave()}
              >
                {t("saveEnv")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeDialog === "bin" && selectedSkill ? (
        <AddBinDialog
          actionState={actionState}
          selectedSkill={selectedSkill}
          onClose={() => setActiveDialog(null)}
          onInstall={(installId) => void runInstallRecipe(installId)}
        />
      ) : null}

      <InstallSkillWizard
        open={activeDialog === "install"}
        actionState={actionState}
        setupMessage={installSetupMessage}
        skills={skills}
        hubDetail={hubDetail}
        onClose={() => setActiveDialog(null)}
        onPreview={previewWizardSlug}
        onInstall={runWizardInstall}
      />

      <SkillUpdateAllClawHubDrawer
        open={activeDialog === "updateAll"}
        managedSkills={managedSkills}
        actionState={actionState}
        onClose={() => setActiveDialog(null)}
        onConfirm={() => void runUpdateAll()}
      />
    </section>
  );
}

function SkillList(props: {
  loadState: PanelState;
  selectedSkillKey: string;
  skills: DeckGoSkillEntry[];
  onSelect: (skillKey: string) => void;
}) {
  const t = useTranslations("skills");
  if (props.loadState === "loading") {
    return <StateBlock icon={<IconRefresh className="is-spinning" />} title={t("loadingSkills")} />;
  }
  if (props.skills.length === 0) {
    return <StateBlock icon={<IconBolt />} title={t("noSkillsReported")} />;
  }
  return (
    <div className="skills-panel__list-card">
      <div className="skills-panel__row-head" aria-hidden="true">
        <span>{t("skill")}</span>
        <span>{t("source")}</span>
        <span>{t("apiKey")}</span>
        <span>{t("agentUsage")}</span>
      </div>
      <ul className="skills-panel__rows" aria-label="installed skill list">
        {props.skills.map((skill) => (
          <li key={skill.key}>
            <button
              className={`skills-panel__row ${props.selectedSkillKey === skill.key ? "is-selected" : ""}`}
              type="button"
              aria-label={skill.name}
              onClick={() => props.onSelect(skill.key)}
            >
              <span className="skills-panel__row-identity">
                <strong>{skill.name}</strong>
                <span>
                  <code>{skill.key}</code>
                </span>
              </span>
              <SourcePill source={skill.source} />
              <span className={`skills-panel__count-pill skills-panel__api-key-pill ${skill.apiKeyConfigured ? "is-good" : ""}`}>
                {skill.apiKeyConfigured ? t("configured") : t("notConfigured")}
              </span>
              <span className="skills-panel__count-pill skills-panel__usage-pill" aria-label={t("agentUsageCount", { count: skill.agentUsage.count })}>
                {skill.agentUsage.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkillDetail(props: {
  managedSkills: DeckGoSkillEntry[];
  selectedSkill: DeckGoSkillEntry;
  ui: Parameters<typeof navigateToPanel>[0];
  actionState: "idle" | "installing" | "updating";
  onOpenBin: () => void;
  onOpenEnv: () => void;
  onOpenSecret: () => void;
  onOpenUpdateAll: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const skill = props.selectedSkill;
  const hasAgentImpact = skill.agentUsage.count > 0;
  const glyph = skill.name.trim().slice(0, 1).toUpperCase() || "#";

  return (
    <article className="skills-panel__detail">
      <header className="skills-panel__detail-hero">
        <div className="skills-panel__detail-main">
          <span className="skills-panel__glyph is-large" aria-hidden="true">
            {glyph}
          </span>
          <div>
            <div className="skills-panel__detail-title-row">
              <h1 className="skills-panel__title">{skill.name}</h1>
              <StatusPill status={skill.status} />
              <SourcePill source={skill.source} />
            </div>
            <p className="skills-panel__meta-line">
              <code>{skill.key}</code>
              <span>{skill.sourceRaw || t("unknown")}</span>
              <span>{t("agentUsageCount", { count: skill.agentUsage.count })}</span>
            </p>
          </div>
        </div>
        <div className="skills-panel__detail-actions">
          {hasAgentImpact ? <span className="skills-panel__pill is-warn">{t("agentImpactHint", { count: skill.agentUsage.count })}</span> : null}
          <button
            className={`skills-panel__button ${skill.enabled ? "is-danger" : "is-primary"}`}
            type="button"
            disabled={props.actionState !== "idle"}
            onClick={() => props.onToggle(!skill.enabled)}
          >
            {skill.enabled ? t("disable") : t("enable")}
          </button>
        </div>
      </header>

      <nav className="skills-panel__section-nav" aria-label={t("skillSections")}>
        {["identity", "sourceActivation", "apiKeySection", "env", "eligibilityHealth", "agentUsage", "owningPlugin", "dangerZone"].map((section) => (
          <a key={section} href={`#${section}`}>
            {t(`sections.${section}`)}
          </a>
        ))}
      </nav>

      <div className="skills-panel__sections">
        <Section id="identity" eyebrow={t("readOnly")} title={t("sections.identity")}>
          <p className="skills-panel__prose">{skill.description || t("noDescription")}</p>
          {skill.homepage ? <p className="skills-panel__note">{skill.homepage}</p> : null}
        </Section>

        <Section id="sourceActivation" eyebrow={skill.sourceRaw || t("unknown")} title={t("sections.sourceActivation")}>
          <div className="skills-panel__definition-list">
            <span>{t("source")}</span>
            <strong>{skill.source}</strong>
            <span>{t("rawSource")}</span>
            <code>{skill.sourceRaw || t("unknown")}</code>
          </div>
          {skill.unsupportedReasons?.perSkillUpgrade ? (
            <p className="skills-panel__note">{t("perSkillUpgradeUnsupported")}</p>
          ) : null}
          <div className="skills-panel__modal-actions">
            {skill.installOptions?.length ? (
              <button className="skills-panel__button" type="button" onClick={props.onOpenBin}>
                {t("runInstallRecipe")}
              </button>
            ) : null}
            {props.managedSkills.length ? (
              <button className="skills-panel__button" type="button" onClick={props.onOpenUpdateAll}>
                {t("updateAllManaged")}
              </button>
            ) : null}
          </div>
        </Section>

        <Section id="apiKeySection" eyebrow="L2" title={t("sections.apiKeySection")}>
          <p className={`skills-panel__pill ${skill.apiKeyConfigured ? "is-good" : ""}`}>
            {skill.apiKeyConfigured ? t("apiKeyConfigured") : t("apiKeyNotConfigured")}
          </p>
          <p className="skills-panel__note">{t("apiKeyHintUnsupported")}</p>
          <div className="skills-panel__modal-actions">
            <button className="skills-panel__button" type="button" onClick={props.onOpenSecret}>
              {t("updateApiKey")}
            </button>
            <button className="skills-panel__button" type="button" disabled>
              {t("rotateApiKey")} · gateway-rpc-missing
            </button>
          </div>
        </Section>

        <Section id="env" eyebrow="L1" title={t("sections.env")}>
          <p className="skills-panel__note">{t("envImpactHint", { count: skill.agentUsage.count })}</p>
          <button className="skills-panel__button" type="button" onClick={props.onOpenEnv}>
            {t("editEnv")}
          </button>
        </Section>

        <Section id="eligibilityHealth" eyebrow={t("status")} title={t("sections.eligibilityHealth")}>
          {skill.missingRequirements?.length ? (
            <ul className="skills-panel__stack-list">
              {skill.missingRequirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="skills-panel__note">{t("setupComplete")}</p>
          )}
        </Section>

        <SkillAgentUsageSection skill={skill} ui={props.ui} />

        <Section id="owningPlugin" eyebrow={t("readOnly")} title={t("sections.owningPlugin")}>
          {skill.owningPlugin ? (
            <button
              className="skills-panel__button"
              type="button"
              onClick={() => navigateToPlugin(props.ui, { pluginId: skill.owningPlugin?.id })}
            >
              {skill.owningPlugin.name || skill.owningPlugin.id}
            </button>
          ) : (
            <p className="skills-panel__note">{t("unknownPlugin")}</p>
          )}
        </Section>

        <Section id="dangerZone" eyebrow={t("unsupported")} title={t("sections.dangerZone")}>
          <SkillUninstallHandoffBanner skill={skill} />
        </Section>
      </div>
    </article>
  );
}

function Section(props: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="skills-panel__section" id={props.id}>
      <div className="skills-panel__section-head">
        <div>
          <p className="skills-panel__eyebrow">{props.eyebrow}</p>
          <h2>{props.title}</h2>
        </div>
      </div>
      {props.children}
    </section>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="skills-panel__metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function StatusPill(props: { status: DeckGoSkillEntry["status"] }) {
  const t = useTranslations("skills");
  const Icon = props.status === "ready" ? IconCheck : props.status === "needs-setup" ? IconAlert : IconX;
  return (
    <span className={`skills-panel__pill ${props.status === "ready" ? "is-good" : props.status === "needs-setup" ? "is-warn" : ""}`}>
      <Icon size={13} />
      {t(`statusFilters.${props.status}`)}
    </span>
  );
}

function SourcePill(props: { source: DeckGoSkillEntry["source"] }) {
  return <span className={`skills-panel__source is-${props.source}`}>{props.source}</span>;
}

function SegmentedGroup(props: { label: string; children: ReactNode }) {
  return (
    <div className="skills-panel__segments" role="tablist" aria-label={props.label}>
      {props.children}
    </div>
  );
}

function StateBlock(props: { icon: ReactNode; title: string }) {
  return (
    <div className="skills-panel__state">
      {props.icon}
      <p>{props.title}</p>
    </div>
  );
}

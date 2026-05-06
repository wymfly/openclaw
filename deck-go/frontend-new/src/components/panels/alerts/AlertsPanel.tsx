import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DeckGoAlertAction, DeckGoAlertRule } from "../../../api";
import { createAlertRule, deleteAlertRule, fetchAlertRules, updateAlertRule } from "../../../api";
import {
  IconAlert,
  IconBolt,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
} from "../../../design-system/icons";
import { useTranslations } from "../../../i18n/provider";
import { AlertsMetric } from "./AlertsMetric";
import { FiredAlertsList } from "./FiredAlertsList";
import { RuleForm, type AlertRuleInput } from "./RuleForm";
import { RuleList } from "./RuleList";
import "./alerts-panel.css";

type PanelState = "idle" | "loading" | "ready";
type AlertActionFilter = "all" | DeckGoAlertAction;
type AlertEnabledFilter = "all" | "enabled" | "disabled";
type AlertTabId = "overview" | "conditions" | "fires" | "audit";
type AlertView = "list" | "detail";
type LastAction = "created" | "updated" | "deleted" | "toggled" | null;

type DialogState =
  | { type: "create" }
  | { type: "edit"; rule: DeckGoAlertRule }
  | { type: "delete"; rule: DeckGoAlertRule }
  | { type: "test"; rule: DeckGoAlertRule }
  | null;

const DEFAULT_ENTITY_TYPES = [
  "channel",
  "model",
  "subagent",
  "budget",
  "approval",
  "plugin",
  "session",
  "test",
  "auth",
  "pr",
  "provider",
  "routing",
  "usage",
  "cron",
  "agent",
];

const ACTION_FILTERS: AlertActionFilter[] = ["all", "toast", "activity", "webhook"];
const ENABLED_FILTERS: AlertEnabledFilter[] = ["all", "enabled", "disabled"];

function formatCooldown(cooldownMs: number) {
  const minutes = Math.max(0, Math.round(cooldownMs / 60_000));
  if (minutes >= 1_440 && minutes % 1_440 === 0) {
    return `${minutes / 1_440}d`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function includesQuery(rule: DeckGoAlertRule, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [
    rule.id,
    rule.name,
    rule.entityType,
    rule.condition,
    rule.action,
    String(rule.threshold),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function AlertsPanel() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [rules, setRules] = useState<DeckGoAlertRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [view, setView] = useState<AlertView>("list");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [saving, setSaving] = useState(false);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<AlertActionFilter>("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterEnabled, setFilterEnabled] = useState<AlertEnabledFilter>("all");
  const [activeTab, setActiveTab] = useState<AlertTabId>("overview");
  const [dialog, setDialog] = useState<DialogState>(null);

  const entityTypes = useMemo(() => {
    const values = new Set(DEFAULT_ENTITY_TYPES);
    for (const rule of rules) {
      if (rule.entityType) {
        values.add(rule.entityType);
      }
    }
    return Array.from(values).toSorted();
  }, [rules]);

  const enabledCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const webhookCount = useMemo(
    () => rules.filter((rule) => rule.action === "webhook").length,
    [rules],
  );
  const firedCount = useMemo(() => rules.filter((rule) => rule.lastFiredAt).length, [rules]);
  const selectedRule = useMemo(
    () => rules.find((rule) => rule.id === selectedRuleId) ?? rules[0] ?? null,
    [rules, selectedRuleId],
  );
  const filteredRules = useMemo(
    () =>
      rules.filter((rule) => {
        if (!includesQuery(rule, searchQuery.trim())) {
          return false;
        }
        if (filterAction !== "all" && rule.action !== filterAction) {
          return false;
        }
        if (filterEntity !== "all" && rule.entityType !== filterEntity) {
          return false;
        }
        if (filterEnabled === "enabled" && !rule.enabled) {
          return false;
        }
        if (filterEnabled === "disabled" && rule.enabled) {
          return false;
        }
        return true;
      }),
    [filterAction, filterEnabled, filterEntity, rules, searchQuery],
  );

  const refresh = useCallback(
    async (preferredRuleId?: string) => {
      setLoadState("loading");
      try {
        const response = await fetchAlertRules();
        const nextRules = response.rules ?? [];
        setRules(nextRules);
        setLoadState("ready");
        setError("");
        setSelectedRuleId((current) => {
          if (preferredRuleId && nextRules.some((rule) => rule.id === preferredRuleId)) {
            return preferredRuleId;
          }
          if (current && nextRules.some((rule) => rule.id === current)) {
            return current;
          }
          return nextRules[0]?.id ?? null;
        });
      } catch (loadError) {
        setLoadState("idle");
        setError(loadError instanceof Error ? loadError.message : t("loadRulesFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("list");
        searchRef.current?.focus();
      } else if (meta && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setDialog({ type: "create" });
      } else if (meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void refresh(selectedRule?.id);
      } else if (event.key === "Escape") {
        if (dialog) {
          event.preventDefault();
          setDialog(null);
        } else if (view === "detail") {
          event.preventDefault();
          setView("list");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, refresh, selectedRule?.id, view]);

  const handleSubmit = async (input: AlertRuleInput) => {
    setSaving(true);
    try {
      const result =
        dialog?.type === "edit"
          ? await updateAlertRule(dialog.rule.id, input)
          : await createAlertRule(input);
      await refresh(result.rule.id);
      setLastAction(dialog?.type === "edit" ? "updated" : "created");
      setDialog(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rule: DeckGoAlertRule) => {
    setSaving(true);
    try {
      await deleteAlertRule(rule.id);
      await refresh();
      setLastAction("deleted");
      setDialog(null);
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: DeckGoAlertRule) => {
    setSaving(true);
    try {
      const result = await updateAlertRule(rule.id, { enabled: !rule.enabled });
      await refresh(result.rule.id);
      setLastAction("toggled");
      setError("");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("saveRuleFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="alerts-panel" data-testid="alerts-panel">
      <header className="alerts-panel__header">
        <div className="alerts-panel__title-stack">
          <p className="alerts-panel__eyebrow">{t("eyebrow")}</p>
          <h2 className="alerts-panel__title">{t("title")}</h2>
          <p className="alerts-panel__description">{t("subtitle")}</p>
        </div>
        <div className="alerts-panel__header-actions">
          <button
            className="alerts-panel__button"
            type="button"
            disabled={loadState === "loading"}
            onClick={() => void refresh(selectedRule?.id)}
          >
            <IconRefresh size={15} />
            {t("refresh")}
          </button>
          <button
            className="alerts-panel__button is-primary"
            type="button"
            onClick={() => setDialog({ type: "create" })}
          >
            <IconPlus size={15} />
            {t("addRule")}
          </button>
        </div>
      </header>

      <div className="alerts-panel__metrics">
        <AlertsMetric label={t("ruleMetric")} value={String(rules.length)} tone="neutral" />
        <AlertsMetric label={t("enabledMetric")} value={String(enabledCount)} tone="positive" />
        <AlertsMetric
          label={t("webhookMetric")}
          value={String(webhookCount)}
          tone={webhookCount > 0 ? "warning" : "neutral"}
        />
        <AlertsMetric
          label={t("firedMetric")}
          value={String(firedCount)}
          tone={firedCount > 0 ? "danger" : "neutral"}
        />
      </div>

      {error ? (
        <p className="alerts-panel__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="alerts-panel__toolbar">
        <label className="alerts-panel__search">
          <IconSearch size={15} />
          <input
            ref={searchRef}
            aria-label="alert search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </label>

        <div className="alerts-panel__seg" role="tablist" aria-label={t("actionFilter")}>
          {ACTION_FILTERS.map((action) => (
            <button
              aria-selected={filterAction === action}
              className={filterAction === action ? "is-active" : ""}
              key={action}
              role="tab"
              type="button"
              onClick={() => setFilterAction(action)}
            >
              {action === "all" ? t("allActions") : t(action)}
            </button>
          ))}
        </div>

        <select
          aria-label="alert entity filter"
          className="alerts-panel__select"
          value={filterEntity}
          onChange={(event) => setFilterEntity(event.target.value)}
        >
          <option value="all">{t("allEntities")}</option>
          {entityTypes.map((entityType) => (
            <option key={entityType} value={entityType}>
              {entityType}
            </option>
          ))}
        </select>

        <div className="alerts-panel__seg" role="tablist" aria-label={t("enabledFilter")}>
          {ENABLED_FILTERS.map((filter) => (
            <button
              aria-selected={filterEnabled === filter}
              className={filterEnabled === filter ? "is-active" : ""}
              key={filter}
              role="tab"
              type="button"
              onClick={() => setFilterEnabled(filter)}
            >
              {t(filter)}
            </button>
          ))}
        </div>
      </div>

      <div className={`alerts-panel__workspace alerts-panel__workspace--${view}`}>
        {view === "list" ? (
          <aside className="alerts-panel__list-shell">
            <div className="alerts-panel__section-head">
              <div>
                <h3>{t("ruleInventory")}</h3>
                <p>
                  {loadState === "loading" ? tc("loading") : t(loadState)} ·{" "}
                  {t("ruleCount", { count: filteredRules.length })}
                </p>
              </div>
              <span className={`alerts-panel__pill ${loadState === "ready" ? "is-positive" : ""}`}>
                {loadState === "loading" ? tc("loading") : t(loadState)}
              </span>
            </div>

            <RuleList
              rules={filteredRules}
              selectedRuleId={selectedRule?.id ?? null}
              loading={loadState === "loading" && rules.length === 0}
              onCreate={() => setDialog({ type: "create" })}
              onSelect={(rule) => {
                setSelectedRuleId(rule.id);
                setActiveTab("overview");
                setView("detail");
              }}
              onTestFire={(rule) => {
                setSelectedRuleId(rule.id);
                setDialog({ type: "test", rule });
              }}
              onToggleEnabled={(rule) => void handleToggle(rule)}
            />
          </aside>
        ) : null}

        {view === "detail" ? (
          <main className="alerts-panel__detail-shell">
            {selectedRule ? (
              <>
                <div className="alerts-panel__detail-hero">
                  <button
                    className="alerts-panel__button"
                    type="button"
                    onClick={() => setView("list")}
                  >
                    {t("backToRules")}
                  </button>
                  <div className="alerts-panel__entity-glyph" aria-hidden="true">
                    {selectedRule.entityType.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="alerts-panel__detail-copy">
                    <p className="alerts-panel__eyebrow">{t("selected")}</p>
                    <h3>{selectedRule.name}</h3>
                    <p>
                      {selectedRule.id} · {selectedRule.entityType} · {selectedRule.condition}{" "}
                      {selectedRule.threshold}
                    </p>
                  </div>
                  <div className="alerts-panel__detail-actions">
                    <button
                      className="alerts-panel__button"
                      type="button"
                      onClick={() => setDialog({ type: "test", rule: selectedRule })}
                    >
                      <IconBolt size={15} />
                      {t("testFirePreview")}
                    </button>
                    <button
                      className="alerts-panel__button"
                      disabled={saving}
                      type="button"
                      onClick={() => void handleToggle(selectedRule)}
                    >
                      {selectedRule.enabled ? t("disableRule") : t("enableRule")}
                    </button>
                    <button
                      className="alerts-panel__button"
                      type="button"
                      onClick={() => setDialog({ type: "edit", rule: selectedRule })}
                    >
                      <IconEdit size={15} />
                      {t("editRule")}
                    </button>
                    <button
                      className="alerts-panel__button is-danger"
                      disabled={saving}
                      type="button"
                      onClick={() => setDialog({ type: "delete", rule: selectedRule })}
                    >
                      <IconTrash size={15} />
                      {t("deleteRule")}
                    </button>
                  </div>
                </div>

                <div className="alerts-panel__tabbar" role="tablist" aria-label={t("detailTabs")}>
                  {(["overview", "conditions", "fires", "audit"] satisfies AlertTabId[]).map(
                    (tab) => (
                      <button
                        aria-selected={activeTab === tab}
                        className={activeTab === tab ? "is-active" : ""}
                        key={tab}
                        role="tab"
                        type="button"
                        onClick={() => setActiveTab(tab)}
                      >
                        {t(tab)}
                      </button>
                    ),
                  )}
                </div>

                {activeTab === "overview" ? (
                  <div className="alerts-panel__field-grid">
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("triggerExpression")}</p>
                      <strong className="alerts-panel__code">
                        {selectedRule.entityType} {selectedRule.condition} {selectedRule.threshold}
                      </strong>
                    </div>
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("actionDelivery")}</p>
                      <strong>{t(selectedRule.action)}</strong>
                      <p>{t("deliveryFallback")}</p>
                    </div>
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("cooldown")}</p>
                      <strong>{formatCooldown(selectedRule.cooldownMs)}</strong>
                    </div>
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("lastFired")}</p>
                      <strong>{formatDate(selectedRule.lastFiredAt, t("never"))}</strong>
                    </div>
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("createdAt")}</p>
                      <strong>{formatDate(selectedRule.createdAt, t("notAvailable"))}</strong>
                    </div>
                    <div className="alerts-panel__surface">
                      <p className="alerts-panel__label">{t("updatedAt")}</p>
                      <strong>{formatDate(selectedRule.updatedAt, t("notAvailable"))}</strong>
                    </div>
                  </div>
                ) : null}

                {activeTab === "conditions" ? (
                  <div className="alerts-panel__condition-grid">
                    <div className="alerts-panel__condition-card">
                      <p className="alerts-panel__label">{t("conditionDsl")}</p>
                      <strong>{selectedRule.condition}</strong>
                      <p>{t("conditionDslFallback")}</p>
                    </div>
                    <div className="alerts-panel__condition-card">
                      <p className="alerts-panel__label">{t("threshold")}</p>
                      <strong>{selectedRule.threshold}</strong>
                      <p>
                        {selectedRule.entityType} · {t(selectedRule.action)} ·{" "}
                        {formatCooldown(selectedRule.cooldownMs)}
                      </p>
                    </div>
                  </div>
                ) : null}

                {activeTab === "fires" ? <FiredAlertsList rule={selectedRule} /> : null}

                {activeTab === "audit" ? (
                  <div className="alerts-panel__unsupported">
                    <IconInfoBlock />
                    <div>
                      <strong>{t("auditUnavailableTitle")}</strong>
                      <p>{t("auditUnavailableDescription")}</p>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="alerts-panel__empty-state">
                <IconAlert size={22} />
                <strong>{t("noRules")}</strong>
                <p>{t("emptyDescription")}</p>
                <button
                  className="alerts-panel__button is-primary"
                  type="button"
                  onClick={() => setDialog({ type: "create" })}
                >
                  <IconPlus size={15} />
                  {t("addRule")}
                </button>
              </div>
            )}

            {lastAction ? (
              <p className="alerts-panel__note">
                {t("lastAction")}: {t(lastAction)}
              </p>
            ) : null}
          </main>
        ) : null}
      </div>

      {dialog ? (
        <div className="alerts-panel__modal-backdrop" role="presentation">
          <section
            aria-label={
              dialog.type === "create"
                ? t("addRule")
                : dialog.type === "edit"
                  ? t("editRule")
                  : dialog.type === "delete"
                    ? t("deleteRule")
                    : t("testFirePreview")
            }
            aria-modal="true"
            className={`alerts-panel__modal alerts-panel__modal--${dialog.type}`}
            role="dialog"
          >
            {dialog.type === "create" || dialog.type === "edit" ? (
              <>
                <div className="alerts-panel__modal-head">
                  <div>
                    <p className="alerts-panel__eyebrow">
                      {dialog.type === "edit" ? t("editRule") : t("addRule")}
                    </p>
                    <h3>{dialog.type === "edit" ? dialog.rule.name : t("newRuleTitle")}</h3>
                  </div>
                  <button
                    className="alerts-panel__button"
                    type="button"
                    onClick={() => setDialog(null)}
                  >
                    {tc("cancel")}
                  </button>
                </div>
                <RuleForm
                  entityTypes={entityTypes}
                  rule={dialog.type === "edit" ? dialog.rule : undefined}
                  saving={saving}
                  onSubmit={handleSubmit}
                  onCancel={() => setDialog(null)}
                />
              </>
            ) : null}

            {dialog.type === "delete" ? (
              <>
                <div className="alerts-panel__modal-head">
                  <div>
                    <p className="alerts-panel__eyebrow">{t("deleteRule")}</p>
                    <h3>{dialog.rule.name}</h3>
                  </div>
                </div>
                <p className="alerts-panel__note">{t("deleteWarning")}</p>
                <div className="alerts-panel__actions">
                  <button
                    className="alerts-panel__button is-danger"
                    disabled={saving}
                    type="button"
                    onClick={() => void handleDelete(dialog.rule)}
                  >
                    {t("confirmDeleteAction")}
                  </button>
                  <button
                    className="alerts-panel__button"
                    type="button"
                    onClick={() => setDialog(null)}
                  >
                    {tc("cancel")}
                  </button>
                </div>
              </>
            ) : null}

            {dialog.type === "test" ? (
              <>
                <div className="alerts-panel__modal-head">
                  <div>
                    <p className="alerts-panel__eyebrow">{t("testFirePreview")}</p>
                    <h3>{dialog.rule.name}</h3>
                  </div>
                  <button
                    className="alerts-panel__button"
                    type="button"
                    onClick={() => setDialog(null)}
                  >
                    {tc("close")}
                  </button>
                </div>
                <div className="alerts-panel__unsupported">
                  <IconInfoBlock />
                  <div>
                    <strong>{t("testFireUnavailableTitle")}</strong>
                    <p>{t("testFireUnavailableDescription")}</p>
                  </div>
                </div>
                <pre className="alerts-panel__json">
                  {JSON.stringify(
                    {
                      ruleId: dialog.rule.id,
                      entityType: dialog.rule.entityType,
                      condition: dialog.rule.condition,
                      threshold: dialog.rule.threshold,
                      action: dialog.rule.action,
                    },
                    null,
                    2,
                  )}
                </pre>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function IconInfoBlock() {
  return (
    <span className="alerts-panel__info-icon" aria-hidden="true">
      i
    </span>
  );
}

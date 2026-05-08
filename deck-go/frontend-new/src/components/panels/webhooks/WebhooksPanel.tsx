import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { DeckGoWebhook, DeckGoWebhookDelivery } from "@/api-types";
import { useDataFabricTransports } from "../../../data/client/scoped-query-provider";
import {
  useCreateWebhookMutation,
  useDeleteWebhookMutation,
  useTestWebhookMutation,
  useUpdateWebhookMutation,
  webhookDeliveriesQueryOptions,
  webhooksListQueryOptions,
} from "../../../data/modules/webhooks";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import {
  AVAILABLE_WEBHOOK_EVENTS,
  DEFAULT_WEBHOOK_DRAFT,
  draftFromWebhook,
  formatWebhookEvents,
  parseWebhookEvents,
  webhookInputFromDraft,
  type PanelState,
  type WebhookDraft,
} from "./webhook-model";
import "./webhooks-panel.css";

type ActionState = "idle" | "creating" | "updating" | "testing" | "deleting";
type WebhookFilter = "all" | "enabled" | "disabled" | "failing";
type DetailTab = "overview" | "deliveries" | "settings" | "gaps";

const FILTERS: WebhookFilter[] = ["all", "enabled", "disabled", "failing"];
const DETAIL_TABS: DetailTab[] = ["overview", "deliveries", "settings", "gaps"];

function formatWebhookDate(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function webhookHealth(webhook: DeckGoWebhook) {
  if (!webhook.enabled) {
    return "disabled";
  }
  if (webhook.consecutiveFailures >= 3) {
    return "failing";
  }
  if (webhook.consecutiveFailures > 0) {
    return "degraded";
  }
  return "healthy";
}

function toneForHealth(health: string) {
  if (health === "healthy") {
    return "is-good";
  }
  if (health === "degraded") {
    return "is-warn";
  }
  if (health === "failing") {
    return "is-danger";
  }
  return "";
}

function safeWebhookPayload(webhook: DeckGoWebhook) {
  return {
    ...webhook,
    secret: webhook.secret ? "***redacted" : null,
  };
}

function parseMaybeJson(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function metricValue(value: number | string | null | undefined, fallback: string) {
  return value == null || value === "" ? fallback : value;
}

export function WebhooksPanel() {
  const t = useTranslations("webhooks");
  const queryClient = useQueryClient();
  const { bff } = useDataFabricTransports();
  const createWebhookMutation = useCreateWebhookMutation();
  const updateWebhookMutation = useUpdateWebhookMutation();
  const deleteWebhookMutation = useDeleteWebhookMutation();
  const testWebhookMutation = useTestWebhookMutation();
  const [webhooks, setWebhooks] = useState<DeckGoWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeckGoWebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WebhookFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingWebhookId, setEditingWebhookId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_WEBHOOK_DRAFT);
  const [confirmingDelete, setConfirmingDelete] = useState<DeckGoWebhook | null>(null);
  const [expandedDeliveryId, setExpandedDeliveryId] = useState("");

  const selectedWebhook =
    webhooks.find((webhook) => webhook.id === selectedWebhookId) ?? webhooks[0] ?? null;
  const editingWebhook = editingWebhookId
    ? (webhooks.find((webhook) => webhook.id === editingWebhookId) ?? null)
    : null;

  const loadDeliveries = async (webhookId: string) => {
    if (!webhookId) {
      setDeliveries([]);
      return;
    }
    const nextDeliveries = await queryClient.fetchQuery({
      ...webhookDeliveriesQueryOptions(bff, webhookId),
      staleTime: 0,
    });
    setDeliveries(nextDeliveries.deliveries ?? []);
  };

  const refresh = async (preferredWebhookId?: string) => {
    setLoadState("loading");
    try {
      const next = await queryClient.fetchQuery({
        ...webhooksListQueryOptions(bff),
        staleTime: 0,
      });
      const nextWebhooks = next.webhooks ?? [];
      setWebhooks(nextWebhooks);
      setLoadState("ready");
      setError("");
      const fallbackId =
        preferredWebhookId?.trim() || selectedWebhookId || nextWebhooks[0]?.id || "";
      const nextSelected = nextWebhooks.some((webhook) => webhook.id === fallbackId)
        ? fallbackId
        : nextWebhooks[0]?.id || "";
      setSelectedWebhookId(nextSelected);
      if (nextSelected) {
        await loadDeliveries(nextSelected);
      } else {
        setDeliveries([]);
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : t("loadFailed"));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedWebhookId) {
      setDeliveries([]);
      return;
    }
    setExpandedDeliveryId("");
    void loadDeliveries(selectedWebhookId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : t("deliveriesLoadFailed"));
    });
  }, [bff, queryClient, selectedWebhookId, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (builderOpen) {
        closeBuilder();
        return;
      }
      if (confirmingDelete && actionState !== "deleting") {
        setConfirmingDelete(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actionState, builderOpen, confirmingDelete]);

  const filteredWebhooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return webhooks.filter((webhook) => {
      const health = webhookHealth(webhook);
      if (filter === "enabled" && !webhook.enabled) {
        return false;
      }
      if (filter === "disabled" && webhook.enabled) {
        return false;
      }
      if (filter === "failing" && health !== "failing" && health !== "degraded") {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [webhook.name, webhook.url, webhook.id, ...webhook.events]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, query, webhooks]);

  const enabledCount = webhooks.filter((webhook) => webhook.enabled).length;
  const failingCount = webhooks.filter((webhook) => webhookHealth(webhook) === "failing").length;
  const degradedCount = webhooks.filter((webhook) => webhookHealth(webhook) === "degraded").length;
  const filterCounts: Record<WebhookFilter, number> = {
    all: webhooks.length,
    disabled: webhooks.filter((webhook) => !webhook.enabled).length,
    enabled: webhooks.filter((webhook) => webhook.enabled).length,
    failing: webhooks.filter((webhook) => {
      const health = webhookHealth(webhook);
      return health === "failing" || health === "degraded";
    }).length,
  };
  const successCount = deliveries.filter((delivery) => delivery.success).length;
  const successRate =
    deliveries.length === 0
      ? t("notAvailable")
      : `${Math.round((successCount / deliveries.length) * 100)}%`;

  const selectWebhook = (webhookId: string) => {
    setSelectedWebhookId(webhookId);
    setDetailTab("overview");
    setBuilderOpen(false);
    setEditingWebhookId("");
  };

  const openCreate = () => {
    setDraft(DEFAULT_WEBHOOK_DRAFT);
    setEditingWebhookId("");
    setBuilderOpen(true);
  };

  const openEdit = () => {
    if (!selectedWebhook) {
      return;
    }
    setDraft(draftFromWebhook(selectedWebhook));
    setEditingWebhookId(selectedWebhook.id);
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    if (actionState === "creating" || actionState === "updating") {
      return;
    }
    setBuilderOpen(false);
    setEditingWebhookId("");
    setDraft(DEFAULT_WEBHOOK_DRAFT);
  };

  const saveAction = async () => {
    const savingExisting = editingWebhook != null;
    setActionState(savingExisting ? "updating" : "creating");
    try {
      const input = webhookInputFromDraft(draft);
      const result = savingExisting
        ? await updateWebhookMutation.mutateAsync({ id: editingWebhook.id, input })
        : await createWebhookMutation.mutateAsync(input);
      setActionResult(safeWebhookPayload(result));
      setError("");
      setBuilderOpen(false);
      setEditingWebhookId("");
      setDraft(DEFAULT_WEBHOOK_DRAFT);
      await refresh(result.id);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : savingExisting
            ? t("updateFailed")
            : t("createFailed"),
      );
    } finally {
      setActionState("idle");
    }
  };

  const testAction = async () => {
    if (!selectedWebhook) {
      return;
    }
    setActionState("testing");
    try {
      const result = await testWebhookMutation.mutateAsync(selectedWebhook.id);
      setActionResult(result);
      setError("");
      await refresh(selectedWebhook.id);
      setDetailTab("deliveries");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("testFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!confirmingDelete) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteWebhookMutation.mutateAsync(confirmingDelete.id);
      setActionResult(result);
      setError("");
      setConfirmingDelete(null);
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="webhooks-panel" data-testid="webhooks-panel">
      <header className="webhooks-panel__topbar">
        <div className="webhooks-panel__title-stack">
          <p className="webhooks-panel__eyebrow">{t("automation")}</p>
          <h1 className="webhooks-panel__title">{t("title")}</h1>
          <p className="webhooks-panel__description">{t("panelDescription")}</p>
        </div>
        <div className="webhooks-panel__kpis">
          <WebhookKpi label={t("total")} value={webhooks.length} />
          <WebhookKpi label={t("enabled")} value={enabledCount} />
          <WebhookKpi
            label={t("failing")}
            tone={failingCount > 0 ? "danger" : undefined}
            value={failingCount}
          />
          <WebhookKpi label={t("successRate")} value={successRate} />
        </div>
      </header>

      <main className="webhooks-panel__workspace">
        <aside className="webhooks-panel__list-pane">
          <div className="webhooks-panel__list-head">
            <div>
              <p className="webhooks-panel__eyebrow">{t("receivers")}</p>
              <h2>{t("receiverInventory")}</h2>
            </div>
            <button
              className="webhooks-panel__button is-primary"
              type="button"
              onClick={openCreate}
            >
              {t("addWebhook")}
            </button>
          </div>

          <div className="webhooks-panel__status-row">
            <span
              className={`webhooks-panel__pill ${loadState === "ready" ? "is-good" : "is-warn"}`}
            >
              {t("statusPrefix")} {t(loadState)}
            </span>
            <span className="webhooks-panel__pill">
              {t("configuredCount", { count: webhooks.length })}
            </span>
            <button
              className="webhooks-panel__button"
              type="button"
              onClick={() => void refresh(selectedWebhookId)}
            >
              {t("refreshWebhooks")}
            </button>
          </div>

          <label className="webhooks-panel__field">
            <span>{t("searchWebhooks")}</span>
            <input
              className="webhooks-panel__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
            />
          </label>

          <div className="webhooks-panel__segments" role="tablist" aria-label={t("filters")}>
            {FILTERS.map((nextFilter) => (
              <button
                className={filter === nextFilter ? "is-active" : ""}
                key={nextFilter}
                type="button"
                onClick={() => setFilter(nextFilter)}
              >
                {t(`filter.${nextFilter}`)} {filterCounts[nextFilter]}
              </button>
            ))}
          </div>

          {error ? <p className="webhooks-panel__note is-danger">{error}</p> : null}

          {filteredWebhooks.length === 0 ? (
            <div className="webhooks-panel__empty">
              <strong>{webhooks.length === 0 ? t("noWebhooks") : t("noWebhooksMatch")}</strong>
              <p>{webhooks.length === 0 ? t("emptyDescription") : t("emptyFilterDescription")}</p>
              {webhooks.length > 0 ? (
                <p>
                  {[
                    query.trim() ? t("criteriaSearch", { value: query.trim() }) : "",
                    filter !== "all" ? t("criteriaFilter", { value: t(`filter.${filter}`) }) : "",
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
              ) : null}
              {webhooks.length > 0 ? (
                <button
                  className="webhooks-panel__button"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFilter("all");
                  }}
                >
                  {t("clearFilters")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="webhooks-panel__list">
              {filteredWebhooks.map((webhook) => {
                const health = webhookHealth(webhook);
                return (
                  <li key={webhook.id}>
                    <button
                      className={`webhooks-panel__receiver ${
                        selectedWebhook?.id === webhook.id ? "is-selected" : ""
                      }`}
                      type="button"
                      onClick={() => selectWebhook(webhook.id)}
                    >
                      <div>
                        <strong>{webhook.name}</strong>
                        <p>{webhook.url}</p>
                        <span>
                          {t("lastStatus")}: {metricValue(webhook.lastStatus, t("notAvailable"))} ·{" "}
                          {t("failures")}: {webhook.consecutiveFailures}
                        </span>
                      </div>
                      <div className="webhooks-panel__receiver-meta">
                        <span className={`webhooks-panel__pill ${toneForHealth(health)}`}>
                          {t(`health.${health}`)}
                        </span>
                        <small>{t("eventCount", { count: webhook.events.length })}</small>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="webhooks-panel__detail-pane">
          {selectedWebhook ? (
            <>
              <WebhookDetailHeader
                actionState={actionState}
                degradedCount={degradedCount}
                deliveries={deliveries}
                onDelete={() => setConfirmingDelete(selectedWebhook)}
                onEdit={openEdit}
                onTest={() => void testAction()}
                selectedWebhook={selectedWebhook}
              />

              <div className="webhooks-panel__tabs" role="tablist" aria-label={t("detailTabs")}>
                {DETAIL_TABS.map((tab) => (
                  <button
                    className={detailTab === tab ? "is-active" : ""}
                    key={tab}
                    type="button"
                    onClick={() => setDetailTab(tab)}
                  >
                    {t(`tab.${tab}`)}
                  </button>
                ))}
              </div>

              {detailTab === "overview" ? (
                <OverviewTab selectedWebhook={selectedWebhook} deliveries={deliveries} />
              ) : null}
              {detailTab === "deliveries" ? (
                <DeliveriesTab
                  deliveries={deliveries}
                  expandedDeliveryId={expandedDeliveryId}
                  onToggle={(deliveryId) =>
                    setExpandedDeliveryId((current) => (current === deliveryId ? "" : deliveryId))
                  }
                />
              ) : null}
              {detailTab === "settings" ? <SettingsTab selectedWebhook={selectedWebhook} /> : null}
              {detailTab === "gaps" ? <CapabilityGaps /> : null}

              {actionResult ? (
                <div className="webhooks-panel__surface">
                  <JsonDetails title={t("lastWebhookAction")} payload={actionResult} />
                </div>
              ) : null}
            </>
          ) : (
            <div className="webhooks-panel__empty is-detail">
              <strong>{t("noWebhooks")}</strong>
              <p>{t("emptyDescription")}</p>
              <button
                className="webhooks-panel__button is-primary"
                type="button"
                onClick={openCreate}
              >
                {t("addWebhook")}
              </button>
            </div>
          )}
        </section>
      </main>

      {builderOpen ? (
        <WebhookBuilderModal
          draft={draft}
          editing={Boolean(editingWebhook)}
          saving={actionState === "creating" || actionState === "updating"}
          onCancel={closeBuilder}
          onChange={setDraft}
          onSave={() => void saveAction()}
        />
      ) : null}

      {confirmingDelete ? (
        <DeleteConfirm
          deleting={actionState === "deleting"}
          webhook={confirmingDelete}
          onCancel={() => setConfirmingDelete(null)}
          onDelete={() => void deleteAction()}
        />
      ) : null}
    </section>
  );
}

function WebhookKpi(props: { label: string; value: string | number; tone?: "danger" }) {
  return (
    <div className={`webhooks-panel__kpi ${props.tone ? `is-${props.tone}` : ""}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function WebhookDetailHeader({
  actionState,
  degradedCount,
  deliveries,
  onDelete,
  onEdit,
  onTest,
  selectedWebhook,
}: {
  actionState: ActionState;
  degradedCount: number;
  deliveries: DeckGoWebhookDelivery[];
  onDelete: () => void;
  onEdit: () => void;
  onTest: () => void;
  selectedWebhook: DeckGoWebhook;
}) {
  const t = useTranslations("webhooks");
  const health = webhookHealth(selectedWebhook);
  const latestDelivery = deliveries[0] ?? null;

  return (
    <article className="webhooks-panel__hero-card">
      <div className="webhooks-panel__hero-main">
        <p className="webhooks-panel__eyebrow">{t("selectedWebhook")}</p>
        <h2>{selectedWebhook.name}</h2>
        <p>{selectedWebhook.url}</p>
        <div className="webhooks-panel__pill-row">
          <span className={`webhooks-panel__pill ${toneForHealth(health)}`}>
            {t(`health.${health}`)}
          </span>
          <span className="webhooks-panel__pill">
            {t("eventCount", { count: selectedWebhook.events.length })}
          </span>
          <span className="webhooks-panel__pill">
            {t("degradedCount", { count: degradedCount })}
          </span>
        </div>
      </div>
      <div className="webhooks-panel__hero-actions">
        <WebhookKpi
          label={t("lastStatus")}
          value={metricValue(selectedWebhook.lastStatus, t("notAvailable"))}
        />
        <WebhookKpi label={t("failures")} value={selectedWebhook.consecutiveFailures} />
        <WebhookKpi
          label={t("lastDelivery")}
          value={latestDelivery ? latestDelivery.eventType : t("notAvailable")}
        />
        <div className="webhooks-panel__actions">
          <button className="webhooks-panel__button" type="button" onClick={onEdit}>
            {t("editWebhook")}
          </button>
          <button
            className="webhooks-panel__button is-primary"
            disabled={actionState === "testing"}
            type="button"
            onClick={onTest}
          >
            {actionState === "testing" ? t("testing") : t("testDelivery")}
          </button>
          <button className="webhooks-panel__button is-danger" type="button" onClick={onDelete}>
            {t("deleteWebhook")}
          </button>
        </div>
      </div>
    </article>
  );
}

function OverviewTab({
  deliveries,
  selectedWebhook,
}: {
  deliveries: DeckGoWebhookDelivery[];
  selectedWebhook: DeckGoWebhook;
}) {
  const t = useTranslations("webhooks");
  const failures = deliveries.filter((delivery) => !delivery.success).length;
  return (
    <div className="webhooks-panel__tab-panel">
      <div className="webhooks-panel__metrics">
        <WebhookKpi label={t("deliveries")} value={deliveries.length} />
        <WebhookKpi
          label={t("failed")}
          value={failures}
          tone={failures > 0 ? "danger" : undefined}
        />
        <WebhookKpi
          label={t("time")}
          value={formatWebhookDate(selectedWebhook.lastFiredAt, t("notAvailable"))}
        />
        <WebhookKpi
          label={t("secret")}
          value={selectedWebhook.secret ? t("redacted") : t("notAvailable")}
        />
      </div>
      <div className="webhooks-panel__surface">
        <p className="webhooks-panel__label">{t("events")}</p>
        <div className="webhooks-panel__pill-row">
          {selectedWebhook.events.map((eventName) => (
            <span className="webhooks-panel__pill" key={eventName}>
              {eventName}
            </span>
          ))}
        </div>
      </div>
      <div className="webhooks-panel__surface">
        <JsonDetails title={t("webhookPayload")} payload={safeWebhookPayload(selectedWebhook)} />
      </div>
    </div>
  );
}

function DeliveriesTab({
  deliveries,
  expandedDeliveryId,
  onToggle,
}: {
  deliveries: DeckGoWebhookDelivery[];
  expandedDeliveryId: string;
  onToggle: (deliveryId: string) => void;
}) {
  const t = useTranslations("webhooks");
  if (deliveries.length === 0) {
    return (
      <div className="webhooks-panel__empty">
        <strong>{t("noDeliveries")}</strong>
        <p>{t("noDeliveriesHint")}</p>
      </div>
    );
  }

  return (
    <ul className="webhooks-panel__delivery-list">
      {deliveries.map((delivery) => {
        const expanded = expandedDeliveryId === delivery.id;
        return (
          <li key={delivery.id}>
            <button
              className={`webhooks-panel__delivery-row ${expanded ? "is-expanded" : ""}`}
              type="button"
              onClick={() => onToggle(delivery.id)}
            >
              <div>
                <strong>{delivery.eventType}</strong>
                <p>{delivery.createdAt}</p>
              </div>
              <span className="webhooks-panel__pill">
                {t("statusCodeShort")} {metricValue(delivery.statusCode, t("notAvailable"))}
              </span>
              <span className="webhooks-panel__pill">
                {t("duration")}{" "}
                {delivery.durationMs != null ? `${delivery.durationMs}ms` : t("notAvailable")}
              </span>
              <span
                className={`webhooks-panel__pill ${delivery.success ? "is-good" : "is-danger"}`}
              >
                {delivery.success ? t("success") : t("failed")}
              </span>
            </button>
            {expanded ? (
              <div className="webhooks-panel__delivery-expanded">
                <JsonBlock title={t("payload")} value={parseMaybeJson(delivery.payload)} />
                <JsonBlock
                  title={t("responseBody")}
                  value={parseMaybeJson(delivery.responseBody)}
                />
                <p className="webhooks-panel__note">
                  {t("attempt")} {delivery.attempt ?? 0}
                  {delivery.isRetry ? ` · ${t("retrying")}` : ""}
                  {delivery.parentDeliveryId
                    ? ` · ${t("parentDelivery")}: ${delivery.parentDeliveryId}`
                    : ""}
                </p>
                {delivery.error ? (
                  <p className="webhooks-panel__note is-danger">{delivery.error}</p>
                ) : null}
                {delivery.nextRetryAt ? (
                  <p className="webhooks-panel__note">{t("retryUnsupported")}</p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function SettingsTab({ selectedWebhook }: { selectedWebhook: DeckGoWebhook }) {
  const t = useTranslations("webhooks");
  return (
    <div className="webhooks-panel__tab-panel">
      <div className="webhooks-panel__surface">
        <p className="webhooks-panel__label">{t("configuration")}</p>
        <dl className="webhooks-panel__definition-list">
          <dt>{t("webhookId")}</dt>
          <dd>{selectedWebhook.id}</dd>
          <dt>{t("enabled")}</dt>
          <dd>{selectedWebhook.enabled ? t("yes") : t("no")}</dd>
          <dt>{t("secret")}</dt>
          <dd>{selectedWebhook.secret ? t("redacted") : t("notAvailable")}</dd>
          <dt>{t("createdAt")}</dt>
          <dd>{selectedWebhook.createdAt}</dd>
          <dt>{t("updatedAt")}</dt>
          <dd>{selectedWebhook.updatedAt}</dd>
        </dl>
      </div>
    </div>
  );
}

function CapabilityGaps() {
  const t = useTranslations("webhooks");
  return (
    <div className="webhooks-panel__tab-panel">
      <div className="webhooks-panel__surface">
        <p className="webhooks-panel__label">{t("contractGaps")}</p>
        <ul className="webhooks-panel__gap-list">
          <li>{t("gapRetry")}</li>
          <li>{t("gapLivePush")}</li>
          <li>{t("gapEventCatalog")}</li>
          <li>{t("gapStats")}</li>
        </ul>
      </div>
    </div>
  );
}

function WebhookBuilderModal({
  draft,
  editing,
  onCancel,
  onChange,
  onSave,
  saving,
}: {
  draft: WebhookDraft;
  editing: boolean;
  onCancel: () => void;
  onChange: (next: WebhookDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useTranslations("webhooks");
  const draftEvents = parseWebhookEvents(draft.events);
  const valid =
    Boolean(draft.name.trim()) && isValidHttpUrl(draft.url.trim()) && draftEvents.length > 0;

  const updateDraft = (patch: Partial<WebhookDraft>) => onChange({ ...draft, ...patch });
  const toggleEvent = (eventName: string) => {
    const nextEvents = draftEvents.includes(eventName)
      ? draftEvents.filter((event) => event !== eventName)
      : [...draftEvents, eventName];
    updateDraft({ events: formatWebhookEvents(nextEvents) });
  };

  return (
    <div className="webhooks-panel__modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form
        aria-modal="true"
        className="webhooks-panel__modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            onSave();
          }
        }}
      >
        <header className="webhooks-panel__modal-head">
          <div>
            <p className="webhooks-panel__eyebrow">{t("configuration")}</p>
            <h2>{editing ? t("editWebhook") : t("addWebhook")}</h2>
          </div>
          <button
            className="webhooks-panel__button"
            disabled={saving}
            type="button"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
        </header>
        <div className="webhooks-panel__field-grid">
          <label className="webhooks-panel__field">
            <span>{t("name")}</span>
            <input
              aria-label="webhook name"
              className="webhooks-panel__input"
              disabled={saving}
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder={t("namePlaceholder")}
              required
            />
          </label>
          <label className="webhooks-panel__field">
            <span>{t("url")}</span>
            <input
              aria-label="webhook url"
              className="webhooks-panel__input"
              disabled={saving}
              type="url"
              value={draft.url}
              onChange={(event) => updateDraft({ url: event.target.value })}
              placeholder="https://example.com/webhook"
              required
            />
            {draft.url && !isValidHttpUrl(draft.url) ? (
              <small className="webhooks-panel__field-error">{t("urlInvalid")}</small>
            ) : null}
          </label>
          <label className="webhooks-panel__field">
            <span>{t("secret")}</span>
            <input
              aria-label="webhook secret"
              className="webhooks-panel__input"
              disabled={saving}
              type="password"
              value={draft.secret}
              onChange={(event) => updateDraft({ secret: event.target.value })}
              placeholder={editing ? t("secretKeepBlank") : t("optionalSecret")}
            />
          </label>
          <label className="webhooks-panel__field">
            <span>{t("events")}</span>
            <input
              aria-label="webhook events"
              className="webhooks-panel__input"
              disabled={saving}
              value={draft.events}
              onChange={(event) => updateDraft({ events: event.target.value })}
              placeholder={t("eventsPlaceholder")}
            />
            {draftEvents.length === 0 ? (
              <small className="webhooks-panel__field-error">{t("eventsRequired")}</small>
            ) : null}
          </label>
        </div>
        <div className="webhooks-panel__event-grid">
          {AVAILABLE_WEBHOOK_EVENTS.map((eventName) => (
            <button
              aria-label={`toggle webhook event ${eventName}`}
              className={`webhooks-panel__button ${draftEvents.includes(eventName) ? "is-primary" : ""}`}
              disabled={saving}
              key={eventName}
              type="button"
              onClick={() => toggleEvent(eventName)}
            >
              {eventName}
            </button>
          ))}
        </div>
        <label className="webhooks-panel__checkbox">
          <input
            checked={draft.enabled}
            disabled={saving}
            type="checkbox"
            onChange={(event) => updateDraft({ enabled: event.target.checked })}
          />
          <span>{t("enabledToggle")}</span>
        </label>
        <footer className="webhooks-panel__modal-actions">
          <button
            className="webhooks-panel__button"
            disabled={saving}
            type="button"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
          <button
            className="webhooks-panel__button is-primary"
            disabled={saving || !valid}
            type="submit"
          >
            {saving ? t("saving") : editing ? t("saveSelected") : t("createWebhook")}
          </button>
        </footer>
      </form>
    </div>
  );
}

function DeleteConfirm({
  deleting,
  onCancel,
  onDelete,
  webhook,
}: {
  deleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  webhook: DeckGoWebhook;
}) {
  const t = useTranslations("webhooks");
  return (
    <div className="webhooks-panel__modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        aria-modal="true"
        className="webhooks-panel__modal is-confirm"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="webhooks-panel__modal-head">
          <div>
            <p className="webhooks-panel__eyebrow">{t("deleteWebhook")}</p>
            <h2>{t("confirmDelete")}</h2>
          </div>
        </header>
        <p className="webhooks-panel__note">{t("confirmDeleteBody", { name: webhook.name })}</p>
        <footer className="webhooks-panel__modal-actions">
          <button
            className="webhooks-panel__button"
            disabled={deleting}
            type="button"
            onClick={onCancel}
          >
            {t("cancel")}
          </button>
          <button
            className="webhooks-panel__button is-danger"
            disabled={deleting}
            type="button"
            onClick={onDelete}
          >
            {deleting ? t("deleting") : t("deleteWebhook")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="webhooks-panel__json-block">
      <p className="webhooks-panel__label">{title}</p>
      <pre>{JSON.stringify(value ?? null, null, 2)}</pre>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { DeckGoWebhook, DeckGoWebhookDelivery } from "../../../api";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  fetchWebhooks,
  testWebhook,
  updateWebhook,
} from "../../../api";
import { useTranslations } from "../../../i18n/provider";
import { JsonDetails } from "../../shared/ShellComponents";
import { DeliveryHistory } from "./DeliveryHistory";
import {
  DEFAULT_WEBHOOK_DRAFT,
  draftFromWebhook,
  webhookInputFromDraft,
  type PanelState,
} from "./webhook-model";
import { WebhookForm } from "./WebhookForm";
import { WebhookList } from "./WebhookList";
import { WebhookMetric } from "./WebhookMetric";
import "./webhooks-panel.css";

type ActionState = "idle" | "creating" | "updating" | "testing" | "deleting";

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

export function WebhooksPanel() {
  const t = useTranslations("webhooks");
  const [webhooks, setWebhooks] = useState<DeckGoWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeckGoWebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_WEBHOOK_DRAFT);
  const [editingWebhookId, setEditingWebhookId] = useState("");
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

  const loadDeliveries = async (webhookId: string) => {
    if (!webhookId) {
      setDeliveries([]);
      return;
    }
    const nextDeliveries = await fetchWebhookDeliveries(webhookId);
    setDeliveries(nextDeliveries.deliveries ?? []);
  };

  const refresh = async (preferredWebhookId?: string) => {
    setLoadState("loading");
    try {
      const next = await fetchWebhooks();
      const nextWebhooks = next.webhooks ?? [];
      setWebhooks(nextWebhooks);
      setLoadState("ready");
      setError("");
      const fallbackId = preferredWebhookId?.trim() || nextWebhooks[0]?.id || "";
      const nextSelected =
        fallbackId && nextWebhooks.some((webhook) => webhook.id === fallbackId)
          ? fallbackId
          : selectedWebhookId && nextWebhooks.some((webhook) => webhook.id === selectedWebhookId)
            ? selectedWebhookId
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
    void loadDeliveries(selectedWebhookId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : t("deliveriesLoadFailed"));
    });
  }, [selectedWebhookId]);

  const selectedWebhook =
    webhooks.find((webhook) => webhook.id === selectedWebhookId) ?? webhooks[0] ?? null;
  const editingWebhook = editingWebhookId
    ? (webhooks.find((webhook) => webhook.id === editingWebhookId) ?? null)
    : null;

  const selectWebhook = (webhookId: string) => {
    setSelectedWebhookId(webhookId);
    setEditingWebhookId("");
    setDraft(DEFAULT_WEBHOOK_DRAFT);
  };

  const startCreate = () => {
    setEditingWebhookId("");
    setDraft(DEFAULT_WEBHOOK_DRAFT);
  };

  const startEdit = () => {
    if (!selectedWebhook) {
      return;
    }
    setEditingWebhookId(selectedWebhook.id);
    setDraft(draftFromWebhook(selectedWebhook));
  };

  const saveAction = async () => {
    const savingExisting = editingWebhook != null;
    setActionState(savingExisting ? "updating" : "creating");
    try {
      const input = webhookInputFromDraft(draft);
      const result = editingWebhook
        ? await updateWebhook(editingWebhook.id, input)
        : await createWebhook(input);
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_WEBHOOK_DRAFT);
      setEditingWebhookId("");
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
      const result = await testWebhook(selectedWebhook.id);
      setActionResult(result);
      setError("");
      await refresh(selectedWebhook.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("testFailed"));
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedWebhook) {
      return;
    }
    if (!window.confirm(t("confirmDeleteWebhook", { id: selectedWebhook.id }))) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteWebhook(selectedWebhook.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="webhooks-panel" data-testid="webhooks-panel">
      <header className="webhooks-panel__header">
        <div className="webhooks-panel__title-stack">
          <p className="webhooks-panel__eyebrow">Automate</p>
          <h1 className="webhooks-panel__title">{t("title")}</h1>
          <p className="webhooks-panel__description">{t("panelDescription")}</p>
        </div>
        <div className="webhooks-panel__pill-row">
          <span className={`webhooks-panel__pill ${loadState === "ready" ? "is-good" : ""}`}>
            {t("statusPrefix")} {t(loadState)}
          </span>
          <span className="webhooks-panel__pill">
            {t("configuredCount", { count: webhooks.length })}
          </span>
        </div>
      </header>

      <div className="webhooks-panel__workspace">
        <div className="webhooks-panel__column">
          <WebhookList
            webhooks={webhooks}
            deliveriesCount={deliveries.length}
            error={error}
            loadState={loadState}
            selectedWebhookId={selectedWebhookId}
            onCreate={startCreate}
            onRefresh={() => void refresh(selectedWebhookId)}
            onSelect={selectWebhook}
          />
          <WebhookForm
            draft={draft}
            editing={Boolean(editingWebhook)}
            saving={actionState === "creating" || actionState === "updating"}
            onCancel={() => {
              setEditingWebhookId("");
              setDraft(DEFAULT_WEBHOOK_DRAFT);
            }}
            onChange={setDraft}
            onSave={() => void saveAction()}
          />
        </div>

        <div className="webhooks-panel__column">
          <article className="webhooks-panel__card">
            <div className="webhooks-panel__card-head">
              <div>
                <p className="webhooks-panel__eyebrow">{t("webhook")}</p>
                <h2 className="webhooks-panel__title">{t("selectedWebhook")}</h2>
              </div>
              {selectedWebhook ? (
                <div className="webhooks-panel__actions">
                  <button
                    className="webhooks-panel__button"
                    type="button"
                    onClick={startEdit}
                    disabled={actionState !== "idle"}
                  >
                    {t("editWebhook")}
                  </button>
                  <button
                    className="webhooks-panel__button is-danger"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? t("deleting") : t("deleteWebhook")}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="webhooks-panel__body webhooks-panel__detail-stack">
              <p className="webhooks-panel__description">{t("detailDescription")}</p>
              {selectedWebhook ? (
                <>
                  <div className="webhooks-panel__hero">
                    <div>
                      <p className="webhooks-panel__eyebrow">{t("webhook")}</p>
                      <strong>{selectedWebhook.name}</strong>
                      <p className="webhooks-panel__note">{selectedWebhook.url}</p>
                    </div>
                    <div className="webhooks-panel__pill-row">
                      <span
                        className={`webhooks-panel__pill ${
                          selectedWebhook.enabled ? "is-good" : ""
                        }`}
                      >
                        {selectedWebhook.enabled ? t("enabled") : t("disabled")}
                      </span>
                      <span className="webhooks-panel__pill">
                        {t("eventCount", { count: selectedWebhook.events.length })}
                      </span>
                    </div>
                  </div>
                  <div className="webhooks-panel__metrics">
                    <WebhookMetric
                      label={t("lastStatus")}
                      value={selectedWebhook.lastStatus ?? t("notAvailable")}
                    />
                    <WebhookMetric
                      label={t("failures")}
                      value={selectedWebhook.consecutiveFailures}
                    />
                    <WebhookMetric
                      label={t("time")}
                      value={formatWebhookDate(selectedWebhook.lastFiredAt, t("notAvailable"))}
                    />
                    <WebhookMetric
                      label={t("secret")}
                      value={selectedWebhook.secret ? t("enabled") : t("notAvailable")}
                    />
                  </div>
                  <div className="webhooks-panel__pill-row">
                    {selectedWebhook.events.map((eventName) => (
                      <span className="webhooks-panel__pill" key={eventName}>
                        {eventName}
                      </span>
                    ))}
                  </div>
                  <div className="webhooks-panel__surface">
                    <JsonDetails title={t("webhookPayload")} payload={selectedWebhook} />
                  </div>
                  <DeliveryHistory
                    deliveries={deliveries}
                    selectedWebhook={selectedWebhook}
                    testing={actionState === "testing"}
                    onTest={() => void testAction()}
                  />
                  <div className="webhooks-panel__surface">
                    <JsonDetails title={t("deliveryHistoryPayload")} payload={deliveries} />
                  </div>
                </>
              ) : (
                <p className="webhooks-panel__note">{t("selectWebhookHint")}</p>
              )}
              {actionResult ? (
                <div className="webhooks-panel__surface">
                  <JsonDetails title={t("lastWebhookAction")} payload={actionResult} />
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

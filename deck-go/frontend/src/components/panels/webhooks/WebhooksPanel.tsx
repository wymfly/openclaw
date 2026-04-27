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
  type WebhookDraft,
} from "./webhook-model";
import { WebhookForm } from "./WebhookForm";
import { WebhookList } from "./WebhookList";

type ViewMode = "list" | "form" | "deliveries";
type ActionState = "idle" | "creating" | "updating" | "testing" | "deleting";

export function WebhooksPanel() {
  const t = useTranslations("webhooks");
  const [webhooks, setWebhooks] = useState<DeckGoWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeckGoWebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_WEBHOOK_DRAFT);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
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
        setViewMode((current) => (current === "form" ? current : "deliveries"));
      } else {
        setDeliveries([]);
        setViewMode((current) => (current === "form" ? current : "list"));
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
    setViewMode("deliveries");
  };

  const startCreate = () => {
    setEditingWebhookId("");
    setDraft(DEFAULT_WEBHOOK_DRAFT);
    setViewMode("form");
  };

  const startEdit = () => {
    if (!selectedWebhook) {
      return;
    }
    setEditingWebhookId(selectedWebhook.id);
    setDraft(draftFromWebhook(selectedWebhook));
    setViewMode("form");
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
      setViewMode("deliveries");
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
      setViewMode("deliveries");
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
      setViewMode("list");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("deleteFailed"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-webhooks">
      <div className="deckgo-column deck-ui-webhooks-column">
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
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-webhooks-column deck-ui-webhooks-detail-column">
        <article className="deckgo-card is-float deck-ui-webhooks-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">
              {viewMode === "form" ? t("configuration") : t("selectedWebhook")}
            </h2>
          </div>
          <p className="deckgo-card-subtitle">{t("detailDescription")}</p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-webhooks-body">
            {viewMode === "form" ? (
              <WebhookForm
                draft={draft}
                editing={Boolean(editingWebhook)}
                saving={actionState === "creating" || actionState === "updating"}
                onCancel={() => {
                  setEditingWebhookId("");
                  setViewMode(selectedWebhook ? "deliveries" : "list");
                }}
                onChange={setDraft}
                onSave={() => void saveAction()}
              />
            ) : selectedWebhook ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
                  <div>
                    <p className="deckgo-kicker">{t("webhook")}</p>
                    <strong>{selectedWebhook.name}</strong>
                    <p className="deckgo-note">{selectedWebhook.url}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {selectedWebhook.enabled ? t("enabled") : t("disabled")}
                    </span>
                    <span className="deckgo-pill">
                      {t("eventCount", { count: selectedWebhook.events.length })}
                    </span>
                  </div>
                </div>
                <div className="deckgo-pill-row deck-ui-webhooks-event-row">
                  {selectedWebhook.events.map((eventName) => (
                    <span className="deckgo-pill" key={eventName}>
                      {eventName}
                    </span>
                  ))}
                </div>
                <div className="deckgo-actions deck-ui-webhooks-actions">
                  <button
                    className="deckgo-button deck-ui-webhooks-button"
                    type="button"
                    onClick={startEdit}
                    disabled={actionState !== "idle"}
                  >
                    {t("editWebhook")}
                  </button>
                  <button
                    className="deckgo-button deck-ui-webhooks-button is-danger"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? t("deleting") : t("deleteWebhook")}
                  </button>
                </div>
                <div className="deck-ui-webhooks-details">
                  <JsonDetails title={t("webhookPayload")} payload={selectedWebhook} />
                </div>
                <DeliveryHistory
                  deliveries={deliveries}
                  selectedWebhook={selectedWebhook}
                  testing={actionState === "testing"}
                  onTest={() => void testAction()}
                />
                <div className="deck-ui-webhooks-details">
                  <JsonDetails title={t("deliveryHistoryPayload")} payload={deliveries} />
                </div>
              </>
            ) : (
              <p className="deckgo-note">{t("selectWebhookHint")}</p>
            )}
            {actionResult ? (
              <div className="deck-ui-webhooks-details">
                <JsonDetails title={t("lastWebhookAction")} payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

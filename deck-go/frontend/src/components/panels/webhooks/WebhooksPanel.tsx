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
import { JsonDetails, ShellStat } from "../../shared/ShellComponents";

type PanelState = "idle" | "loading" | "ready";

type WebhookDraft = {
  name: string;
  url: string;
  secret: string;
  events: string;
  enabled: boolean;
};

const DEFAULT_DRAFT: WebhookDraft = {
  name: "",
  url: "",
  secret: "",
  events: "alert.fired",
  enabled: true,
};

const AVAILABLE_WEBHOOK_EVENTS = [
  "*",
  "chat",
  "agent",
  "agent.updated",
  "cron.run.complete",
  "approval.pending",
  "approval.resolved",
  "budget.warn",
  "budget.over",
  "alert.fired",
];

function parseWebhookEvents(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatWebhookEvents(events: string[]) {
  return events.join(", ");
}

function webhookInputFromDraft(draft: WebhookDraft) {
  return {
    name: draft.name,
    url: draft.url,
    secret: draft.secret || undefined,
    events: parseWebhookEvents(draft.events),
    enabled: draft.enabled,
  };
}

function draftFromWebhook(webhook: DeckGoWebhook): WebhookDraft {
  return {
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret ?? "",
    events: formatWebhookEvents(webhook.events),
    enabled: webhook.enabled,
  };
}

function deliveryStatusClass(delivery: DeckGoWebhookDelivery) {
  return delivery.success ? "is-positive" : "is-danger";
}

function deliveryDetail(delivery: DeckGoWebhookDelivery) {
  return delivery.error || delivery.responseBody || "";
}

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<DeckGoWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeckGoWebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<
    "idle" | "creating" | "updating" | "testing" | "deleting"
  >("idle");
  const [actionResult, setActionResult] = useState<unknown>(null);
  const [error, setError] = useState("");

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
        const nextDeliveries = await fetchWebhookDeliveries(nextSelected);
        setDeliveries(nextDeliveries.deliveries ?? []);
      } else {
        setDeliveries([]);
      }
    } catch (loadError) {
      setLoadState("idle");
      setError(loadError instanceof Error ? loadError.message : "failed to load webhooks");
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
    void fetchWebhookDeliveries(selectedWebhookId)
      .then((next) => setDeliveries(next.deliveries ?? []))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "failed to load deliveries");
      });
  }, [selectedWebhookId]);

  const selectedWebhook =
    webhooks.find((webhook) => webhook.id === selectedWebhookId) ?? webhooks[0] ?? null;
  const draftEvents = parseWebhookEvents(draft.events);

  const toggleDraftEvent = (eventName: string) => {
    setDraft((current) => {
      const events = parseWebhookEvents(current.events);
      const nextEvents = events.includes(eventName)
        ? events.filter((event) => event !== eventName)
        : [...events, eventName];
      return { ...current, events: formatWebhookEvents(nextEvents) };
    });
  };

  const createAction = async () => {
    setActionState("creating");
    try {
      const result = await createWebhook(webhookInputFromDraft(draft));
      setActionResult(result);
      setError("");
      setDraft(DEFAULT_DRAFT);
      await refresh(result.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "webhook create failed");
    } finally {
      setActionState("idle");
    }
  };

  const updateSelectedAction = async () => {
    if (!selectedWebhook) {
      return;
    }
    setActionState("updating");
    try {
      const result = await updateWebhook(selectedWebhook.id, webhookInputFromDraft(draft));
      setActionResult(result);
      setError("");
      await refresh(selectedWebhook.id);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "webhook update failed");
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
      setError(actionError instanceof Error ? actionError.message : "webhook test failed");
    } finally {
      setActionState("idle");
    }
  };

  const deleteAction = async () => {
    if (!selectedWebhook) {
      return;
    }
    if (!window.confirm(`Delete webhook ${selectedWebhook.id}?`)) {
      return;
    }
    setActionState("deleting");
    try {
      const result = await deleteWebhook(selectedWebhook.id);
      setActionResult(result);
      setError("");
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "webhook delete failed");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <section className="deckgo-panel-workspace deck-ui-webhooks">
      <div className="deckgo-column deck-ui-webhooks-column">
        <article className="deckgo-card is-float deck-ui-webhooks-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Webhooks</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Webhook inventory, delivery testing, deletion, and delivery history use the current
            webhook routes.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-webhooks-body">
            <div className="deckgo-pill-row deck-ui-webhooks-status-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Webhooks {loadState}
              </span>
              <span className="deckgo-pill">{webhooks.length} configured</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2 deck-ui-webhooks-stats">
              <ShellStat label="webhooks" value={webhooks.length} />
              <ShellStat label="deliveries" value={deliveries.length} />
            </div>
            <div className="deckgo-surface-tile deck-ui-webhooks-surface">
              <p className="deckgo-surface-label">Create/edit webhook</p>
              <div className="deckgo-grid deckgo-grid-2 deck-ui-webhooks-form-grid">
                <input
                  aria-label="webhook name"
                  className="deckgo-input deck-ui-webhooks-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <input
                  aria-label="webhook url"
                  className="deckgo-input deck-ui-webhooks-input"
                  value={draft.url}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="url"
                />
                <input
                  aria-label="webhook secret"
                  className="deckgo-input deck-ui-webhooks-input"
                  value={draft.secret}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, secret: event.target.value }))
                  }
                  placeholder="secret"
                />
                <input
                  aria-label="webhook events"
                  className="deckgo-input deck-ui-webhooks-input"
                  value={draft.events}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, events: event.target.value }))
                  }
                  placeholder="events comma-separated"
                />
              </div>
              <div className="deckgo-pill-row deck-ui-webhooks-event-row">
                {AVAILABLE_WEBHOOK_EVENTS.map((eventName) => (
                  <button
                    aria-label={`toggle webhook event ${eventName}`}
                    className={`deckgo-button deck-ui-webhooks-button ${draftEvents.includes(eventName) ? "is-primary" : ""}`}
                    key={eventName}
                    type="button"
                    onClick={() => toggleDraftEvent(eventName)}
                  >
                    {eventName}
                  </button>
                ))}
              </div>
              <label className="deckgo-label">
                <span>Webhook enabled</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
              </label>
              <div className="deckgo-actions deck-ui-webhooks-actions deck-ui-webhooks-actions-offset">
                <button
                  className="deckgo-button deck-ui-webhooks-button"
                  type="button"
                  onClick={() => void refresh(selectedWebhookId)}
                >
                  Refresh webhooks
                </button>
                <button
                  className="deckgo-button deck-ui-webhooks-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create webhook"}
                </button>
                <button
                  className="deckgo-button deck-ui-webhooks-button"
                  type="button"
                  onClick={() => selectedWebhook && setDraft(draftFromWebhook(selectedWebhook))}
                  disabled={!selectedWebhook || actionState !== "idle"}
                >
                  Load selected
                </button>
                <button
                  className="deckgo-button deck-ui-webhooks-button"
                  type="button"
                  onClick={() => void updateSelectedAction()}
                  disabled={!selectedWebhook || actionState !== "idle"}
                >
                  {actionState === "updating" ? "Saving" : "Save selected"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note deck-ui-webhooks-error">{error}</p> : null}
            {webhooks.length === 0 ? (
              <p className="deckgo-note deck-ui-webhooks-empty">No webhooks loaded.</p>
            ) : (
              <ul className="deckgo-shell-list deck-ui-webhooks-list">
                {webhooks.map((webhook) => (
                  <li key={webhook.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card deck-ui-webhooks-row ${selectedWebhook?.id === webhook.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedWebhookId(webhook.id)}
                    >
                      <strong>{webhook.name}</strong>
                      <div className="deckgo-meta">
                        {webhook.url} | enabled: {webhook.enabled ? "yes" : "no"}
                      </div>
                      <div className="deckgo-meta">
                        failures: {webhook.consecutiveFailures} | last status:{" "}
                        {webhook.lastStatus ?? "n/a"}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </div>

      <div className="deckgo-column deckgo-panel-main deck-ui-webhooks-column deck-ui-webhooks-detail-column">
        <article className="deckgo-card is-float deck-ui-webhooks-card">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected webhook</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Inspect one webhook, trigger a test delivery, or delete it from the selected webhook
            view.
          </p>
          <div className="deckgo-card-body deckgo-dividerless deck-ui-webhooks-body">
            {selectedWebhook ? (
              <>
                <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
                  <div>
                    <p className="deckgo-kicker">Webhook</p>
                    <strong>{selectedWebhook.name}</strong>
                    <p className="deckgo-note">{selectedWebhook.url}</p>
                  </div>
                  <div className="deckgo-pill-row">
                    <span className="deckgo-pill">
                      {selectedWebhook.enabled ? "enabled" : "disabled"}
                    </span>
                    <span className="deckgo-pill">{selectedWebhook.events.length} events</span>
                  </div>
                </div>
                <div className="deckgo-actions deck-ui-webhooks-actions">
                  <button
                    className="deckgo-button deck-ui-webhooks-button is-primary"
                    type="button"
                    onClick={() => void testAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "testing" ? "Testing" : "Test delivery"}
                  </button>
                  <button
                    className="deckgo-button deck-ui-webhooks-button is-danger"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? "Deleting" : "Delete"}
                  </button>
                </div>
                <div className="deck-ui-webhooks-details">
                  <JsonDetails title="Webhook payload" payload={selectedWebhook} />
                </div>
                <div className="deckgo-surface-tile deck-ui-webhooks-surface">
                  <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
                    <div>
                      <p className="deckgo-kicker">Delivery records</p>
                      <strong>{deliveries.length} deliveries</strong>
                      <p className="deckgo-note">
                        Status, retry, attempt, and response details from the current facade.
                      </p>
                    </div>
                    <span className="deckgo-pill">
                      failures {selectedWebhook.consecutiveFailures}
                    </span>
                  </div>
                  {deliveries.length === 0 ? (
                    <p className="deckgo-note">No deliveries recorded for this webhook.</p>
                  ) : (
                    <ul className="deckgo-shell-list deck-ui-webhooks-delivery-list">
                      {deliveries.map((delivery) => {
                        const detail = deliveryDetail(delivery);
                        return (
                          <li key={delivery.id}>
                            <div className="deckgo-selectable-card deck-ui-webhooks-delivery-row">
                              <div className="deckgo-panel-hero-strip deck-ui-webhooks-hero">
                                <div>
                                  <strong>{delivery.eventType}</strong>
                                  <p className="deckgo-note">{delivery.createdAt}</p>
                                </div>
                                <span className={`deckgo-pill ${deliveryStatusClass(delivery)}`}>
                                  {delivery.success ? "success" : "failed"}
                                </span>
                              </div>
                              <div className="deckgo-pill-row deck-ui-webhooks-delivery-meta">
                                <span className="deckgo-pill">
                                  status {delivery.statusCode ?? "n/a"}
                                </span>
                                <span className="deckgo-pill">
                                  duration{" "}
                                  {delivery.durationMs != null ? `${delivery.durationMs}ms` : "n/a"}
                                </span>
                                <span className="deckgo-pill">attempt {delivery.attempt ?? 0}</span>
                                {delivery.isRetry ? (
                                  <span className="deckgo-pill is-warning">retry</span>
                                ) : null}
                              </div>
                              {detail ? (
                                <p className="deckgo-note deck-ui-webhooks-delivery-detail">
                                  details: {detail}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="deck-ui-webhooks-details">
                  <JsonDetails title="Delivery history" payload={deliveries} />
                </div>
              </>
            ) : (
              <p className="deckgo-note">Choose a webhook to inspect it.</p>
            )}
            {actionResult ? (
              <div className="deck-ui-webhooks-details">
                <JsonDetails title="Last webhook action" payload={actionResult} />
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

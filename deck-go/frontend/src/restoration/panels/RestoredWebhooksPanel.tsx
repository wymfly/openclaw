import { useEffect, useState } from "react";
import type { DeckGoWebhook, DeckGoWebhookDelivery } from "../../api";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  fetchWebhooks,
  testWebhook,
} from "../../api";
import { JsonDetails, ShellStat } from "../../shell-components";

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

export function RestoredWebhooksPanel() {
  const [webhooks, setWebhooks] = useState<DeckGoWebhook[]>([]);
  const [deliveries, setDeliveries] = useState<DeckGoWebhookDelivery[]>([]);
  const [selectedWebhookId, setSelectedWebhookId] = useState("");
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [loadState, setLoadState] = useState<PanelState>("idle");
  const [actionState, setActionState] = useState<"idle" | "creating" | "testing" | "deleting">(
    "idle",
  );
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
      const nextSelected = nextWebhooks.some((webhook) => webhook.id === selectedWebhookId)
        ? selectedWebhookId
        : nextWebhooks.some((webhook) => webhook.id === fallbackId)
          ? fallbackId
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

  const createAction = async () => {
    setActionState("creating");
    try {
      const result = await createWebhook({
        name: draft.name,
        url: draft.url,
        secret: draft.secret || undefined,
        events: draft.events
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        enabled: draft.enabled,
      });
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
    <section className="deckgo-restored-workspace">
      <div className="deckgo-column">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Webhooks</h2>
          </div>
          <p className="deckgo-card-subtitle">
            Vite-owned webhook slice with inventory, create, test, delete, and delivery history.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            <div className="deckgo-pill-row">
              <span className={`deckgo-pill ${loadState === "ready" ? "is-positive" : "is-muted"}`}>
                Webhooks {loadState}
              </span>
              <span className="deckgo-pill">{webhooks.length} configured</span>
            </div>
            <div className="deckgo-grid deckgo-grid-2">
              <ShellStat label="webhooks" value={webhooks.length} />
              <ShellStat label="deliveries" value={deliveries.length} />
            </div>
            <div className="deckgo-surface-tile">
              <p className="deckgo-surface-label">Create webhook</p>
              <div className="deckgo-grid deckgo-grid-2">
                <input
                  className="deckgo-input"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="name"
                />
                <input
                  className="deckgo-input"
                  value={draft.url}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, url: event.target.value }))
                  }
                  placeholder="url"
                />
                <input
                  className="deckgo-input"
                  value={draft.secret}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, secret: event.target.value }))
                  }
                  placeholder="secret"
                />
                <input
                  className="deckgo-input"
                  value={draft.events}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, events: event.target.value }))
                  }
                  placeholder="events comma-separated"
                />
              </div>
              <div className="deckgo-actions" style={{ marginTop: 12 }}>
                <button
                  className="deckgo-button"
                  type="button"
                  onClick={() => void refresh(selectedWebhookId)}
                >
                  Refresh webhooks
                </button>
                <button
                  className="deckgo-button is-primary"
                  type="button"
                  onClick={() => void createAction()}
                  disabled={actionState !== "idle"}
                >
                  {actionState === "creating" ? "Creating" : "Create webhook"}
                </button>
              </div>
            </div>
            {error ? <p className="deckgo-note">{error}</p> : null}
            {webhooks.length === 0 ? (
              <p className="deckgo-note">No webhooks loaded.</p>
            ) : (
              <ul className="deckgo-shell-list">
                {webhooks.map((webhook) => (
                  <li key={webhook.id}>
                    <button
                      type="button"
                      className={`deckgo-selectable-card ${selectedWebhook?.id === webhook.id ? "is-selected" : ""}`}
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

      <div className="deckgo-column deckgo-restored-chat-main">
        <article className="deckgo-card is-float">
          <div className="deckgo-card-header">
            <h2 className="deckgo-card-title">Selected webhook</h2>
          </div>
          <p className="deckgo-card-subtitle">
            This slice stays operator-focused: inspect one webhook, trigger a test delivery, or
            delete it.
          </p>
          <div className="deckgo-card-body deckgo-dividerless">
            {selectedWebhook ? (
              <>
                <div className="deckgo-restored-hero-strip">
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
                <div className="deckgo-actions">
                  <button
                    className="deckgo-button is-primary"
                    type="button"
                    onClick={() => void testAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "testing" ? "Testing" : "Test delivery"}
                  </button>
                  <button
                    className="deckgo-button is-danger"
                    type="button"
                    onClick={() => void deleteAction()}
                    disabled={actionState !== "idle"}
                  >
                    {actionState === "deleting" ? "Deleting" : "Delete"}
                  </button>
                </div>
                <JsonDetails title="Webhook payload" payload={selectedWebhook} />
                <JsonDetails title="Delivery history" payload={deliveries} />
              </>
            ) : (
              <p className="deckgo-note">Choose a webhook to inspect it.</p>
            )}
            {actionResult ? (
              <JsonDetails title="Last webhook action" payload={actionResult} />
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}

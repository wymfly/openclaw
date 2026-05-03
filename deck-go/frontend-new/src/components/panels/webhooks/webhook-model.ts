import type { DeckGoWebhook, DeckGoWebhookDelivery } from "../../../api";

export type PanelState = "idle" | "loading" | "ready";

export type WebhookDraft = {
  name: string;
  url: string;
  secret: string;
  events: string;
  enabled: boolean;
};

export const DEFAULT_WEBHOOK_DRAFT: WebhookDraft = {
  name: "",
  url: "",
  secret: "",
  events: "alert.fired",
  enabled: true,
};

export const AVAILABLE_WEBHOOK_EVENTS = [
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

export function parseWebhookEvents(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatWebhookEvents(events: string[]) {
  return events.join(", ");
}

export function webhookInputFromDraft(draft: WebhookDraft) {
  return {
    name: draft.name,
    url: draft.url,
    secret: draft.secret || undefined,
    events: parseWebhookEvents(draft.events),
    enabled: draft.enabled,
  };
}

export function draftFromWebhook(webhook: DeckGoWebhook): WebhookDraft {
  return {
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret ?? "",
    events: formatWebhookEvents(webhook.events),
    enabled: webhook.enabled,
  };
}

export function deliveryStatusClass(delivery: DeckGoWebhookDelivery) {
  return delivery.success ? "is-good" : "is-danger";
}

export function deliveryDetail(delivery: DeckGoWebhookDelivery) {
  return delivery.error || delivery.responseBody || "";
}

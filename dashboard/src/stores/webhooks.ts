import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  consecutiveFailures: number;
  lastFiredAt: string | null;
  lastStatus: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  statusCode: number | null;
  error: string | null;
  durationMs: number | null;
  success: boolean;
  isRetry: boolean;
  createdAt: string;
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled?: boolean;
}

export type UpdateWebhookInput = Partial<CreateWebhookInput>;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WebhookState {
  webhooks: Webhook[];
  selectedWebhookId: string | null;
  deliveries: WebhookDelivery[];
  loading: boolean;
  error: string | null;

  selectWebhook: (id: string | null) => void;
  fetchWebhooks: () => Promise<void>;
  createWebhook: (input: CreateWebhookInput) => Promise<void>;
  updateWebhook: (id: string, input: UpdateWebhookInput) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  fetchDeliveries: (webhookId: string) => Promise<void>;
  testWebhook: (webhookId: string) => Promise<void>;
}

export const useWebhookStore = create<WebhookState>((set, get) => ({
  webhooks: [],
  selectedWebhookId: null,
  deliveries: [],
  loading: false,
  error: null,

  selectWebhook: (id) => set({ selectedWebhookId: id, deliveries: [] }),

  fetchWebhooks: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/webhooks");
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch webhooks", loading: false });
        return;
      }
      const data = (await res.json()) as { webhooks: Webhook[] };
      set({ webhooks: data.webhooks, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch webhooks",
        loading: false,
      });
    }
  },

  createWebhook: async (input) => {
    set({ error: null });
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to create webhook" });
        return;
      }
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create webhook" });
    }
  },

  updateWebhook: async (id, input) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to update webhook" });
        return;
      }
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update webhook" });
    }
  },

  deleteWebhook: async (id) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to delete webhook" });
        return;
      }
      const { selectedWebhookId } = get();
      set({ selectedWebhookId: selectedWebhookId === id ? null : selectedWebhookId });
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete webhook" });
    }
  },

  fetchDeliveries: async (webhookId) => {
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      if (!res.ok) {
        set({ deliveries: [] });
        return;
      }
      const data = (await res.json()) as { deliveries: WebhookDelivery[] };
      set({ deliveries: data.deliveries });
    } catch {
      set({ deliveries: [] });
    }
  },

  testWebhook: async (webhookId) => {
    set({ error: null });
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/test`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Test delivery failed" });
        return;
      }
      // Refresh deliveries to show the test result
      await get().fetchDeliveries(webhookId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Test delivery failed" });
    }
  },
}));

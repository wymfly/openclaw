import { create } from "zustand";
import { DeckApiError, fetchApi } from "@/lib/errors";

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
      const data = await fetchApi<{ webhooks: Webhook[] }>("/api/webhooks");
      set({ webhooks: data.webhooks, loading: false });
    } catch (err) {
      set({
        error: err instanceof DeckApiError ? err.body.error : "Failed to fetch webhooks",
        loading: false,
      });
    }
  },

  createWebhook: async (input) => {
    set({ error: null });
    try {
      await fetchApi<Webhook>("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof DeckApiError ? err.body.error : "Failed to create webhook" });
    }
  },

  updateWebhook: async (id, input) => {
    set({ error: null });
    try {
      await fetchApi<Webhook>(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof DeckApiError ? err.body.error : "Failed to update webhook" });
    }
  },

  deleteWebhook: async (id) => {
    set({ error: null });
    try {
      await fetchApi<{ deleted: boolean }>(`/api/webhooks/${id}`, { method: "DELETE" });
      const { selectedWebhookId } = get();
      set({ selectedWebhookId: selectedWebhookId === id ? null : selectedWebhookId });
      await get().fetchWebhooks();
    } catch (err) {
      set({ error: err instanceof DeckApiError ? err.body.error : "Failed to delete webhook" });
    }
  },

  fetchDeliveries: async (webhookId) => {
    try {
      const data = await fetchApi<{ deliveries: WebhookDelivery[] }>(
        `/api/webhooks/${webhookId}/deliveries`,
      );
      set({ deliveries: data.deliveries });
    } catch {
      set({ deliveries: [] });
    }
  },

  testWebhook: async (webhookId) => {
    set({ error: null });
    try {
      await fetchApi<{
        success: boolean;
        statusCode: number | null;
        durationMs: number | null;
        error: string | null;
        deliveryId: string;
      }>(`/api/webhooks/${webhookId}/test`, { method: "POST" });
      // Refresh deliveries to show the test result
      await get().fetchDeliveries(webhookId);
    } catch (err) {
      set({ error: err instanceof DeckApiError ? err.body.error : "Test delivery failed" });
    }
  },
}));

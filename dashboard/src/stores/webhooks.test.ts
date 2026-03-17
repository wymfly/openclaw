import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebhookStore } from "./webhooks.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("webhooks store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useWebhookStore.setState({
      webhooks: [],
      selectedWebhookId: null,
      deliveries: [],
      loading: false,
      error: null,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("selectWebhook", () => {
    it("should set selectedWebhookId and clear deliveries", () => {
      useWebhookStore.setState({ deliveries: [{ id: "d1" } as never] });
      useWebhookStore.getState().selectWebhook("wh-1");
      expect(useWebhookStore.getState().selectedWebhookId).toBe("wh-1");
      expect(useWebhookStore.getState().deliveries).toEqual([]);
    });

    it("should allow deselecting with null", () => {
      useWebhookStore.setState({ selectedWebhookId: "wh-1" });
      useWebhookStore.getState().selectWebhook(null);
      expect(useWebhookStore.getState().selectedWebhookId).toBeNull();
    });
  });

  describe("fetchWebhooks", () => {
    it("should fetch and store webhooks on success", async () => {
      const webhooks = [
        { id: "wh-1", name: "Test", url: "https://example.com", events: [], enabled: true },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhooks }),
      });

      await useWebhookStore.getState().fetchWebhooks();

      expect(mockFetch).toHaveBeenCalledWith("/api/webhooks");
      expect(useWebhookStore.getState().webhooks).toEqual(webhooks);
      expect(useWebhookStore.getState().loading).toBe(false);
      expect(useWebhookStore.getState().error).toBeNull();
    });

    it("should set error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      await useWebhookStore.getState().fetchWebhooks();

      expect(useWebhookStore.getState().error).toBe("Server error");
      expect(useWebhookStore.getState().loading).toBe(false);
    });

    it("should set error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await useWebhookStore.getState().fetchWebhooks();

      expect(useWebhookStore.getState().error).toBe("Network error");
      expect(useWebhookStore.getState().loading).toBe(false);
    });
  });

  describe("createWebhook", () => {
    it("should POST and refetch on success", async () => {
      // First call: POST create
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-1" }),
      });
      // Second call: GET refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhooks: [{ id: "new-1", name: "New" }] }),
      });

      await useWebhookStore.getState().createWebhook({
        name: "New",
        url: "https://example.com",
        events: ["chat"],
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("POST");
    });

    it("should set error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Validation error" }),
      });

      await useWebhookStore.getState().createWebhook({
        name: "Bad",
        url: "not-a-url",
        events: [],
      });

      expect(useWebhookStore.getState().error).toBe("Validation error");
    });
  });

  describe("deleteWebhook", () => {
    it("should clear selectedWebhookId when deleting the selected webhook", async () => {
      useWebhookStore.setState({ selectedWebhookId: "wh-1" });

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ webhooks: [] }) });

      await useWebhookStore.getState().deleteWebhook("wh-1");

      expect(useWebhookStore.getState().selectedWebhookId).toBeNull();
    });

    it("should keep selectedWebhookId when deleting a different webhook", async () => {
      useWebhookStore.setState({ selectedWebhookId: "wh-2" });

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ webhooks: [] }) });

      await useWebhookStore.getState().deleteWebhook("wh-1");

      expect(useWebhookStore.getState().selectedWebhookId).toBe("wh-2");
    });
  });

  describe("fetchDeliveries", () => {
    it("should fetch deliveries for a webhook", async () => {
      const deliveries = [{ id: "d1", webhookId: "wh-1", eventType: "chat", success: true }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deliveries }),
      });

      await useWebhookStore.getState().fetchDeliveries("wh-1");

      expect(useWebhookStore.getState().deliveries).toEqual(deliveries);
    });

    it("should clear deliveries on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

      await useWebhookStore.getState().fetchDeliveries("wh-1");

      expect(useWebhookStore.getState().deliveries).toEqual([]);
    });
  });

  describe("testWebhook", () => {
    it("should POST test and refetch deliveries", async () => {
      // First call: POST test
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, statusCode: 200, durationMs: 50 }),
      });
      // Second call: GET deliveries refetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deliveries: [] }),
      });

      await useWebhookStore.getState().testWebhook("wh-1");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toBe("/api/webhooks/wh-1/test");
    });

    it("should set error on test failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Webhook not found" }),
      });

      await useWebhookStore.getState().testWebhook("wh-1");

      expect(useWebhookStore.getState().error).toBe("Webhook not found");
    });
  });

  describe("updateWebhook", () => {
    it("should PATCH and refetch on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "wh-1", name: "Updated" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhooks: [{ id: "wh-1", name: "Updated" }] }),
      });

      await useWebhookStore.getState().updateWebhook("wh-1", { name: "Updated" });

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/webhooks/wh-1");
      expect(opts.method).toBe("PATCH");
    });
  });
});

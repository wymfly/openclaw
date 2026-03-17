import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBudgetStore } from "./budget.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("budget store", () => {
  beforeEach(() => {
    useBudgetStore.setState({
      rules: [],
      evaluations: [],
      loading: false,
      error: null,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchRules", () => {
    it("should fetch and store rules on success", async () => {
      const rules = [
        { id: "r1", name: "Monthly cost", dimension: "cost", period: "monthly", enabled: true },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rules }),
      });

      await useBudgetStore.getState().fetchRules();

      expect(mockFetch).toHaveBeenCalledWith("/api/usage/budget");
      expect(useBudgetStore.getState().rules).toEqual(rules);
      expect(useBudgetStore.getState().loading).toBe(false);
    });

    it("should set error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Server error" }),
      });

      await useBudgetStore.getState().fetchRules();

      expect(useBudgetStore.getState().error).toBe("Server error");
      expect(useBudgetStore.getState().loading).toBe(false);
    });

    it("should set error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await useBudgetStore.getState().fetchRules();

      expect(useBudgetStore.getState().error).toBe("Network error");
    });
  });

  describe("createRule", () => {
    it("should POST and refetch on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "new-1" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rules: [{ id: "new-1", name: "New" }] }),
      });

      await useBudgetStore.getState().createRule({
        name: "New",
        dimension: "cost",
        scope: "global",
        period: "monthly",
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

      await useBudgetStore.getState().createRule({
        name: "Bad",
        dimension: "cost",
        scope: "global",
        period: "monthly",
      });

      expect(useBudgetStore.getState().error).toBe("Validation error");
    });
  });

  describe("updateRule", () => {
    it("should PATCH and refetch on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "r1", name: "Updated" }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rules: [{ id: "r1", name: "Updated" }] }),
      });

      await useBudgetStore.getState().updateRule("r1", { name: "Updated" });

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/usage/budget/r1");
      expect(opts.method).toBe("PATCH");
    });
  });

  describe("deleteRule", () => {
    it("should DELETE and refetch on success", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ deleted: true }) });
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) });

      await useBudgetStore.getState().deleteRule("r1");

      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/usage/budget/r1");
      expect(opts.method).toBe("DELETE");
    });

    it("should set error on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Rule not found" }),
      });

      await useBudgetStore.getState().deleteRule("bad-id");

      expect(useBudgetStore.getState().error).toBe("Rule not found");
    });
  });

  describe("evaluateBudgets", () => {
    it("should fetch evaluations", async () => {
      const evaluations = [
        { ruleId: "r1", ruleName: "Cost", status: "ok", current: 10, dimension: "cost" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ evaluations }),
      });

      await useBudgetStore.getState().evaluateBudgets();

      expect(mockFetch).toHaveBeenCalledWith("/api/usage/budget/evaluate");
      expect(useBudgetStore.getState().evaluations).toEqual(evaluations);
    });

    it("should clear evaluations on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

      await useBudgetStore.getState().evaluateBudgets();

      expect(useBudgetStore.getState().evaluations).toEqual([]);
    });

    it("should handle network error gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await useBudgetStore.getState().evaluateBudgets();

      expect(useBudgetStore.getState().evaluations).toEqual([]);
    });
  });
});

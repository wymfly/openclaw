import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRuntime = vi.fn();
const request = vi.fn();
const getBudgetRuleStore = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

vi.mock("@server/budget-alert-stores", () => ({
  getBudgetRuleStore,
}));

describe("/api/usage/budget/evaluate", () => {
  beforeEach(() => {
    getRuntime.mockReturnValue({
      eventBus: {
        broadcast: vi.fn(),
      },
      adapter: {
        request,
      },
    });
    request.mockResolvedValue({
      totals: {
        totalCost: 12,
        input: 100,
        output: 50,
        totalTokens: 150,
      },
    });
    getBudgetRuleStore.mockReturnValue({
      get: () => [
        {
          id: "rule-1",
          name: "Monthly cost",
          scope: "global",
          agentId: null,
          taskId: null,
          dimension: "cost",
          warnThreshold: 10,
          overThreshold: 20,
          period: "30d",
          enabled: true,
        },
      ],
    });
  });

  afterEach(() => {
    getRuntime.mockReset();
    request.mockReset();
    getBudgetRuleStore.mockReset();
  });

  it("uses runtime.adapter.request for usage.cost before evaluating rules", async () => {
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost"));
    const body = await response.json();

    expect(request).toHaveBeenCalledWith("usage.cost", { days: 30 });
    expect(body.evaluations).toHaveLength(1);
    expect(body.evaluations[0].ruleId).toBe("rule-1");
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getRuntime = vi.fn();
const gwCall = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/usage/budget/evaluate", () => {
  beforeEach(() => {
    getRuntime.mockReturnValue({
      db: {
        prepare: vi.fn(() => ({
          all: vi.fn(() => [
            {
              id: "rule-1",
              name: "Monthly cost",
              scope: "global",
              agent_id: null,
              task_id: null,
              dimension: "cost",
              warn_threshold: 10,
              over_threshold: 20,
              period: "30d",
              enabled: 1,
            },
          ]),
        })),
      },
      eventBus: {
        broadcast: vi.fn(),
      },
    });
    gwCall.mockResolvedValue({
      totals: {
        totalCost: 12,
        input: 100,
        output: 50,
        totalTokens: 150,
      },
    });
  });

  afterEach(() => {
    getRuntime.mockReset();
    gwCall.mockReset();
  });

  it("uses gwCall for usage.cost before evaluating rules", async () => {
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost"));
    const body = await response.json();

    expect(gwCall).toHaveBeenCalledWith("usage.cost", { days: 30 });
    expect(body.evaluations).toHaveLength(1);
    expect(body.evaluations[0].ruleId).toBe("rule-1");
  });
});

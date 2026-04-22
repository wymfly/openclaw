import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getBudgetRuleStore = vi.fn();

vi.mock("@server/budget-alert-stores", () => ({
  getBudgetRuleStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/usage/budget/[ruleId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getBudgetRuleStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies PATCH to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ id: "r1" }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");
    const response = await PATCH(
      new NextRequest("http://localhost/api/usage/budget/r1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ ruleId: "r1" }) },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/usage/budget/r1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(response.status).toBe(200);
  });

  it("proxies DELETE to Stage 2 budget routes when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");
    const response = await DELETE(
      new NextRequest("http://localhost/api/usage/budget/r1", { method: "DELETE" }),
      { params: Promise.resolve({ ruleId: "r1" }) },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/usage/budget/r1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });

  it("falls back to local store handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const updateItem = vi.fn();
    const removeWhere = vi.fn().mockReturnValue(1);
    getBudgetRuleStore.mockReturnValue({
      find: vi.fn().mockReturnValue({ id: "r1", name: "Budget" }),
      updateItem,
      removeWhere,
    });
    const { PATCH, DELETE } = await import("./route.js");
    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/usage/budget/r1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ ruleId: "r1" }) },
    );
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/usage/budget/r1", { method: "DELETE" }),
      { params: Promise.resolve({ ruleId: "r1" }) },
    );
    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(removeWhere).toHaveBeenCalledTimes(1);
  });
});

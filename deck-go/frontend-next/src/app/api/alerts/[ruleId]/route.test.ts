import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAlertRuleStore = vi.fn();

vi.mock("@server/budget-alert-stores", () => ({
  getAlertRuleStore,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/alerts/[ruleId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    getAlertRuleStore.mockReset();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
  });

  it("proxies PATCH to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ rule: {} }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { PATCH } = await import("./route.js");

    const response = await PATCH(
      new NextRequest("http://localhost/api/alerts/rule-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/alerts/rule-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(getAlertRuleStore).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("falls back to local store handlers when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const updateItem = vi.fn();
    const removeWhere = vi.fn().mockReturnValue(1);
    getAlertRuleStore.mockReturnValue({
      find: vi.fn().mockReturnValue({ id: "rule-1", name: "Rule 1" }),
      updateItem,
      removeWhere,
    });
    const { PATCH, DELETE } = await import("./route.js");

    const patchResponse = await PATCH(
      new NextRequest("http://localhost/api/alerts/rule-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );
    const deleteResponse = await DELETE(
      new NextRequest("http://localhost/api/alerts/rule-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );

    expect(patchResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(updateItem).toHaveBeenCalledTimes(1);
    expect(removeWhere).toHaveBeenCalledTimes(1);
  });

  it("proxies DELETE to Stage 2 alerts when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchMock;
    const { DELETE } = await import("./route.js");

    const response = await DELETE(
      new NextRequest("http://localhost/api/alerts/rule-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ ruleId: "rule-1" }) },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/alerts/rule-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
  });
});

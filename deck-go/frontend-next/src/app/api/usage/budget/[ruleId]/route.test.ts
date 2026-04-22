import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/usage/budget/[ruleId]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
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

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
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
    expect(patchResponse.status).toBe(503);
    expect(await patchResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
    expect(deleteResponse.status).toBe(503);
    expect(await deleteResponse.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});

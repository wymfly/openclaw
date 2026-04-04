import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchApi", () => {
  it("returns parsed JSON on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    const { fetchApi } = await import("@/lib/errors");

    await expect(fetchApi<{ ok: boolean }>("/api/test")).resolves.toEqual({ ok: true });
  });

  it("throws DeckApiError with GATEWAY_ERROR on 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Bad gateway" }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { DeckApiError, GatewayErrorCode, fetchApi } = await import("@/lib/errors");

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      name: "DeckApiError",
      code: GatewayErrorCode.GATEWAY_ERROR,
      status: 502,
      body: { error: "Bad gateway" },
    });
    await expect(fetchApi("/api/test")).rejects.toBeInstanceOf(DeckApiError);
  });

  it("throws DeckApiError with UNAUTHORIZED on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { GatewayErrorCode, fetchApi } = await import("@/lib/errors");

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      code: GatewayErrorCode.UNAUTHORIZED,
      status: 401,
      body: { error: "Unauthorized" },
    });
  });

  it("throws DeckApiError with RATE_LIMITED on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { GatewayErrorCode, fetchApi } = await import("@/lib/errors");

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      code: GatewayErrorCode.RATE_LIMITED,
      status: 429,
      body: { error: "Too many requests" },
    });
  });

  it("throws DeckApiError with NOT_CONFIGURED on 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "Gateway not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const { GatewayErrorCode, fetchApi } = await import("@/lib/errors");

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      code: GatewayErrorCode.NOT_CONFIGURED,
      status: 503,
      body: { error: "Gateway not configured" },
    });
  });

  it("throws DeckApiError with INTERNAL on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("network down"))),
    );

    const { GatewayErrorCode, fetchApi } = await import("@/lib/errors");

    await expect(fetchApi("/api/test")).rejects.toMatchObject({
      code: GatewayErrorCode.INTERNAL,
      status: 0,
      body: { error: "network down" },
    });
  });
});

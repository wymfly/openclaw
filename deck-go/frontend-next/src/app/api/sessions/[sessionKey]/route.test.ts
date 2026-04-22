import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("/api/sessions/[sessionKey]", () => {
  const originalFetch = globalThis.fetch;
  const originalApiBase = process.env.NEXT_PUBLIC_DECK_GO_API_BASE;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    if (originalApiBase === undefined) {
      delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    } else {
      process.env.NEXT_PUBLIC_DECK_GO_API_BASE = originalApiBase;
    }
  });

  it("proxies DELETE to deck-go when NEXT_PUBLIC_DECK_GO_API_BASE is set", async () => {
    process.env.NEXT_PUBLIC_DECK_GO_API_BASE = "http://127.0.0.1:19528";
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          requestId: "req-1",
          commandId: "cmd-4",
          submittedAt: "2026-04-21T00:00:00Z",
        }),
        { status: 202 },
      ),
    );
    globalThis.fetch = fetchMock;
    const ctx = { params: Promise.resolve({ sessionKey: "agent:main:main" }) };
    const mod = await import("./route.js");

    const response = await mod.DELETE(
      new NextRequest("http://localhost/api/sessions/agent:main:main", { method: "DELETE" }),
      ctx,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:19528/api/v1/runtimes/rt_local/sessions/agent%3Amain%3Amain",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, key: "agent:main:main" });
  });

  it("returns 503 when no deck-go base is configured", async () => {
    delete process.env.NEXT_PUBLIC_DECK_GO_API_BASE;
    const ctx = { params: Promise.resolve({ sessionKey: "agent:main:main" }) };
    const mod = await import("./route.js");

    const response = await mod.DELETE(
      new NextRequest("http://localhost/api/sessions/agent:main:main"),
      ctx,
    );

    expect("GET" in mod).toBe(false);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Deck Go control-plane API base not configured",
    });
  });
});

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init),
    },
  };
});

describe("/api/agents/[agentId]", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for agents.list and agents.update", async () => {
    gwRequest
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agents: [{ id: "main", name: "Main" }] }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { GET, PATCH } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    const getResponse = await GET(
      new NextRequest("http://localhost/api/agents/main"),
      ctx as never,
    );
    const patchRequest = new NextRequest("http://localhost/api/agents/main", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Main" }),
      headers: { "Content-Type": "application/json" },
    });
    await PATCH(patchRequest, ctx as never);

    expect(gwRequest).toHaveBeenNthCalledWith(1, "agents.list", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "agents.update", {
      agentId: "main",
      name: "Updated Main",
    });
    expect(getResponse.status).toBe(200);
  });
});

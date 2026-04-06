import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/agents/[agentId]/files", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for agents.files.list", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };

    await GET(new NextRequest("http://localhost/api/agents/main/files"), ctx as never);

    expect(gwRequest).toHaveBeenCalledWith("agents.files.list", { agentId: "main" });
  });

  it("uses typed gwRequest for agents.files.set", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main" }) };
    const request = new NextRequest("http://localhost/api/agents/main/files", {
      method: "POST",
      body: JSON.stringify({ name: "AGENTS.md", content: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request, ctx as never);

    expect(gwRequest).toHaveBeenCalledWith("agents.files.set", {
      agentId: "main",
      name: "AGENTS.md",
      content: "hello",
    });
  });
});

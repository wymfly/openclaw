import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (_req: Request, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/agents/[agentId]/files/[...path]", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for agents.files.get", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const ctx = { params: Promise.resolve({ agentId: "main", path: ["notes", "README.md"] }) };

    await GET(
      new Request("http://localhost/api/agents/main/files/notes/README.md") as never,
      ctx as never,
    );

    expect(gwRequest).toHaveBeenCalledWith("agents.files.get", {
      agentId: "main",
      name: "notes/README.md",
    });
  });
});

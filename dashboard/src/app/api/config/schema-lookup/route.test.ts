import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/config/schema-lookup", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for config.schema.lookup", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/config/schema-lookup", {
      method: "POST",
      body: JSON.stringify({ path: "agents.defaults" }),
      headers: { "Content-Type": "application/json" },
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("config.schema.lookup", { path: "agents.defaults" });
  });

  it("allows root lookup requests", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");
    const request = new NextRequest("http://localhost/api/config/schema-lookup", {
      method: "POST",
      body: JSON.stringify({ path: "" }),
    });

    await POST(request);

    expect(gwRequest).toHaveBeenCalledWith("config.schema.lookup", { path: "" });
  });
});

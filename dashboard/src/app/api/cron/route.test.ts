import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/cron", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for cron.list", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(
      new NextRequest(
        "http://localhost/api/cron?limit=10&offset=5&query=nightly&enabled=true&sortBy=name&sortDir=asc&includeDisabled=true",
      ),
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.list", {
      limit: 10,
      offset: 5,
      query: "nightly",
      enabled: "true",
      sortBy: "name",
      sortDir: "asc",
      includeDisabled: true,
    });
  });

  it("uses typed gwRequest for cron.add", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/cron", {
        method: "POST",
        body: JSON.stringify({ name: "Nightly", enabled: true }),
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.add", { name: "Nightly", enabled: true });
  });
});

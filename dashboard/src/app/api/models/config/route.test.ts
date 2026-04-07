import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/models/config", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for config.get", async () => {
    gwRequest.mockResolvedValueOnce(
      new Response(JSON.stringify({ raw: '{"models":{"providers":{}}}', hash: "h1" })),
    );
    const { GET } = await import("./route.js");

    await GET(new Request("http://localhost/api/models/config") as never);

    expect(gwRequest).toHaveBeenCalledWith("config.get", {});
  });
});

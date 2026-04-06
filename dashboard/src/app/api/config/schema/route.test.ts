import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/config/schema", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for config.schema", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET();

    expect(gwRequest).toHaveBeenCalledWith("config.schema", {});
  });
});

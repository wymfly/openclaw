import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/models/configured", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for models.configured", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new Request("http://localhost/api/models/configured") as never);

    expect(gwRequest).toHaveBeenCalledWith("models.configured", {});
  });
});

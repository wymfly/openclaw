import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/models", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for models.list", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(new Request("http://localhost/api/models") as never);

    expect(gwRequest).toHaveBeenCalledWith("models.list", {});
  });
});

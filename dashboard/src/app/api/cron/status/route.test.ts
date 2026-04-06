import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/cron/status", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for cron.status", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET();

    expect(gwRequest).toHaveBeenCalledWith("cron.status", {});
  });
});

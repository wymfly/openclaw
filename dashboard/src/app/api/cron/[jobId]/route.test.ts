import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/cron/[jobId]", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for cron.update and cron.remove", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { PATCH, DELETE } = await import("./route.js");
    const ctx = { params: Promise.resolve({ jobId: "job-1" }) };

    await PATCH(
      new NextRequest("http://localhost/api/cron/job-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      ctx,
    );
    await DELETE(new NextRequest("http://localhost/api/cron/job-1"), ctx);

    expect(gwRequest).toHaveBeenNthCalledWith(1, "cron.update", {
      id: "job-1",
      patch: { enabled: false },
    });
    expect(gwRequest).toHaveBeenNthCalledWith(2, "cron.remove", { id: "job-1" });
  });
});

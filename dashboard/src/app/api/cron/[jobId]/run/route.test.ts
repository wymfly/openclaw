import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/cron/[jobId]/run", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for cron.run", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/cron/job-1/run", {
        method: "POST",
        body: JSON.stringify({ mode: "force" }),
      }),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.run", { id: "job-1", mode: "force" });
  });
});

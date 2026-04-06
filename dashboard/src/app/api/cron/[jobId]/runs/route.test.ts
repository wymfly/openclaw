import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/cron/[jobId]/runs", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for cron.runs", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");

    await GET(
      new NextRequest(
        "http://localhost/api/cron/job-1/runs?limit=20&offset=5&sortDir=desc&statuses=ok,failed",
      ),
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(gwRequest).toHaveBeenCalledWith("cron.runs", {
      scope: "job",
      jobId: "job-1",
      limit: 20,
      offset: 5,
      sortDir: "desc",
      statuses: ["ok", "failed"],
    });
  });
});

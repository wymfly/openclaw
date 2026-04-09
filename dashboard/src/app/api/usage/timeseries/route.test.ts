import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/usage/timeseries", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for sessions.usage.timeseries", async () => {
    gwRequest.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    const { GET } = await import("./route.js");
    const request = new NextRequest(
      "http://localhost/api/usage/timeseries?key=sess-1&startDate=2026-04-01&endDate=2026-04-07&mode=utc&utcOffset=%2B08%3A00",
    );

    await GET(request);

    expect(gwRequest).toHaveBeenCalledWith("sessions.usage.timeseries", {
      key: "sess-1",
      startDate: "2026-04-01",
      endDate: "2026-04-07",
      mode: "utc",
      utcOffset: "+08:00",
    });
  });
});

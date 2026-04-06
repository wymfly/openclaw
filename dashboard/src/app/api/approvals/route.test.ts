import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/approvals", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for approvals snapshot and resolve", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET, POST } = await import("./route.js");

    await GET();
    await POST(
      new NextRequest("http://localhost/api/approvals", {
        method: "POST",
        body: JSON.stringify({ id: "ap-1", decision: "approve" }),
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "exec.approvals.get", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "exec.approval.resolve", {
      id: "ap-1",
      decision: "approve",
    });
  });
});

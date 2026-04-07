import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/approvals/policy", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for approvals policy read and write", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { GET, PUT } = await import("./route.js");

    await GET(new NextRequest("http://localhost"));
    await PUT(
      new NextRequest("http://localhost/api/approvals/policy", {
        method: "PUT",
        body: JSON.stringify({ file: { policy: "strict" }, baseHash: "h1" }),
      }),
    );

    expect(gwRequest).toHaveBeenNthCalledWith(1, "exec.approvals.get", {});
    expect(gwRequest).toHaveBeenNthCalledWith(2, "exec.approvals.set", {
      file: { policy: "strict" },
      baseHash: "h1",
    });
  });
});

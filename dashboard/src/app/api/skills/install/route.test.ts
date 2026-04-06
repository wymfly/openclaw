import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/skills/install", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for skills.install", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/skills/install", {
        method: "POST",
        body: JSON.stringify({ name: "foo", installId: "bar" }),
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith("skills.install", {
      name: "foo",
      installId: "bar",
    });
  });
});

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest) => Promise<Response> | Response) => handler,
}));

describe("/api/skills/update-clawhub", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for ClawHub skill updates", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { POST } = await import("./route.js");

    await POST(
      new NextRequest("http://localhost/api/skills/update-clawhub", {
        method: "POST",
        body: JSON.stringify({ slug: "test-skill" }),
      }),
    );

    expect(gwRequest).toHaveBeenCalledWith("skills.update", {
      source: "clawhub",
      slug: "test-skill",
    });
  });
});

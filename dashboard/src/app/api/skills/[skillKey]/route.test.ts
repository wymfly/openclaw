import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwRequest = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwRequest,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: (req: NextRequest, ctx: unknown) => Promise<Response> | Response) => handler,
}));

describe("/api/skills/[skillKey]", () => {
  afterEach(() => {
    gwRequest.mockReset();
  });

  it("uses typed gwRequest for skills.update", async () => {
    gwRequest.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const { PATCH } = await import("./route.js");

    await PATCH(
      new NextRequest("http://localhost/api/skills/demo", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      { params: Promise.resolve({ skillKey: "demo" }) },
    );

    expect(gwRequest).toHaveBeenCalledWith("skills.update", {
      skillKey: "demo",
      enabled: false,
    });
  });
});

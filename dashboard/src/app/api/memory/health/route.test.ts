import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const gwCall = vi.fn();

vi.mock("@/lib/api-helpers", () => ({
  gwCall,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/memory/health", () => {
  afterEach(() => {
    gwCall.mockReset();
  });

  it("uses gwCall for doctor.memory.status", async () => {
    gwCall.mockResolvedValue({ entries: [], lanceDbEnabled: false });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost"));
    const body = await response.json();

    expect(gwCall).toHaveBeenCalledWith("doctor.memory.status", {});
    expect(body).toEqual({ entries: [], lanceDbEnabled: false });
  });
});

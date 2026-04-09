import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const getRuntime = vi.fn();

vi.mock("@server/runtime", () => ({
  getRuntime,
}));

vi.mock("@/lib/with-auth", () => ({
  withAuth: (handler: () => Promise<Response> | Response) => handler,
}));

describe("/api/memory/health", () => {
  afterEach(() => {
    request.mockReset();
    getRuntime.mockReset();
  });

  it("uses runtime.adapter.request for doctor.memory.status", async () => {
    request.mockResolvedValue({ entries: [], lanceDbEnabled: false });
    getRuntime.mockReturnValue({
      adapter: { request },
    });
    const { GET } = await import("./route.js");

    const response = await GET(new NextRequest("http://localhost"));
    const body = await response.json();

    expect(request).toHaveBeenCalledWith("doctor.memory.status", {});
    expect(body).toEqual({ entries: [], lanceDbEnabled: false });
  });
});

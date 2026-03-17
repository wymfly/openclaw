import { describe, it, expect, vi } from "vitest";

// Mock top-level dependencies of api-helpers before import
vi.mock("next/server", () => ({ NextResponse: { json: vi.fn() } }));
vi.mock("@server/runtime", () => ({ getRuntime: vi.fn(() => null) }));
vi.mock("@server/gateway-adapter", () => ({
  ControlPlaneGatewayError: class extends Error {},
}));

import { extractPlatformHeaders } from "../api-helpers.js";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("extractPlatformHeaders", () => {
  it("extracts X-Tenant-Id and X-User-Id when present", () => {
    const req = makeRequest({ "X-Tenant-Id": "tenant-abc", "X-User-Id": "user-123" });
    expect(extractPlatformHeaders(req)).toEqual({
      "x-tenant-id": "tenant-abc",
      "x-user-id": "user-123",
    });
  });

  it("returns empty object when no platform headers are present", () => {
    const req = makeRequest({ "Content-Type": "application/json" });
    expect(extractPlatformHeaders(req)).toEqual({});
  });

  it("extracts only the headers that are present", () => {
    const req = makeRequest({ "X-Tenant-Id": "tenant-only" });
    expect(extractPlatformHeaders(req)).toEqual({ "x-tenant-id": "tenant-only" });
  });

  it("handles case-insensitive header names (lowercase)", () => {
    const req = makeRequest({ "x-tenant-id": "t1", "x-user-id": "u1" });
    expect(extractPlatformHeaders(req)).toEqual({ "x-tenant-id": "t1", "x-user-id": "u1" });
  });

  it("handles case-insensitive header names (mixed case)", () => {
    const req = makeRequest({ "x-TENANT-id": "mixed-t", "X-USER-ID": "MIXED-U" });
    expect(extractPlatformHeaders(req)).toEqual({
      "x-tenant-id": "mixed-t",
      "x-user-id": "MIXED-U",
    });
  });

  it("returns empty object for a completely empty request", () => {
    expect(extractPlatformHeaders(makeRequest())).toEqual({});
  });
});

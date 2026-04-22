import { describe, it, expect, vi } from "vitest";

// Mock top-level dependencies of api-helpers before import
const { nextJsonMock, getRuntimeMock } = vi.hoisted(() => ({
  nextJsonMock: vi.fn((_body, init) => ({ body: _body, init })),
  getRuntimeMock: vi.fn(() => null),
}));
vi.mock("next/server", () => ({ NextResponse: { json: nextJsonMock } }));
vi.mock("@server/runtime", () => ({ getRuntime: getRuntimeMock }));
vi.mock("@server/gateway-adapter", () => ({
  ControlPlaneGatewayError: class extends Error {
    code: string;
    details?: unknown;
    constructor(params: { code: string; message: string; details?: unknown }) {
      super(params.message);
      this.code = params.code;
      this.details = params.details;
    }
  },
}));

import { extractPlatformHeaders, gwCall, gwRequest } from "../api-helpers.js";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("extractPlatformHeaders", () => {
  it("returns deterministic compatibility errors when runtime is incompatible", async () => {
    getRuntimeMock.mockReturnValueOnce({
      capabilities: {
        status: "incompatible" as const,
        reason: "Gateway missing required capability: sessions.send",
        snapshot: null,
        ready: Promise.resolve(),
      },
    } as unknown as ReturnType<typeof getRuntimeMock>);

    const response = await gwRequest("sessions.list", { limit: 1 });

    expect(nextJsonMock).toHaveBeenCalledWith(
      {
        error: "Gateway missing required capability: sessions.send",
        code: "GATEWAY_INCOMPATIBLE",
      },
      { status: 503 },
    );
    expect(response).toEqual({
      body: {
        error: "Gateway missing required capability: sessions.send",
        code: "GATEWAY_INCOMPATIBLE",
      },
      init: { status: 503 },
    });
  });

  it("waits for pending capability bootstrap before returning incompatibility", async () => {
    let resolveReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });
    const runtime = {
      capabilities: {
        status: "pending" as "pending" | "ready" | "incompatible",
        reason: null as string | null,
        snapshot: null,
        ready,
      },
      adapter: { request: vi.fn() },
    };
    getRuntimeMock.mockReturnValueOnce(runtime as unknown as ReturnType<typeof getRuntimeMock>);

    const responsePromise = gwRequest("sessions.list", { limit: 1 });
    runtime.capabilities.status = "incompatible";
    runtime.capabilities.reason = "Gateway missing required capability: sessions.send";
    resolveReady();

    const response = await responsePromise;

    expect(runtime.adapter.request).not.toHaveBeenCalled();
    expect(response).toEqual({
      body: {
        error: "Gateway missing required capability: sessions.send",
        code: "GATEWAY_INCOMPATIBLE",
      },
      init: { status: 503 },
    });
  });

  it("gwCall throws deterministic compatibility errors when runtime is incompatible", async () => {
    getRuntimeMock.mockReturnValueOnce({
      capabilities: {
        status: "incompatible" as const,
        reason: "Gateway missing required capability: sessions.send",
        snapshot: null,
        ready: Promise.resolve(),
      },
    } as unknown as ReturnType<typeof getRuntimeMock>);

    await expect(gwCall("sessions.list", { limit: 1 })).rejects.toMatchObject({
      code: "GATEWAY_INCOMPATIBLE",
      message: "Gateway missing required capability: sessions.send",
    });
  });

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

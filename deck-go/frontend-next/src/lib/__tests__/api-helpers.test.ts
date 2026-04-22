import { describe, expect, it, vi } from "vitest";

const { getRuntimeMock } = vi.hoisted(() => ({
  getRuntimeMock: vi.fn(() => null),
}));
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

import { gwCall } from "../api-helpers.js";

describe("gwCall", () => {
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

    const responsePromise = gwCall("sessions.list", { limit: 1 });
    runtime.capabilities.status = "incompatible";
    runtime.capabilities.reason = "Gateway missing required capability: sessions.send";
    resolveReady();

    await expect(responsePromise).rejects.toMatchObject({
      code: "GATEWAY_INCOMPATIBLE",
      message: "Gateway missing required capability: sessions.send",
    });
    expect(runtime.adapter.request).not.toHaveBeenCalled();
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
});

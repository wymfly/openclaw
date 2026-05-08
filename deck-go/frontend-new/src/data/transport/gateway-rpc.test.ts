import { describe, expect, it, vi } from "vitest";
import type { GatewayMethodMap } from "../../../../contracts/generated/ts/gateway/protocol";

const gatewayClientMocks = vi.hoisted(() => ({
  createDeckGatewayClient: vi.fn(() => ({ marker: "client" })),
}));

vi.mock("../../lib/gateway-client", () => ({
  createDeckGatewayClient: gatewayClientMocks.createDeckGatewayClient,
}));

import { createGatewayRpcQuerySource, createGatewayRpcTransport } from "./gateway-rpc";

describe("Data Fabric Gateway RPC transport", () => {
  it("reuses client state while leaving per-request tracing to the Gateway client", async () => {
    const clients: unknown[] = [];
    const source = createGatewayRpcQuerySource("models.configured", async (client) => {
      clients.push(client);
      return { models: [] } as GatewayMethodMap["models.configured"]["result"];
    });
    const transport = createGatewayRpcTransport({ runtimeId: "rt_local" });

    await transport(source, new AbortController().signal);
    await transport(source, new AbortController().signal);

    expect(gatewayClientMocks.createDeckGatewayClient).toHaveBeenCalledTimes(1);
    expect(gatewayClientMocks.createDeckGatewayClient).toHaveBeenCalledWith({
      runtimeId: "rt_local",
    });
    expect(clients).toHaveLength(2);
    expect(clients[0]).toBe(clients[1]);
  });

  it("rejects already-aborted requests before dispatching Gateway RPC", async () => {
    const source = createGatewayRpcQuerySource("models.configured", async () => {
      throw new Error("should not dispatch");
    });
    const signal = AbortSignal.abort();
    const transport = createGatewayRpcTransport();

    expect(() => transport(source, signal)).toThrow(
      expect.objectContaining({ name: "AbortError" }),
    );
  });
});

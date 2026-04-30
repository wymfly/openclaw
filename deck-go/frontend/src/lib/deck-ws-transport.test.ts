import { describe, expect, it } from "vitest";
import { DeckGatewayWebSocketTransport } from "./deck-ws-transport";
import { isGatewayError } from "./gateway-client";

class MockWebSocket extends EventTarget {
  static instances: MockWebSocket[] = [];
  readonly url: string;
  sent: string[] = [];

  constructor(url: string) {
    super();
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.dispatchEvent(new Event("close"));
  }

  receive(data: unknown) {
    this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
}

describe("DeckGatewayWebSocketTransport", () => {
  it("sends typed request frames and resolves matching responses", async () => {
    MockWebSocket.instances = [];
    const transport = new DeckGatewayWebSocketTransport({
      accessToken: "deck-token",
      runtimeId: "rt_local",
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    const socket = MockWebSocket.instances[0];

    const result = transport.request("gateway.describe", { includeSchemas: false });
    expect(socket.url).toBe("/api/v1/runtimes/rt_local/gateway/ws?token=deck-token");
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: "req",
      id: "ws-1",
      method: "gateway.describe",
      params: { includeSchemas: false },
    });

    socket.receive({
      type: "res",
      id: "ws-1",
      ok: true,
      payload: { protocol: 3, schemaVersion: "3.x", methods: {}, events: {}, untyped: [] },
    });

    await expect(result).resolves.toMatchObject({ protocol: 3 });
  });

  it("rejects response errors as GatewayError", async () => {
    MockWebSocket.instances = [];
    const transport = new DeckGatewayWebSocketTransport({
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    const socket = MockWebSocket.instances[0];

    const result = transport.request("gateway.describe", {});
    socket.receive({
      type: "res",
      id: "ws-1",
      ok: false,
      error: { code: "INVALID_GATEWAY_METHOD", message: "blocked" },
    });

    await expect(result).rejects.toMatchObject({ code: "INVALID_GATEWAY_METHOD" });
    await result.catch((error) => expect(isGatewayError(error)).toBe(true));
  });
});

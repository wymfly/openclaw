import { afterEach, describe, expect, it, vi } from "vitest";

const deckFetchMock = vi.fn();

vi.mock("./deck-client", () => ({
  deckFetch: (...args: unknown[]) => deckFetchMock(...args),
}));

import {
  createDeckGatewayClient,
  createDeckGatewayTransport,
  GatewayError,
  isGatewayError,
  isGatewayScopeError,
} from "./gateway-client";

afterEach(() => {
  vi.clearAllMocks();
});

describe("deck-go gateway typed transport", () => {
  it("posts typed calls through the runtime gateway RPC endpoint with migrated auth and tracing headers", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ requestId: "req-1", result: { models: [] } }), {
        status: 200,
      }),
    );

    const request = createDeckGatewayTransport({
      accessToken: "deck-token",
      requestId: "req-1",
      runtimeId: "rt_local",
    });

    await expect(request("models.configured", {}, { timeoutMs: 2500 })).resolves.toEqual({
      models: [],
    });

    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/v1/runtimes/rt_local/gateway/rpc",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer deck-token",
          "Content-Type": "application/json",
          "X-Request-Id": "req-1",
        },
        body: JSON.stringify({
          method: "models.configured",
          params: {},
          timeoutMs: 2500,
        }),
      },
      { token: "deck-token" },
    );
  });

  it("throws a discriminated GatewayError for typed RPC failures", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "scope_denied",
            details: { requiredScope: "operator.read" },
            message: "missing scope",
          },
          requestId: "req-2",
        }),
        { status: 403 },
      ),
    );

    const request = createDeckGatewayTransport({ requestId: "req-2", runtimeId: "rt_local" });

    let error: unknown;
    try {
      await request("gateway.describe", { includeSchemas: true });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(GatewayError);
    expect(error).toMatchObject({
      code: "scope_denied",
      details: { requiredScope: "operator.read" },
      kind: "gateway",
      requestId: "req-2",
      status: 403,
    });
    expect(isGatewayError(error)).toBe(true);
    expect(isGatewayScopeError(error)).toBe(true);
    if (isGatewayScopeError(error)) {
      const code: "scope_denied" = error.code;
      expect(code).toBe("scope_denied");
    }
  });

  it("posts typed batches through the runtime gateway batch endpoint", async () => {
    deckFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          requestId: "batch-1",
          results: [
            {
              id: "describe",
              ok: true,
              result: { protocol: 3, schemaVersion: "3.x", methods: {}, events: {}, untyped: [] },
            },
            {
              id: "models",
              ok: false,
              error: { code: "INVALID_GATEWAY_METHOD", message: "blocked" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const client = createDeckGatewayClient({
      accessToken: "deck-token",
      requestId: "batch-1",
      runtimeId: "rt_local",
    });

    const result = await client.batch(
      [
        { id: "describe", method: "gateway.describe", params: { includeSchemas: false } },
        { id: "models", method: "models.configured", params: {} },
      ] as const,
      { failFast: false, timeoutMs: 2500 },
    );

    expect(result[0]).toMatchObject({ protocol: 3 });
    expect(result[1]).toBeInstanceOf(GatewayError);
    expect(isGatewayError(result[1])).toBe(true);
    expect(deckFetchMock).toHaveBeenCalledWith(
      "/api/v1/runtimes/rt_local/gateway/batch",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer deck-token",
          "Content-Type": "application/json",
          "X-Request-Id": "batch-1",
        },
        body: JSON.stringify({
          calls: [
            { id: "describe", method: "gateway.describe", params: { includeSchemas: false } },
            { id: "models", method: "models.configured", params: {} },
          ],
          options: { failFast: false, timeoutMs: 2500 },
        }),
      },
      { token: "deck-token" },
    );
  });

  it("rejects mismatched batch params at compile time", () => {
    const client = createDeckGatewayClient({ requestId: "type-test" });
    void (() => {
      // @ts-expect-error agents.files.get requires agentId and name
      void client.batch([{ id: "file", method: "agents.files.get", params: {} }] as const);
    });
  });
});

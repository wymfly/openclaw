import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startGatewayServerHarness, type GatewayServerHarness } from "./server.e2e-ws-harness.js";
import { installGatewayTestHooks, onceMessage } from "./test-helpers.js";

installGatewayTestHooks({ scope: "suite" });

let harness: GatewayServerHarness;

beforeAll(async () => {
  harness = await startGatewayServerHarness();
});

afterAll(async () => {
  await harness.close();
});

describe("gateway.batch websocket RPC", () => {
  test("dispatches multiple gateway methods over one request", { timeout: 20_000 }, async () => {
    const { ws } = await harness.openClient();
    const batchResponse = onceMessage(ws, (o) => o.type === "res" && o.id === "batch-1");

    ws.send(
      JSON.stringify({
        type: "req",
        id: "batch-1",
        method: "gateway.batch",
        params: {
          calls: [
            { id: "health", method: "health" },
            { id: "status", method: "status" },
          ],
          options: { timeoutMs: 50 },
        },
      }),
    );

    const response = await batchResponse;
    expect(response.ok).toBe(true);
    const payload = response.payload as
      | { results?: Array<{ id?: string; ok?: boolean; result?: unknown }> }
      | undefined;
    expect(payload?.results?.map((entry) => ({ id: entry.id, ok: entry.ok }))).toEqual([
      { id: "health", ok: true },
      { id: "status", ok: true },
    ]);

    ws.close();
  });
});

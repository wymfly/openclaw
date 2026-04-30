import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testing as controlPlaneRateLimitTesting } from "../../control-plane-rate-limit.js";
import { READ_SCOPE } from "../../method-scopes.js";
import { ErrorCodes, errorShape } from "../../protocol/index.js";
import { dispatchGatewayRequest } from "../dispatcher.js";
import { gatewayBatchHandlers } from "../gateway-batch.js";
import type {
  DispatchGatewaySubRequest,
  GatewayRequestContext,
  GatewayRequestHandlers,
  GatewayRequestOptions,
} from "../types.js";

const noWebchat = () => false;

function buildContext(logWarn = vi.fn()): GatewayRequestContext {
  return {
    logGateway: {
      warn: logWarn,
    },
  } as unknown as GatewayRequestContext;
}

function buildClient(
  scopes: string[] = ["operator.admin"],
): NonNullable<GatewayRequestOptions["client"]> {
  return {
    connect: {
      role: "operator",
      scopes,
      client: {
        id: "test",
        version: "1.0.0",
        platform: "test",
        mode: "test",
      },
      minProtocol: 1,
      maxProtocol: 1,
    },
    connId: "conn-gateway-batch-test",
    clientIp: "127.0.0.1",
  } as NonNullable<GatewayRequestOptions["client"]>;
}

function req(method: string, params?: unknown, id = crypto.randomUUID()) {
  return {
    type: "req" as const,
    id,
    method,
    params,
  };
}

async function invokeBatch(params: unknown, dispatchSubRequest?: DispatchGatewaySubRequest) {
  const respond = vi.fn();
  await gatewayBatchHandlers["gateway.batch"]({
    req: req("gateway.batch", params),
    params: (params ?? {}) as Record<string, unknown>,
    client: null,
    isWebchatConnect: noWebchat,
    respond,
    context: buildContext(),
    dispatchSubRequest,
  });
  return respond;
}

function response<TPayload = unknown>(respond: ReturnType<typeof vi.fn>) {
  const [ok, payload, error] = respond.mock.calls.at(-1) ?? [];
  return { ok: Boolean(ok), payload: payload as TPayload, error };
}

describe("gateway.batch handler", () => {
  beforeEach(() => {
    controlPlaneRateLimitTesting.resetControlPlaneRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    controlPlaneRateLimitTesting.resetControlPlaneRateLimitState();
  });

  it("rejects empty and oversized batches before dispatching", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>();

    const empty = await invokeBatch({ calls: [] }, dispatchSubRequest);
    expect(response(empty).ok).toBe(false);
    expect(response(empty).error).toEqual(
      expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: expect.stringContaining("invalid gateway.batch params"),
      }),
    );

    const oversized = await invokeBatch(
      {
        calls: Array.from({ length: 33 }, (_, index) => ({
          id: `call-${index}`,
          method: "health",
        })),
      },
      dispatchSubRequest,
    );
    expect(response(oversized).ok).toBe(false);
    expect(dispatchSubRequest).not.toHaveBeenCalled();
  });

  it("dispatches subcalls in request order and accepts advisory timeoutMs", async () => {
    const seen: string[] = [];
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        seen.push(subReq.method);
        respond(true, { method: subReq.method, params: subReq.params ?? null });
      },
    );

    const respond = await invokeBatch(
      {
        calls: [
          { id: "one", method: "health" },
          { id: "two", method: "models.list", params: { includeDisabled: true } },
        ],
        options: { timeoutMs: 25 },
      },
      dispatchSubRequest,
    );

    expect(seen).toEqual(["health", "models.list"]);
    expect(response<{ results: unknown[] }>(respond)).toEqual({
      ok: true,
      payload: {
        results: [
          { id: "one", ok: true, result: { method: "health", params: null } },
          {
            id: "two",
            ok: true,
            result: { method: "models.list", params: { includeDisabled: true } },
          },
        ],
      },
      error: undefined,
    });
  });

  it("fails loud when the dispatcher seam is unavailable", async () => {
    const respond = await invokeBatch({
      calls: [{ id: "one", method: "health" }],
    });

    expect(response(respond)).toEqual({
      ok: false,
      payload: undefined,
      error: expect.objectContaining({
        code: ErrorCodes.INVALID_REQUEST,
        message: expect.stringContaining("dispatcher is unavailable"),
      }),
    });
  });

  it("rejects recursive and subscription subcalls without dispatching them", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(async ({ respond }) => {
      respond(true, { dispatched: true });
    });

    const respond = await invokeBatch(
      {
        calls: [
          { id: "nested", method: "gateway.batch", params: { calls: [] } },
          { id: "sub", method: "sessions.messages.subscribe" },
          { id: "bare-subscribe", method: "subscribe" },
        ],
      },
      dispatchSubRequest,
    );

    expect(dispatchSubRequest).toHaveBeenCalledTimes(1);
    expect(
      response<{ results: Array<{ id: string; ok: boolean; error: { message: string } }> }>(respond)
        .payload.results,
    ).toEqual([
      {
        id: "nested",
        ok: false,
        error: expect.objectContaining({
          code: ErrorCodes.INVALID_REQUEST,
          message: expect.stringContaining("cannot include gateway.batch"),
        }),
      },
      {
        id: "sub",
        ok: false,
        error: expect.objectContaining({
          code: ErrorCodes.INVALID_REQUEST,
          message: expect.stringContaining("does not support subscription method"),
        }),
      },
      { id: "bare-subscribe", ok: true, result: { dispatched: true } },
    ]);
  });

  it("isolates thrown subcall handlers and continues by default", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        if (subReq.method === "throwing.method") {
          throw new Error("boom");
        }
        respond(true, { method: subReq.method });
      },
    );

    const respond = await invokeBatch(
      {
        calls: [
          { id: "first", method: "health" },
          { id: "thrown", method: "throwing.method" },
          { id: "last", method: "status" },
        ],
      },
      dispatchSubRequest,
    );

    expect(
      response<{ results: Array<{ id: string; ok: boolean; error?: { message: string } }> }>(
        respond,
      ).payload.results,
    ).toEqual([
      { id: "first", ok: true, result: { method: "health" } },
      {
        id: "thrown",
        ok: false,
        error: expect.objectContaining({
          code: ErrorCodes.UNAVAILABLE,
          message: expect.stringContaining("throwing.method threw: boom"),
        }),
      },
      { id: "last", ok: true, result: { method: "status" } },
    ]);
  });

  it("isolates subcall failures and stops only when failFast is set", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        if (subReq.method === "bad.method") {
          respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "bad subcall"));
          return;
        }
        respond(true, { method: subReq.method });
      },
    );

    const continuing = await invokeBatch(
      {
        calls: [
          { id: "first", method: "health" },
          { id: "bad", method: "bad.method" },
          { id: "last", method: "status" },
        ],
      },
      dispatchSubRequest,
    );
    expect(response<{ results: unknown[] }>(continuing).payload.results).toHaveLength(3);

    const failFast = await invokeBatch(
      {
        calls: [
          { id: "first", method: "health" },
          { id: "bad", method: "bad.method" },
          { id: "last", method: "status" },
        ],
        options: { failFast: true },
      },
      dispatchSubRequest,
    );
    expect(response<{ results: unknown[] }>(failFast).payload.results).toHaveLength(2);
  });

  it("does not roll back successful earlier subcalls after a later failure", async () => {
    const committed: string[] = [];
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        if (subReq.method === "commit") {
          committed.push(String(subReq.params));
          respond(true, { committed: true });
          return;
        }
        respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "planned failure"));
      },
    );

    const respond = await invokeBatch(
      {
        calls: [
          { id: "commit-1", method: "commit", params: "one" },
          { id: "commit-2", method: "commit", params: "two" },
          { id: "fail", method: "fail" },
        ],
        options: { failFast: true },
      },
      dispatchSubRequest,
    );

    expect(response(respond).ok).toBe(true);
    expect(committed).toEqual(["one", "two"]);
  });

  it("captures one subcall response and reports missing responses per entry", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        if (subReq.method === "double") {
          respond(true, { value: "first" });
          respond(true, { value: "second" });
        }
      },
    );

    const respond = await invokeBatch(
      {
        calls: [
          { id: "double", method: "double" },
          { id: "silent", method: "silent" },
        ],
      },
      dispatchSubRequest,
    );

    expect(
      response<{ results: Array<{ ok: boolean; result?: unknown; error?: { message: string } }> }>(
        respond,
      ).payload.results,
    ).toEqual([
      { id: "double", ok: true, result: { value: "first" } },
      {
        id: "silent",
        ok: false,
        error: expect.objectContaining({ message: expect.stringContaining("did not respond") }),
      },
    ]);
  });

  it("is byte-stable for identical subcall results", async () => {
    const dispatchSubRequest = vi.fn<DispatchGatewaySubRequest>(
      async ({ req: subReq, respond }) => {
        respond(true, { method: subReq.method });
      },
    );
    const params = {
      calls: [
        { id: "a", method: "health" },
        { id: "b", method: "status" },
      ],
    };

    const first = await invokeBatch(params, dispatchSubRequest);
    const second = await invokeBatch(params, dispatchSubRequest);

    expect(JSON.stringify(response(first).payload)).toBe(JSON.stringify(response(second).payload));
  });

  it("enforces nested scopes through dispatcher subcalls", async () => {
    const respond = vi.fn();
    const modelsList = vi.fn(({ respond: nestedRespond }) => nestedRespond(true, { models: [] }));
    const configPatch = vi.fn(({ respond: nestedRespond }) => nestedRespond(true));
    const handlers: GatewayRequestHandlers = {
      ...gatewayBatchHandlers,
      "models.list": modelsList,
      "config.patch": configPatch,
    };

    await dispatchGatewayRequest({
      req: req("gateway.batch", {
        calls: [
          { id: "read", method: "models.list" },
          { id: "write", method: "config.patch", params: { patch: [] } },
        ],
      }),
      respond,
      client: buildClient([READ_SCOPE]),
      isWebchatConnect: noWebchat,
      context: buildContext(),
      handlers,
    });

    expect(modelsList).toHaveBeenCalledTimes(1);
    expect(configPatch).not.toHaveBeenCalled();
    expect(
      response<{ results: Array<{ id: string; ok: boolean; error?: { message: string } }> }>(
        respond,
      ).payload.results,
    ).toEqual([
      { id: "read", ok: true, result: { models: [] } },
      {
        id: "write",
        ok: false,
        error: expect.objectContaining({ message: "missing scope: operator.admin" }),
      },
    ]);
  });

  it("applies control-plane write budget per write subcall", async () => {
    const respond = vi.fn();
    const logWarn = vi.fn();
    const configPatch = vi.fn(({ respond: nestedRespond }) => nestedRespond(true, { ok: true }));
    const handlers: GatewayRequestHandlers = {
      ...gatewayBatchHandlers,
      "config.patch": configPatch,
    };

    await dispatchGatewayRequest({
      req: req(
        "gateway.batch",
        {
          calls: Array.from({ length: 5 }, (_, index) => ({
            id: `write-${index}`,
            method: "config.patch",
            params: { patch: [] },
          })),
        },
        "00000000-0000-4000-8000-000000000001",
      ),
      respond,
      client: buildClient(),
      isWebchatConnect: noWebchat,
      context: buildContext(logWarn),
      handlers,
      controlPlaneWriteMethods: new Set(["config.patch"]),
    });

    // Default budget is 3 writes/minute, so 5 attempts become 3 ok + 2 UNAVAILABLE.
    expect(configPatch).toHaveBeenCalledTimes(3);
    expect(logWarn).toHaveBeenCalledWith(
      expect.stringContaining("batch=00000000-0000-4000-8000-000000000001"),
    );
    expect(
      response<{ results: Array<{ ok: boolean; error?: { code: string } }> }>(
        respond,
      ).payload.results.map((entry) => entry.ok),
    ).toEqual([true, true, true, false, false]);
    expect(
      response<{ results: Array<{ ok: boolean; error?: { code: string } }> }>(
        respond,
      ).payload.results.at(-1)?.error,
    ).toEqual(expect.objectContaining({ code: ErrorCodes.UNAVAILABLE }));
  });

  it("does not import dispatcher internals or generated handler manifests", async () => {
    const source = await readFile(new URL("../gateway-batch.ts", import.meta.url), "utf8");

    expect(source).not.toContain("../dispatcher");
    expect(source).not.toContain("_modules.generated");
    expect(source).not.toContain("_method-defs.generated");
    expect(source).not.toContain("coreGatewayHandlers");
  });
});

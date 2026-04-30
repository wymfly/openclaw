import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPluginRuntimeGatewayRequestScope } from "../../../plugins/runtime/gateway-request-scope.js";
import { __testing as controlPlaneRateLimitTesting } from "../../control-plane-rate-limit.js";
import { dispatchGatewayRequest } from "../dispatcher.js";
import type {
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
    connId: "conn-dispatcher-test",
    clientIp: "127.0.0.1",
  } as NonNullable<GatewayRequestOptions["client"]>;
}

function req(method: string) {
  return {
    type: "req" as const,
    id: crypto.randomUUID(),
    method,
  };
}

describe("dispatchGatewayRequest", () => {
  beforeEach(() => {
    controlPlaneRateLimitTesting.resetControlPlaneRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    controlPlaneRateLimitTesting.resetControlPlaneRateLimitState();
  });

  it("dispatches a known method and keeps raw handlers out of plugin scope", async () => {
    const context = buildContext();
    const respond = vi.fn();
    const subRespond = vi.fn();
    const handlers: GatewayRequestHandlers = {
      "test.main": async (opts) => {
        const scope = getPluginRuntimeGatewayRequestScope();
        expect(scope?.context).toBe(context);
        expect(Object.hasOwn(scope?.context ?? {}, "handlers")).toBe(false);
        await opts.dispatchSubRequest?.({
          req: req("test.sub"),
          respond: subRespond,
        });
        opts.respond(true, { ok: true });
      },
      "test.sub": ({ respond: nestedRespond }) => {
        nestedRespond(true, { nested: true });
      },
    };

    await dispatchGatewayRequest({
      req: req("test.main"),
      respond,
      client: null,
      isWebchatConnect: noWebchat,
      context,
      handlers,
    });

    expect(respond).toHaveBeenCalledWith(true, { ok: true });
    expect(subRespond).toHaveBeenCalledWith(true, { nested: true });
  });

  it("enforces operator scopes before invoking the handler", async () => {
    const respond = vi.fn();
    const handler = vi.fn();

    await dispatchGatewayRequest({
      req: req("config.patch"),
      respond,
      client: buildClient(["operator.read"]),
      isWebchatConnect: noWebchat,
      context: buildContext(),
      handlers: {
        "config.patch": handler,
      },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "missing scope: operator.admin",
      }),
    );
  });

  it("blocks unavailable startup methods before handler lookup", async () => {
    const respond = vi.fn();
    const handler = vi.fn();

    await dispatchGatewayRequest({
      req: req("models.list"),
      respond,
      client: buildClient(),
      isWebchatConnect: noWebchat,
      context: {
        ...buildContext(),
        unavailableGatewayMethods: new Set(["models.list"]),
      } as GatewayRequestContext,
      handlers: {
        "models.list": handler,
      },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        retryAfterMs: 500,
      }),
    );
  });

  it("applies control-plane write budget before invoking the handler", async () => {
    const respond = vi.fn();
    const handler = vi.fn(({ respond: handlerRespond }) => handlerRespond(true));
    const context = buildContext();
    const client = buildClient();
    const handlers = {
      "config.patch": handler,
    };

    for (let index = 0; index < 4; index += 1) {
      await dispatchGatewayRequest({
        req: req("config.patch"),
        respond,
        client,
        isWebchatConnect: noWebchat,
        context,
        handlers,
        controlPlaneWriteMethods: new Set(["config.patch"]),
      });
    }

    expect(handler).toHaveBeenCalledTimes(3);
    expect(respond).toHaveBeenLastCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        retryable: true,
      }),
    );
  });

  it("returns unknown method for missing handlers", async () => {
    const respond = vi.fn();

    await dispatchGatewayRequest({
      req: req("missing.method"),
      respond,
      client: null,
      isWebchatConnect: noWebchat,
      context: buildContext(),
      handlers: {},
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
        message: "unknown method: missing.method",
      }),
    );
  });
});

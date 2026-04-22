import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
/**
 * Shared API route helpers for openclaw-deck.
 *
 * Establishes the canonical pattern for all panel API routes:
 *   1. `gwRequest()` — typed RPC through the Gateway adapter
 *   2. `gatewayRequest()` — deprecated untyped fallback
 *   3. `extractPlatformHeaders()` — forward tenant/user context (for Deck-layer logging only)
 */
import { NextResponse } from "next/server";
import type { GatewayMethodMap, GatewayMethodName } from "@/types/gateway-protocol.generated";

type ErrorBody = { error: string; code?: string };

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CAPABILITY_BOOTSTRAP_WAIT_MS = 750;

async function waitForCapabilityBootstrap(
  runtime: NonNullable<ReturnType<typeof getRuntime>>,
): Promise<void> {
  if (runtime.capabilities.status !== "pending") {
    return;
  }
  await Promise.race([
    runtime.capabilities.ready,
    new Promise<void>((resolve) => {
      setTimeout(resolve, CAPABILITY_BOOTSTRAP_WAIT_MS);
    }),
  ]);
}

async function ensureRuntimeCompatibility(
  runtime: NonNullable<ReturnType<typeof getRuntime>>,
): Promise<string | null> {
  await waitForCapabilityBootstrap(runtime);
  if (runtime.capabilities.status !== "incompatible") {
    return null;
  }
  return runtime.capabilities.reason ?? "Gateway is incompatible with this Deck build";
}

/** Send a typed RPC request through the Gateway adapter and return raw data. */
export async function gwCall<M extends GatewayMethodName>(
  method: M,
  params: GatewayMethodMap[M]["params"],
  options?: { timeoutMs?: number },
): Promise<GatewayMethodMap[M]["result"]> {
  const runtime = getRuntime();
  if (!runtime) {
    throw new ControlPlaneGatewayError({
      code: "GATEWAY_UNAVAILABLE",
      message: "Gateway not configured",
    });
  }
  const incompatibleReason = await ensureRuntimeCompatibility(runtime);
  if (incompatibleReason) {
    throw new ControlPlaneGatewayError({
      code: "GATEWAY_INCOMPATIBLE",
      message: incompatibleReason,
    });
  }
  return runtime.adapter.request(method, params, options);
}

/** Send a typed RPC request through the Gateway adapter. */
export async function gwRequest<M extends GatewayMethodName>(
  method: M,
  params: GatewayMethodMap[M]["params"],
  options?: { timeoutMs?: number },
): Promise<NextResponse> {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" } satisfies ErrorBody, {
      status: 503,
    });
  }
  const incompatibleReason = await ensureRuntimeCompatibility(runtime);
  if (incompatibleReason) {
    return NextResponse.json(
      {
        error: incompatibleReason,
        code: "GATEWAY_INCOMPATIBLE",
      } satisfies ErrorBody,
      { status: 503 },
    );
  }

  try {
    const data = await gwCall(method, params, options);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      const status =
        err.code === "GATEWAY_INCOMPATIBLE" || err.code === "GATEWAY_UNAVAILABLE" ? 503 : 502;
      return NextResponse.json({ error: err.message, code: err.code } satisfies ErrorBody, {
        status,
      });
    }
    // In production, do not leak internal error details to the client.
    const message = IS_PRODUCTION
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json({ error: message } satisfies ErrorBody, { status: 500 });
  }
}

/**
 * @deprecated Use `gwRequest()` instead for type-safe gateway calls.
 * Send an untyped RPC request through the Gateway adapter.
 */
export async function gatewayRequest(
  method: string,
  params: unknown,
  options?: { timeoutMs?: number },
): Promise<NextResponse> {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" } satisfies ErrorBody, {
      status: 503,
    });
  }
  const incompatibleReason = await ensureRuntimeCompatibility(runtime);
  if (incompatibleReason) {
    return NextResponse.json(
      {
        error: incompatibleReason,
        code: "GATEWAY_INCOMPATIBLE",
      } satisfies ErrorBody,
      { status: 503 },
    );
  }

  try {
    const data = await runtime.adapter.request(method, params, options);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code } satisfies ErrorBody, {
        status: 502,
      });
    }
    const message = IS_PRODUCTION
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json({ error: message } satisfies ErrorBody, { status: 500 });
  }
}

/**
 * Extract platform contract headers from the incoming request.
 *
 * IMPORTANT: These headers must NOT be injected into Gateway RPC params,
 * because Gateway schemas use `additionalProperties: false` and will reject
 * unknown fields. Use this only for Deck-layer logging/tracing.
 */
export function extractPlatformHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = req.headers.get("x-tenant-id");
  const userId = req.headers.get("x-user-id");
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }
  if (userId) {
    headers["x-user-id"] = userId;
  }
  return headers;
}

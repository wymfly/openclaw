import { ControlPlaneGatewayError } from "@server/gateway-adapter";
import { getRuntime } from "@server/runtime";
/**
 * Shared API route helpers for openclaw-deck.
 *
 * Establishes the canonical pattern for all panel API routes:
 *   1. `gatewayRequest()` — send an RPC through the Gateway adapter
 *   2. `extractPlatformHeaders()` — forward tenant/user context (for Deck-layer logging only)
 */
import { NextResponse } from "next/server";

type ErrorBody = { error: string; code?: string };

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Send an RPC request through the Gateway adapter. */
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

  try {
    const data = await runtime.adapter.request(method, params, options);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ControlPlaneGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code } satisfies ErrorBody, {
        status: 502,
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

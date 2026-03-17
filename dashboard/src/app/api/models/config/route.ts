/**
 * /api/models/config — Provider configuration.
 *
 * GET   — Read provider config (API keys, base URLs)
 * PATCH — Update provider config
 *
 * Gateway contracts:
 *   config.get:   {} (no params, returns { raw, hash })
 *   config.patch: { raw, baseHash?, sessionKey?, note?, restartDelayMs? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("config.get", {});
});

export const PATCH = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    raw?: string;
    baseHash?: string;
    note?: string;
  };

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.raw) {
    return Response.json({ error: "raw config content is required" }, { status: 400 });
  }

  return gatewayRequest("config.patch", {
    raw: body.raw,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
    ...(body.note ? { note: body.note } : {}),
  });
});

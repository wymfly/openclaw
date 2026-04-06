/**
 * /api/config/apply — Apply configuration changes.
 *
 * POST — Save updated configuration
 *
 * Gateway contract:
 *   config.apply: { raw: string, baseHash?: string, sessionKey?, note?, restartDelayMs? }
 *   Returns: { ok, path, config, restart, sentinel }
 *   Conflict = INVALID_REQUEST error with "config changed" message
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    raw?: string;
    baseHash?: string;
  };

  if (!body.raw) {
    return Response.json({ error: "raw config is required" }, { status: 400 });
  }

  return gwRequest("config.apply", {
    raw: body.raw,
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  });
});

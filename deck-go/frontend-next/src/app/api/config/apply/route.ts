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
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localConfigApplyHandler(request: NextRequest) {
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
}

const guardedLocalConfigApplyHandler = withAuth(localConfigApplyHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config:apply`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalConfigApplyHandler(request);
}

/**
 * /api/config — Read gateway configuration.
 *
 * GET — Get current config and baseHash
 *
 * Gateway contract:
 *   config.get: {} (no params)
 *   Returns: { config: OpenClawConfig, baseHash: string, valid: boolean, exists: boolean }
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localConfigHandler() {
  return gwRequest("config.get", {});
}

const guardedLocalConfigHandler = withAuth(localConfigHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { config?: unknown };
    return NextResponse.json(payload.config ?? {});
  }
  return guardedLocalConfigHandler(request);
}

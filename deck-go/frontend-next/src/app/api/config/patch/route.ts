/**
 * /api/config/patch — Apply incremental config changes via JSON Merge Patch.
 *
 * POST — Send a merge patch to the gateway
 *
 * Gateway contract:
 *   config.patch: { raw: string, baseHash?: string }
 *   `raw` is a JSON string of the merge patch object.
 *   Returns: { ok, path, config, restart, sentinel }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localConfigPatchHandler(request: NextRequest) {
  const body = (await request.json()) as {
    patch?: Record<string, unknown>;
    baseHash?: string;
  };

  if (!body.patch || typeof body.patch !== "object") {
    return Response.json({ error: "patch object is required" }, { status: 400 });
  }

  // Gateway expects { raw: string } — stringify the patch object
  return gwRequest("config.patch", {
    raw: JSON.stringify(body.patch),
    ...(body.baseHash ? { baseHash: body.baseHash } : {}),
  });
}

const guardedLocalConfigPatchHandler = withAuth(localConfigPatchHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config:patch`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalConfigPatchHandler(request);
}

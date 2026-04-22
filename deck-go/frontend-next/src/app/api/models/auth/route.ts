/**
 * GET /api/models/auth — Provider auth overview with provenance.
 *
 * Calls `deck.auth.overview` RPC to retrieve auth health plus provider/source
 * boundary information for runtime-visible providers.
 *
 * Gateway contract (`DeckAuthOverviewParamsSchema`): {} (no params)
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localModelsAuthHandler(_request: NextRequest) {
  return gwRequest("deck.auth.overview", {});
}

const guardedLocalModelsAuthHandler = withAuth(localModelsAuthHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/models/auth`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalModelsAuthHandler(request);
}

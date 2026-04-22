/**
 * GET /api/models/configured — Runtime model inventory with provenance.
 *
 * Calls `models.configured` RPC to retrieve the runtime-visible model set.
 * The response can include models from global config, agent-local models,
 * and other runtime-visible sources, each annotated with provenance.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localModelsConfiguredHandler(_request: NextRequest) {
  return gwRequest("models.configured", {});
}

const guardedLocalModelsConfiguredHandler = withAuth(localModelsConfiguredHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/models/configured`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalModelsConfiguredHandler(request);
}

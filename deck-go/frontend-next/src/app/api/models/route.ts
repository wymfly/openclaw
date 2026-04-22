/**
 * GET /api/models — Model catalog.
 *
 * Calls `models.list` RPC to retrieve available models from all providers.
 *
 * Gateway contract (`ModelsListParamsSchema`): {} (no params)
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localModelsHandler(_request: NextRequest) {
  return gwRequest("models.list", {});
}

const guardedLocalModelsHandler = withAuth(localModelsHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/models`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalModelsHandler(request);
}

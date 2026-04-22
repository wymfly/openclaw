/**
 * GET /api/models/catalog-providers — Catalog providers grouped with defaults.
 *
 * Calls `models.catalog.providers` RPC to retrieve the full model catalog
 * grouped by provider, with known-provider defaults merged.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localModelsCatalogProvidersHandler(_request: NextRequest) {
  return gatewayRequest("models.catalog.providers", {});
}

const guardedLocalModelsCatalogProvidersHandler = withAuth(localModelsCatalogProvidersHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/models/catalog-providers`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalModelsCatalogProvidersHandler(request);
}

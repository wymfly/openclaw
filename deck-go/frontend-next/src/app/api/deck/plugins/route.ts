/**
 * /api/deck/plugins — Read-only Deck plugin inventory.
 *
 * GET — deck.plugins.list
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckPluginsHandler(request: NextRequest) {
  const capability = request.nextUrl.searchParams.get("capability");
  return gwRequest("deck.plugins.list", capability === "all" ? { capability } : {});
}

const guardedLocalDeckPluginsHandler = withAuth(localDeckPluginsHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/plugins${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalDeckPluginsHandler(request);
}

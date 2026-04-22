/**
 * POST /api/tools/catalog — Get tools catalog for an agent.
 *
 * Gateway contract: tools.catalog { agentId?, includePlugins? }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localToolsCatalogPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    agentId?: string;
    includePlugins?: boolean;
  };
  return gatewayRequest("tools.catalog", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.includePlugins !== undefined ? { includePlugins: body.includePlugins } : {}),
  });
}

const guardedLocalToolsCatalogPostHandler = withAuth(localToolsCatalogPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/tools/catalog`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalToolsCatalogPostHandler(request);
}

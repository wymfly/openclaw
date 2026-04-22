/**
 * /api/config/schema — Get configuration JSON Schema.
 *
 * GET — Get the JSON Schema for openclaw configuration
 *
 * Gateway contract:
 *   config.schema: {} (no params)
 *   Returns: JSON Schema object
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localConfigSchemaHandler() {
  return gwRequest("config.schema", {});
}

const guardedLocalConfigSchemaHandler = withAuth(localConfigSchemaHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config/schema`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { schema?: unknown };
    return NextResponse.json(payload.schema ?? {});
  }
  return guardedLocalConfigSchemaHandler(request);
}

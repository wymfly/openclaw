/**
 * POST /api/config/schema-lookup — Incremental config schema lookup.
 *
 * Gateway contract:
 *   Params: { path } (e.g. "agents.main.model")
 *   Returns: { path, schema, hint?, children[{ key, path, type, required, hasChildren, hint? }] }
 */
import { NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localConfigSchemaLookupHandler(request: NextRequest) {
  const body = (await request.json()) as { path?: string };
  if (typeof body.path !== "string") {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  return gwRequest("config.schema.lookup", { path: body.path });
}

const guardedLocalConfigSchemaLookupHandler = withAuth(localConfigSchemaLookupHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/config/schema-lookup`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalConfigSchemaLookupHandler(request);
}

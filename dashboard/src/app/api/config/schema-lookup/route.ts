/**
 * POST /api/config/schema-lookup — Incremental config schema lookup.
 *
 * Gateway contract:
 *   Params: { path } (e.g. "agents.main.model")
 *   Returns: { path, schema, hint?, children[{ key, path, type, required, hasChildren, hint? }] }
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { path?: string };
  if (typeof body.path !== "string") {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  return gwRequest("config.schema.lookup", { path: body.path });
});

/**
 * GET /api/gateway/describe — Gateway API introspection.
 *
 * Returns all methods + events + JSON schemas via `gateway.describe` RPC.
 * Module-level 60s cache avoids redundant calls within the same worker.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const CACHE_TTL_MS = 60_000;
let cached: { data: unknown; expiresAt: number } | null = null;

export const GET = withAuth(async (_request: NextRequest) => {
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  try {
    const data = await gwCall("gateway.describe", {
      filter: "all",
      includeSchemas: true,
    });
    cached = { data, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch gateway description";
    return NextResponse.json({ error: message }, { status: 502 });
  }
});

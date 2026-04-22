/**
 * GET /api/gateway/describe — Gateway API introspection.
 *
 * Returns all methods + events + JSON schemas via `gateway.describe` RPC.
 * Module-level 60s cache avoids redundant calls within the same worker.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gwCall } from "@/lib/api-helpers";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

const CACHE_TTL_MS = 60_000;
const DEFAULT_RUNTIME_ID = "rt_local";
let cached: { data: unknown; expiresAt: number } | null = null;

async function localDescribeHandler(_request: NextRequest) {
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
}

const guardedLocalDescribeHandler = withAuth(localDescribeHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/gateway/describe?includeSchemas=true`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { describe?: unknown };
    const now = Date.now();
    cached = { data: payload.describe ?? {}, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(payload.describe ?? {});
  }
  return guardedLocalDescribeHandler(request);
}

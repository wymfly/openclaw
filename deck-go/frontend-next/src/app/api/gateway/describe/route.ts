/**
 * GET /api/gateway/describe — Gateway API introspection.
 *
 * Returns all methods + events + JSON schemas from the Stage 2 control-plane.
 * Module-level 60s cache avoids redundant calls within the same worker.
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const CACHE_TTL_MS = 60_000;
const DEFAULT_RUNTIME_ID = "rt_local";
let cached: { data: unknown; expiresAt: number } | null = null;

async function cachedDescribeResponse() {
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const cachedResponse = await cachedDescribeResponse();
  if (cachedResponse) {
    return cachedResponse;
  }
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
  return deckGoUnavailableResponse();
}

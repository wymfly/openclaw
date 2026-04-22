/**
 * /api/cron — Cron job list + create.
 *
 * GET  → cron.list { includeDisabled?, limit?, offset?, query?, enabled?, sortBy?, sortDir? }
 * POST → cron.add  { name, schedule, sessionTarget, wakeMode, payload, ... }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localCronGetHandler(request: NextRequest) {
  const params: GatewayMethodMap["cron.list"]["params"] = {};
  const sp = request.nextUrl.searchParams;

  const limit = sp.get("limit");
  if (limit) {
    params.limit = parseInt(limit, 10);
  }
  const offset = sp.get("offset");
  if (offset) {
    params.offset = parseInt(offset, 10);
  }
  const query = sp.get("query");
  if (query) {
    params.query = query;
  }
  const enabled = sp.get("enabled");
  if (enabled) {
    params.enabled = enabled as "all" | "enabled" | "disabled";
  }
  const sortBy = sp.get("sortBy");
  if (sortBy) {
    params.sortBy = sortBy as typeof params.sortBy;
  }
  const sortDir = sp.get("sortDir");
  if (sortDir) {
    params.sortDir = sortDir as "asc" | "desc";
  }
  const includeDisabled = sp.get("includeDisabled");
  if (includeDisabled) {
    params.includeDisabled = includeDisabled === "true";
  }

  return gwRequest("cron.list", params);
}

async function localCronPostHandler(request: NextRequest) {
  const body = await request.json();
  return gwRequest("cron.add", body);
}

const guardedLocalCronGetHandler = withAuth(localCronGetHandler);
const guardedLocalCronPostHandler = withAuth(localCronPostHandler);

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron${search}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronPostHandler(request);
}

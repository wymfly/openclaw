/**
 * /api/cron — Cron job list + create.
 *
 * GET  → cron.list { includeDisabled?, limit?, offset?, query?, enabled?, sortBy?, sortDir? }
 * POST → cron.add  { name, schedule, sessionTarget, wakeMode, payload, ... }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const params: Record<string, unknown> = {};
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
    params.enabled = enabled;
  }
  const sortBy = sp.get("sortBy");
  if (sortBy) {
    params.sortBy = sortBy;
  }
  const sortDir = sp.get("sortDir");
  if (sortDir) {
    params.sortDir = sortDir;
  }
  const includeDisabled = sp.get("includeDisabled");
  if (includeDisabled) {
    params.includeDisabled = includeDisabled === "true";
  }

  return gatewayRequest("cron.list", params);
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  return gatewayRequest("cron.add", body);
});

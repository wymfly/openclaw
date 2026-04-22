/**
 * GET /api/cron/[jobId]/runs — Fetch run history for a cron job.
 *
 * Gateway contract: cron.runs { jobId, limit?, offset?, statuses?, sortDir? }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

type RouteContext = { params: Promise<{ jobId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localCronRunsGetHandler(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const sp = request.nextUrl.searchParams;
  const params: GatewayMethodMap["cron.runs"]["params"] = { scope: "job", jobId };

  const limit = sp.get("limit");
  if (limit) {
    params.limit = parseInt(limit, 10);
  }
  const offset = sp.get("offset");
  if (offset) {
    params.offset = parseInt(offset, 10);
  }
  const sortDir = sp.get("sortDir");
  if (sortDir) {
    params.sortDir = sortDir as "asc" | "desc";
  }
  const statuses = sp.get("statuses");
  if (statuses) {
    params.statuses = statuses.split(",") as ("ok" | "error" | "skipped")[];
  }

  return gwRequest("cron.runs", params);
}

const guardedLocalCronRunsGetHandler = withAuth(localCronRunsGetHandler);

export async function GET(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(
      jobId,
    )}/runs${search}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronRunsGetHandler(request, ctx);
}

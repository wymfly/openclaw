/**
 * POST /api/cron/[jobId]/run — Manually trigger a cron job.
 *
 * Gateway contract: cron.run { id, mode?: "force"|"due" }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

type RouteContext = { params: Promise<{ jobId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localCronRunPostHandler(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  let mode: string | undefined;
  try {
    const body = (await request.json()) as { mode?: string };
    mode = body.mode;
  } catch {
    // no body is fine — defaults to "force"
  }
  return gwRequest("cron.run", {
    id: jobId,
    ...(mode ? { mode } : {}),
  } as GatewayMethodMap["cron.run"]["params"]);
}

const guardedLocalCronRunPostHandler = withAuth(localCronRunPostHandler);

export async function POST(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(jobId)}/run`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronRunPostHandler(request, ctx);
}

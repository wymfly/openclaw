/**
 * /api/cron/[jobId] — Update or remove a cron job.
 *
 * PATCH  → cron.update { id, patch }
 * DELETE → cron.remove { id }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

type RouteContext = { params: Promise<{ jobId: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localCronPatchHandler(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const body = await request.json();
  return gwRequest("cron.update", {
    id: jobId,
    patch: body,
  } as GatewayMethodMap["cron.update"]["params"]);
}

async function localCronDeleteHandler(_request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  return gwRequest("cron.remove", { id: jobId });
}

const guardedLocalCronPatchHandler = withAuth(localCronPatchHandler);
const guardedLocalCronDeleteHandler = withAuth(localCronDeleteHandler);

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(jobId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronPatchHandler(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { jobId } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/${encodeURIComponent(jobId)}`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalCronDeleteHandler(request, ctx);
}

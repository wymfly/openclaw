/**
 * /api/cron/[jobId] — Update or remove a cron job.
 *
 * PATCH  → cron.update { id, patch }
 * DELETE → cron.remove { id }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

type RouteContext = { params: Promise<{ jobId: string }> };

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { jobId } = await (ctx as RouteContext).params;
  const body = await request.json();
  return gwRequest("cron.update", {
    id: jobId,
    patch: body,
  } as GatewayMethodMap["cron.update"]["params"]);
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { jobId } = await (ctx as RouteContext).params;
  return gwRequest("cron.remove", { id: jobId });
});

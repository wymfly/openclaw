/**
 * /api/cron/[jobId] — Update or remove a cron job.
 *
 * PATCH  → cron.update { id, patch }
 * DELETE → cron.remove { id }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ jobId: string }> };

export const PATCH = withAuth(async (request: NextRequest, ctx: unknown) => {
  const { jobId } = await (ctx as RouteContext).params;
  const body = await request.json();
  return gatewayRequest("cron.update", { id: jobId, patch: body });
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { jobId } = await (ctx as RouteContext).params;
  return gatewayRequest("cron.remove", { id: jobId });
});

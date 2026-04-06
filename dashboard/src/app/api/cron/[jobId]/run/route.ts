/**
 * POST /api/cron/[jobId]/run — Manually trigger a cron job.
 *
 * Gateway contract: cron.run { id, mode?: "force"|"due" }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

type RouteContext = { params: Promise<{ jobId: string }> };

export const POST = withAuth(async (request: NextRequest, ctx: unknown) => {
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
});

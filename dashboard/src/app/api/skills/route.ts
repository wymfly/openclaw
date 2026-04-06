/**
 * GET /api/skills — Fetch skill status from the Gateway.
 *
 * Gateway contract: skills.status { agentId? }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const agentId = request.nextUrl.searchParams.get("agentId") ?? undefined;
  return gwRequest("skills.status", agentId ? { agentId } : {});
});

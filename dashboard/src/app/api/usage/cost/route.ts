/**
 * GET /api/usage/cost — Fetch usage cost breakdown from the Gateway.
 *
 * Gateway contract (`usage.cost`): { days?: number }
 */
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const days = request.nextUrl.searchParams.get("days") ?? "1";
  return gwRequest("usage.cost", { days: parseInt(days, 10) });
});

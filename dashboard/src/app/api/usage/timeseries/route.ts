/**
 * GET /api/usage/timeseries — Fetch usage timeseries data from the Gateway.
 *
 * Gateway contract (`sessions.usage.timeseries`): { key: string }
 */
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key query parameter is required" }, { status: 400 });
  }
  return gwRequest("sessions.usage.timeseries", { key });
});

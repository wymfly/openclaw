/**
 * POST /api/chat/compact — Compact session context via sessions.compact.
 *
 * Gateway contract (`SessionsCompactParamsSchema`):
 *   { key }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { sessionKey?: string };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gatewayRequest("sessions.compact", { key: body.sessionKey });
});

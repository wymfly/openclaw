/**
 * POST /api/chat/abort — Abort an in-progress run via sessions.abort.
 *
 * Gateway contract (`SessionsAbortParamsSchema`):
 *   { key, runId? }
 */
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    runId?: string;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  return gatewayRequest("sessions.abort", {
    key: body.sessionKey,
    runId: body.runId ?? undefined,
  });
});

/**
 * /api/sessions/[sessionKey] — Single session operations.
 *
 * GET    — Fetch conversation history for a session.
 * DELETE — Delete a session.
 *
 * Gateway contracts:
 *   chat.history:     { sessionKey }
 *   sessions.delete:  { key }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { sessionKey } = await (ctx as RouteContext).params;
  return gatewayRequest("chat.history", { sessionKey });
});

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { sessionKey } = await (ctx as RouteContext).params;
  return gatewayRequest("sessions.delete", { key: sessionKey });
});

/**
 * /api/sessions/[sessionKey] — Single session operations.
 *
 * DELETE — Delete a session.
 *
 * Gateway contracts:
 *   sessions.delete:  { key }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ sessionKey: string }> };

export const DELETE = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { sessionKey } = await (ctx as RouteContext).params;
  return gwRequest("sessions.delete", { key: sessionKey });
});

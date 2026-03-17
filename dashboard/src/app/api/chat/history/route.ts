/**
 * GET /api/chat/history — Fetch chat message history for a session.
 *
 * Gateway contract (`ChatHistoryParamsSchema`):
 *   { sessionKey, limit? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const sessionKey = searchParams.get("sessionKey");
  const limitStr = searchParams.get("limit");

  if (!sessionKey) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const limit = limitStr ? Number(limitStr) : undefined;

  return gatewayRequest("chat.history", {
    sessionKey,
    ...(typeof limit === "number" && Number.isFinite(limit) ? { limit } : {}),
  });
});

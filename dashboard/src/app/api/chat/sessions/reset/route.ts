import { getRuntime } from "@server/runtime";
import { NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    reason?: "new" | "reset";
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const response = await gwRequest("sessions.reset", {
    key: body.sessionKey,
    reason: body.reason ?? "reset",
  });
  if (response.ok) {
    getRuntime()?.store.clearChatSessionProjection(body.sessionKey);
  }
  return response;
});

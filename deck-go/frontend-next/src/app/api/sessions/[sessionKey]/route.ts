/**
 * /api/sessions/[sessionKey] — Single session operations.
 *
 * DELETE — Delete a session.
 *
 * Gateway contracts:
 *   sessions.delete:  { key }
 */
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

type RouteContext = { params: Promise<{ sessionKey: string }> };

async function localSessionDeleteHandler(_request: NextRequest, ctx: unknown) {
  const { sessionKey } = await (ctx as RouteContext).params;
  return gwRequest("sessions.delete", { key: sessionKey });
}

const guardedLocalSessionDeleteHandler = withAuth(localSessionDeleteHandler);

export async function DELETE(request: NextRequest, ctx: unknown) {
  const { sessionKey } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "DELETE",
      headers: request.headers,
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      sessionKey,
    )}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: sessionKey });
  }
  return guardedLocalSessionDeleteHandler(request, ctx);
}

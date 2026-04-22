/**
 * /api/deck/identity — Identity linking management.
 *
 * GET    — List identities (deck.identity.list)
 * POST   — Dispatch link/unlink by action field
 *
 * Gateway contracts:
 *   deck.identity.list:   {}
 *   deck.identity.link:   { canonical, channel, peerId, baseHash }
 *   deck.identity.unlink: { canonical, channel, peerId, baseHash }
 */
import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localDeckIdentityGetHandler(_request: NextRequest) {
  return gwRequest("deck.identity.list", {});
}

type IdentityAction = "link" | "unlink";

async function localDeckIdentityPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: IdentityAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "link":
      return gwRequest("deck.identity.link", p);
    case "unlink":
      return gwRequest("deck.identity.unlink", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}

const guardedLocalDeckIdentityGetHandler = withAuth(localDeckIdentityGetHandler);
const guardedLocalDeckIdentityPostHandler = withAuth(localDeckIdentityPostHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/identity`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalDeckIdentityGetHandler(request);
}

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/identity`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalDeckIdentityPostHandler(request);
}

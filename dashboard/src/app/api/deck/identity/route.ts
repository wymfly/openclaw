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
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const channel = searchParams.get("channel");
  const accountId = searchParams.get("accountId");

  return gatewayRequest("deck.identity.list", {
    ...(channel ? { channel } : {}),
    ...(accountId ? { accountId } : {}),
  });
});

type IdentityAction = "link" | "unlink";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: IdentityAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;

  switch (action) {
    case "link":
      return gatewayRequest("deck.identity.link", params);
    case "unlink":
      return gatewayRequest("deck.identity.unlink", params);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});

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
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("deck.identity.list", {});
});

type IdentityAction = "link" | "unlink";

export const POST = withAuth(async (request: NextRequest) => {
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
});

/**
 * /api/deck/routing — Manage message routing bindings.
 *
 * GET    — List all routing bindings (deck.routing.list)
 * POST   — Dispatch add/remove/validate/simulate by action field
 *
 * Gateway contracts:
 *   deck.routing.list:     { agentId?, channel?, accountId? }
 *   deck.routing.add:      { agentId, match, comment?, baseHash }
 *   deck.routing.remove:   { id, baseHash }
 *   deck.routing.validate: { agentId, match }
 *   deck.routing.simulate: { channel, accountId?, peer?, guildId?, teamId?, memberRoleIds? }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  return gwRequest("deck.routing.list", agentId ? { agentId } : {});
});

type RoutingAction = "add" | "remove" | "validate" | "simulate";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: RoutingAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;
  const p = params as never;

  switch (action) {
    case "add":
      return gwRequest("deck.routing.add", p);
    case "remove":
      return gwRequest("deck.routing.remove", p);
    case "validate":
      return gwRequest("deck.routing.validate", p);
    case "simulate":
      return gwRequest("deck.routing.simulate", p);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});

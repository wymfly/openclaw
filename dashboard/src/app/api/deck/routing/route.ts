/**
 * /api/deck/routing — Manage message routing bindings.
 *
 * GET    — List all routing bindings (deck.routing.list)
 * POST   — Dispatch add/remove/validate/simulate by action field
 *
 * Gateway contracts:
 *   deck.routing.list:     { agentId? }
 *   deck.routing.add:      { match, agentId, baseHash }
 *   deck.routing.remove:   { bindingId, baseHash }
 *   deck.routing.validate: { match, agentId? }
 *   deck.routing.simulate: { channel, accountId?, peer?, guild?, roles? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");

  return gatewayRequest("deck.routing.list", agentId ? { agentId } : {});
});

type RoutingAction = "add" | "remove" | "validate" | "simulate";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    action?: RoutingAction;
    [key: string]: unknown;
  };

  const { action, ...params } = body;

  switch (action) {
    case "add":
      return gatewayRequest("deck.routing.add", params);
    case "remove":
      return gatewayRequest("deck.routing.remove", params);
    case "validate":
      return gatewayRequest("deck.routing.validate", params);
    case "simulate":
      return gatewayRequest("deck.routing.simulate", params);
    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
});

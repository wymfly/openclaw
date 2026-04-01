/**
 * POST /api/deck/commands/discover — Discover available slash commands from Gateway.
 *
 * Gateway contract:
 *   Params: { agentId? }
 *   Returns: { commands[], version }
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { agentId?: string };
  return gwRequest("deck.commands.discover", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
  });
});

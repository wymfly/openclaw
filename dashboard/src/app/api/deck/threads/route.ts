/**
 * /api/deck/threads — Thread listing.
 *
 * GET — List threads (deck.threads.list)
 *
 * Gateway contracts:
 *   deck.threads.list: { agentId?, channel?, limit?, status? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const agentId = searchParams.get("agentId");
  const channel = searchParams.get("channel");
  const limit = searchParams.get("limit");
  const status = searchParams.get("status");

  return gatewayRequest("deck.threads.list", {
    ...(agentId ? { agentId } : {}),
    ...(channel ? { channel } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
    ...(status ? { status } : {}),
  });
});

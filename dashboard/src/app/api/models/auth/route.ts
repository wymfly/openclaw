/**
 * GET /api/models/auth — Provider auth overview.
 *
 * Calls `deck.auth.overview` RPC to retrieve authentication status
 * for all configured providers.
 *
 * Gateway contract (`DeckAuthOverviewParamsSchema`): {} (no params)
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("deck.auth.overview", {});
});

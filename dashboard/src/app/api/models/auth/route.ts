/**
 * GET /api/models/auth — Provider auth overview with provenance.
 *
 * Calls `deck.auth.overview` RPC to retrieve auth health plus provider/source
 * boundary information for runtime-visible providers.
 *
 * Gateway contract (`DeckAuthOverviewParamsSchema`): {} (no params)
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("deck.auth.overview", {});
});

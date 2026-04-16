/**
 * /api/deck/plugins — Read-only Deck plugin inventory.
 *
 * GET — deck.plugins.list
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const capability = request.nextUrl.searchParams.get("capability");
  return gwRequest("deck.plugins.list", capability === "all" ? { capability } : {});
});

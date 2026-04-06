/**
 * GET /api/models/configured — Configured models with auth status.
 *
 * Calls `models.configured` RPC to retrieve only models from
 * config.models.providers, each annotated with provider auth status.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("models.configured", {});
});

/**
 * GET /api/models/configured — Runtime model inventory with provenance.
 *
 * Calls `models.configured` RPC to retrieve the runtime-visible model set.
 * The response can include models from global config, agent-local models,
 * and other runtime-visible sources, each annotated with provenance.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gwRequest("models.configured", {});
});

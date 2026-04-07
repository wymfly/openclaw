/**
 * GET /api/models/catalog-providers — Catalog providers grouped with defaults.
 *
 * Calls `models.catalog.providers` RPC to retrieve the full model catalog
 * grouped by provider, with known-provider defaults merged.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("models.catalog.providers", {});
});

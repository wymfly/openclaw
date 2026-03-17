/**
 * /api/models/config — Provider configuration.
 *
 * GET   — Read provider config (API keys, base URLs)
 * PATCH — Update provider config
 */
import { type NextRequest } from "next/server";
import { gatewayRequest, extractPlatformHeaders } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const platform = extractPlatformHeaders(request);
  return gatewayRequest("config.get", { section: "models", ...platform });
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const platform = extractPlatformHeaders(request);

  return gatewayRequest("config.patch", {
    section: "models",
    ...body,
    ...platform,
  });
}

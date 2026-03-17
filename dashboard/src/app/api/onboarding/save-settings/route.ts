import { getProjectionStore } from "@server/projection-store";
import { initRuntime, shutdownRuntime } from "@server/runtime";
/**
 * POST /api/onboarding/save-settings — Persist onboarding configuration.
 *
 * Saves gateway URL/token (and optional provider fields) to the SQLite
 * settings table, then triggers runtime initialization.
 *
 * Note: No withAuth here — this is called during initial onboarding when
 * no token is configured yet. The access-gate allows all requests when
 * no token is set (local dev mode).
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

type SaveBody = {
  gatewayUrl?: string;
  gatewayToken?: string;
  providerName?: string;
  apiKey?: string;
  model?: string;
};

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as SaveBody;
  const url = body.gatewayUrl?.trim();
  const token = body.gatewayToken?.trim();

  if (!url || !token) {
    return NextResponse.json(
      { error: "gatewayUrl and gatewayToken are required" },
      { status: 400 },
    );
  }

  const store = getProjectionStore();
  store.setSetting("gateway_url", url);
  store.setSetting("gateway_token", token);

  if (body.providerName) {
    store.setSetting("provider_name", body.providerName);
  }
  if (body.apiKey) {
    store.setSetting("provider_api_key", body.apiKey);
  }
  if (body.model) {
    store.setSetting("provider_model", body.model);
  }

  // Restart runtime so the adapter picks up new settings.
  await shutdownRuntime();
  const runtime = initRuntime({ gatewayUrl: url, gatewayToken: token });

  return NextResponse.json({ success: !!runtime });
});

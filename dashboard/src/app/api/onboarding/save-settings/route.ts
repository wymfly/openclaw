import { getProjectionStore } from "@server/projection-store";
import { initRuntime, shutdownRuntime } from "@server/runtime";
/**
 * POST /api/onboarding/save-settings — Persist onboarding configuration.
 *
 * Saves gateway URL/token (and optional provider fields) to the SQLite
 * settings table, then triggers runtime initialization.
 */
import { NextResponse } from "next/server";

type SaveBody = {
  gatewayUrl?: string;
  gatewayToken?: string;
  providerName?: string;
  apiKey?: string;
  model?: string;
};

export async function POST(request: Request) {
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
}

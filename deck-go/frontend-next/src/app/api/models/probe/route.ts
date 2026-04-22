/**
 * POST /api/models/probe — Probe a provider's auth credentials.
 *
 * Calls `deck.auth.probe` RPC to verify that a specific provider's
 * API key / credentials are valid by making a lightweight API call.
 *
 * Gateway contract (`DeckAuthProbeParamsSchema`):
 *   { provider: string, profileId?: string, timeoutMs?: number, maxTokens?: number }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localModelsProbeHandler(request: NextRequest) {
  const body = await request.json();
  if (!body?.provider || typeof body.provider !== "string") {
    return Response.json({ error: "provider is required" }, { status: 400 });
  }
  return gwRequest(
    "deck.auth.probe",
    {
      provider: body.provider,
      profileId: body.profileId,
      timeoutMs: body.timeoutMs,
      maxTokens: body.maxTokens,
    },
    { timeoutMs: (body.timeoutMs ?? 8000) + 2000 },
  );
}

const guardedLocalModelsProbeHandler = withAuth(localModelsProbeHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/models/probe`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalModelsProbeHandler(request);
}

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
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
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
});

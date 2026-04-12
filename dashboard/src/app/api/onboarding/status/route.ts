import { getSetting } from "@server/deck-settings";
/**
 * GET /api/onboarding/status — Check whether onboarding is needed.
 *
 * Returns `{ needsOnboarding: true }` when gateway settings are absent.
 * Checks env vars first (same priority as runtime.ts resolveGatewaySettings),
 * so deployments with DECK_GATEWAY_URL/TOKEN in .env skip onboarding.
 */
import { NextResponse } from "next/server";

export function GET() {
  const url = process.env.DECK_GATEWAY_URL ?? getSetting("gateway_url");
  const token = process.env.DECK_GATEWAY_TOKEN ?? getSetting("gateway_token");
  const needsOnboarding = !url || !token;
  return NextResponse.json({ needsOnboarding });
}

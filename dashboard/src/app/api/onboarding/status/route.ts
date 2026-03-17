import { getProjectionStore } from "@server/projection-store";
/**
 * GET /api/onboarding/status — Check whether onboarding is needed.
 *
 * Returns `{ needsOnboarding: true }` when gateway settings are absent.
 */
import { NextResponse } from "next/server";

export function GET() {
  const store = getProjectionStore();
  const url = store.getSetting("gateway_url");
  const token = store.getSetting("gateway_token");
  const needsOnboarding = !url || !token;
  return NextResponse.json({ needsOnboarding });
}

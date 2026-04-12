/**
 * /api/settings — Read/update deck settings stored in JSON.
 *
 * GET  — Return gatewayUrl, notificationPrefs (token presence only, not value)
 * PATCH — Update gatewayUrl, gatewayToken, notificationPrefs
 */
import { getSetting, setSetting } from "@server/deck-settings";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const gatewayUrl = getSetting("gateway_url") ?? "";
  const gatewayToken = getSetting("gateway_token") ?? "";
  const notificationPrefsRaw = getSetting("notification_prefs");
  let notificationPrefs = { approvals: true, budget: true, alerts: true };
  if (notificationPrefsRaw) {
    try {
      notificationPrefs = JSON.parse(notificationPrefsRaw) as typeof notificationPrefs;
    } catch {
      // Use defaults
    }
  }

  return NextResponse.json({
    gatewayUrl,
    // Use same sentinel as PATCH check (••••••) to prevent third-party clients
    // from accidentally overwriting the real token via GET→PATCH roundtrip.
    gatewayToken: gatewayToken ? "••••••" : "",
    notificationPrefs,
  });
});

export const PATCH = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as Record<string, unknown>;

  if (typeof body.gatewayUrl === "string") {
    setSetting("gateway_url", body.gatewayUrl);
  }

  // Only update token if it's a real value (not the masked placeholder)
  if (typeof body.gatewayToken === "string" && body.gatewayToken !== "••••••") {
    setSetting("gateway_token", body.gatewayToken);
  }

  if (body.notificationPrefs && typeof body.notificationPrefs === "object") {
    setSetting("notification_prefs", JSON.stringify(body.notificationPrefs));
  }

  return NextResponse.json({ ok: true });
});

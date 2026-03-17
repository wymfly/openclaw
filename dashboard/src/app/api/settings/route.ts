/**
 * /api/settings — Read/update deck settings stored in SQLite.
 *
 * GET  — Return gatewayUrl, notificationPrefs (token presence only, not value)
 * PATCH — Update gatewayUrl, gatewayToken, notificationPrefs
 */
import { getRuntime } from "@server/runtime";
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async () => {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const gatewayUrl = runtime.store.getSetting("gateway_url") ?? "";
  const gatewayToken = runtime.store.getSetting("gateway_token") ?? "";
  const notificationPrefsRaw = runtime.store.getSetting("notification_prefs");
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
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" }, { status: 503 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  if (typeof body.gatewayUrl === "string") {
    runtime.store.setSetting("gateway_url", body.gatewayUrl);
  }

  // Only update token if it's a real value (not the masked placeholder)
  if (typeof body.gatewayToken === "string" && body.gatewayToken !== "••••••") {
    runtime.store.setSetting("gateway_token", body.gatewayToken);
  }

  if (body.notificationPrefs && typeof body.notificationPrefs === "object") {
    runtime.store.setSetting("notification_prefs", JSON.stringify(body.notificationPrefs));
  }

  return NextResponse.json({ ok: true });
});

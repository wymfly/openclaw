/**
 * /api/settings — Read/update deck settings stored in JSON.
 *
 * GET  — Return gatewayUrl, notificationPrefs (token presence only, not value)
 * PATCH — Update gatewayUrl, gatewayToken, notificationPrefs
 */
import { getSetting, setSetting } from "@server/deck-settings";
import { NextRequest, NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { withAuth } from "@/lib/with-auth";

async function localSettingsGetHandler() {
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
}

async function localSettingsPatchHandler(request: NextRequest) {
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
}

const guardedLocalSettingsGetHandler = withAuth(localSettingsGetHandler);
const guardedLocalSettingsPatchHandler = withAuth(localSettingsPatchHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(request, "/api/v1/settings");
  if (proxied) {
    return proxied;
  }
  return guardedLocalSettingsGetHandler(request);
}

export async function PATCH(request: NextRequest) {
  const apiBase =
    process.env.DECK_GO_API_BASE?.trim() ?? process.env.NEXT_PUBLIC_DECK_GO_API_BASE?.trim() ?? "";
  if (apiBase) {
    const body = await request.arrayBuffer();
    const response = await fetch(`${apiBase.replace(/\/+$/, "")}/api/v1/settings`, {
      method: "PUT",
      headers: new Headers({
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        ...(request.headers.get("authorization")
          ? { authorization: request.headers.get("authorization")! }
          : {}),
        ...(request.headers.get("x-deck-token")
          ? { "x-deck-token": request.headers.get("x-deck-token")! }
          : {}),
      }),
      body,
    });
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  }
  return guardedLocalSettingsPatchHandler(request);
}

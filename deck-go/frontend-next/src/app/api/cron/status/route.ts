/**
 * GET /api/cron/status — Fetch cron service status.
 *
 * Gateway contract: cron.status {}
 */
import { type NextRequest } from "next/server";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import { NextResponse } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localCronStatusGetHandler(_request: NextRequest) {
  return gwRequest("cron.status", {});
}

const guardedLocalCronStatusGetHandler = withAuth(localCronStatusGetHandler);

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/cron/status`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return guardedLocalCronStatusGetHandler(request);
}

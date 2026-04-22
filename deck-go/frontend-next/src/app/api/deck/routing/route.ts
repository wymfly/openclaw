/**
 * /api/deck/routing — Manage message routing bindings.
 */
import { NextResponse, type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type RoutingAction = "add" | "remove" | "validate" | "simulate";
async function validateDeckRoutingPost(request: NextRequest) {
  const body = (await request.json()) as {
    action?: RoutingAction;
    [key: string]: unknown;
  };

  switch (body.action) {
    case "add":
    case "remove":
    case "validate":
    case "simulate":
      return null;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/routing${search}`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { payload?: unknown };
    return NextResponse.json(payload.payload ?? {});
  }
  return deckGoUnavailableResponse();
}

export async function POST(request: NextRequest) {
  const invalid = await validateDeckRoutingPost(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/routing`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

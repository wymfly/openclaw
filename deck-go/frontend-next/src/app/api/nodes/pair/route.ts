/**
 * /api/nodes/pair — Node pairing management.
 *
 * GET  — List pairing requests
 * POST — Dispatch request/approve/reject/verify by action field
 */
import { NextResponse, type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type PairAction = "request" | "approve" | "reject" | "verify";
async function validateNodesPairPost(request: NextRequest) {
  const body = (await request.json()) as {
    action?: PairAction;
    [key: string]: unknown;
  };
  switch (body.action) {
    case "request":
    case "approve":
    case "reject":
    case "verify":
      return null;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes/pair`,
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
  const invalid = await validateNodesPairPost(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/nodes/pair`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

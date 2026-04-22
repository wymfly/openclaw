/**
 * /api/deck/subagents — Subagent monitoring.
 */
import { NextResponse, type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type SubagentAction = "kill" | "lineage" | "steer";
async function validateDeckSubagentsPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    action?: SubagentAction;
    [key: string]: unknown;
  };

  switch (body.action) {
    case "kill":
    case "lineage":
    case "steer":
      return null;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? "";
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/subagents${search}`,
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
  const invalid = await validateDeckSubagentsPostHandler(request.clone());
  if (invalid) {
    return invalid;
  }
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/deck/subagents`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

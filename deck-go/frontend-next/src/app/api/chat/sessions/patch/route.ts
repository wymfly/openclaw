import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

export async function POST(request: NextRequest) {
  const body = (await request.clone().json()) as {
    sessionKey?: string;
    model?: string;
    thinkingLevel?: string;
    fastMode?: boolean;
    verboseLevel?: string;
    reasoningLevel?: string;
    responseUsage?: "off" | "tokens" | "full" | "on" | null;
    sendPolicy?: "allow" | "deny" | null;
  };

  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }

  const { sessionKey, ...patch } = body;
  const proxied = await fetchDeckGo(
    new NextRequest(request.url, {
      method: "POST",
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        "content-type": "application/json",
      },
      body: JSON.stringify(patch),
    }),
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions/${encodeURIComponent(
      sessionKey,
    )}:patch`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    return NextResponse.json({ ok: true, key: sessionKey });
  }
  return deckGoUnavailableResponse();
}

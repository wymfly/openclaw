import { type NextRequest, NextResponse } from "next/server";
import YAML from "yaml";
import { deckGoUnavailableResponse, maybeProxyToDeckGo } from "@/app/api/_deck-go-proxy";

function normalizeRawToJson(raw: string): string {
  try {
    JSON.parse(raw);
    return raw;
  } catch {}
  try {
    const obj = YAML.parse(raw);
    return JSON.stringify(obj);
  } catch {
    return raw;
  }
}

export async function GET(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/models/config");
  if (!proxied) {
    return deckGoUnavailableResponse();
  }
  if (!proxied.ok) {
    return proxied;
  }
  const payload = (await proxied.json()) as { payload?: { raw?: string } };
  const data = payload.payload ?? {};
  if (typeof data.raw === "string") {
    data.raw = normalizeRawToJson(data.raw);
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const proxied = await maybeProxyToDeckGo(request, "/api/v1/models/config");
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

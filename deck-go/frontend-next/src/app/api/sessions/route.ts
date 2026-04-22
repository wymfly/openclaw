import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

const DEFAULT_RUNTIME_ID = "rt_local";

type Stage2SessionRecord = {
  key?: string;
  sessionKey?: string;
  title?: string;
  status?: string;
  updatedAt?: number;
  lastMessagePreview?: string;
};

function filterStage2Sessions(items: Stage2SessionRecord[], request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase();
  const limitParam = request.nextUrl.searchParams.get("limit");
  const activeMinutesParam = request.nextUrl.searchParams.get("activeMinutes");

  let filtered = [...items];

  if (search) {
    filtered = filtered.filter((session) => {
      const key = (session.key ?? session.sessionKey ?? "").toLowerCase();
      const title = (session.title ?? "").toLowerCase();
      const preview = (session.lastMessagePreview ?? "").toLowerCase();
      return key.includes(search) || title.includes(search) || preview.includes(search);
    });
  }

  if (activeMinutesParam) {
    const activeMinutes = parseInt(activeMinutesParam, 10);
    if (Number.isFinite(activeMinutes) && activeMinutes > 0) {
      const cutoff = Date.now() - activeMinutes * 60 * 1000;
      filtered = filtered.filter((session) => (session.updatedAt ?? 0) >= cutoff);
    }
  }

  filtered.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (Number.isFinite(limit) && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
  }

  return { sessions: filtered };
}

export async function GET(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/sessions`,
  );
  if (proxied) {
    if (!proxied.ok) {
      return proxied;
    }
    const payload = (await proxied.json()) as { sessions?: Stage2SessionRecord[] };
    return NextResponse.json(filterStage2Sessions(payload.sessions ?? [], request));
  }
  return deckGoUnavailableResponse();
}

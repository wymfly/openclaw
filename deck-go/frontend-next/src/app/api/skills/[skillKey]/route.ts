/**
 * PATCH /api/skills/[skillKey] — Update a skill's configuration.
 */
import { type NextRequest } from "next/server";
import { deckGoUnavailableResponse, fetchDeckGo } from "@/app/api/_deck-go-proxy";

type RouteContext = { params: Promise<{ skillKey: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

export async function PATCH(request: NextRequest, ctx: unknown) {
  const { skillKey } = await (ctx as RouteContext).params;
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/skills/${encodeURIComponent(
      skillKey,
    )}`,
  );
  if (proxied) {
    return proxied;
  }
  return deckGoUnavailableResponse();
}

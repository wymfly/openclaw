/**
 * PATCH /api/skills/[skillKey] — Update a skill's configuration.
 *
 * Gateway contract: skills.update { skillKey, enabled?, apiKey?, env? }
 * Note: empty apiKey/env values delete the field.
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ skillKey: string }> };
const DEFAULT_RUNTIME_ID = "rt_local";

async function localSkillPatchHandler(request: NextRequest, ctx: unknown) {
  const { skillKey } = await (ctx as RouteContext).params;
  const body = await request.json();
  return gwRequest("skills.update", { skillKey, ...body });
}

const guardedLocalSkillPatchHandler = withAuth(localSkillPatchHandler);

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
  return guardedLocalSkillPatchHandler(request, ctx);
}

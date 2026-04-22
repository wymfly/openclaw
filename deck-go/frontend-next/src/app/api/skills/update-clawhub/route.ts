/**
 * POST /api/skills/update-clawhub — Update ClawHub skill(s).
 *
 * Gateway contract: skills.update { source: "clawhub", slug?, all? }
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import type { GatewayMethodMap } from "@/types/gateway-protocol.generated";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localSkillsUpdateClawhubPostHandler(request: NextRequest) {
  const body = (await request.json()) as {
    slug?: string;
    all?: boolean;
  };
  return gwRequest("skills.update", {
    source: "clawhub",
    ...(body.slug ? { slug: body.slug } : {}),
    ...(body.all ? { all: true } : {}),
  } as GatewayMethodMap["skills.update"]["params"]);
}

const guardedLocalSkillsUpdateClawhubPostHandler = withAuth(localSkillsUpdateClawhubPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/skills/update-clawhub`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalSkillsUpdateClawhubPostHandler(request);
}

/**
 * POST /api/skills/install — Install a skill.
 *
 * Gateway contract: skills.install { name, installId, timeoutMs? } for install options,
 * or { source: "clawhub", slug } for ClawHub installs.
 */
import { type NextRequest } from "next/server";
import { fetchDeckGo } from "@/app/api/_deck-go-proxy";
import { gwRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

const DEFAULT_RUNTIME_ID = "rt_local";

async function localSkillsInstallPostHandler(request: NextRequest) {
  const body = (await request.json()) as
    | { name: string; installId: string; timeoutMs?: number }
    | { source: "clawhub"; slug: string };
  return gwRequest("skills.install", body);
}

const guardedLocalSkillsInstallPostHandler = withAuth(localSkillsInstallPostHandler);

export async function POST(request: NextRequest) {
  const proxied = await fetchDeckGo(
    request,
    `/api/v1/runtimes/${encodeURIComponent(DEFAULT_RUNTIME_ID)}/skills/install`,
  );
  if (proxied) {
    return proxied;
  }
  return guardedLocalSkillsInstallPostHandler(request);
}
